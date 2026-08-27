import type { Db } from './db.js';
import { decrypt, encrypt } from './crypto.js';
import { log, logError } from './logger.js';
import { applyPromptGuard } from './promptGuard.js';

export interface GatewayConfig {
  baseUrl: string;
  apiKey: string;
  isCustom?: boolean; // 是否是用户专属配置（true 表示免积分）
}

export interface UpstreamImageResult {
  b64?: string;
  url?: string;
}

/** 读取某用户的网关配置（apiKey 解密，若用户未配置则继承全局/admin配置） */
export function getUserGatewayConfig(db: Db, userId: string, secretKey: string): GatewayConfig {
  const getVal = (uid: string, k: string) => {
    const row = db.prepare('SELECT value FROM user_settings WHERE user_id=? AND key=?').get(uid, k) as { value: string } | undefined;
    return row?.value;
  };

  const userBaseUrl = getVal(userId, 'baseUrl');
  const userEncApiKey = getVal(userId, 'apiKey');
  const hasOwn = !!(userBaseUrl && userEncApiKey);

  let baseUrl = userBaseUrl;
  let encApiKey = userEncApiKey;

  // 如果非 admin 用户且未配置专属网关，回退到 admin (全局) 的设置
  if (userId !== 'admin' && !hasOwn) {
    if (!baseUrl) baseUrl = getVal('admin', 'baseUrl');
    if (!encApiKey) encApiKey = getVal('admin', 'apiKey');
  }

  return {
    baseUrl: baseUrl ?? '',
    apiKey: encApiKey ? (decrypt(encApiKey, secretKey) ?? '') : '',
    isCustom: userId === 'admin' || hasOwn,
  };
}

export function clearUserGatewayConfig(db: Db, userId: string): void {
  db.prepare('DELETE FROM user_settings WHERE user_id=?').run(userId);
  log('CONFIG', `用户 [${userId}] 清除了自定义专属网关配置，已恢复继承平台共享接口`);
}

export function saveUserGatewayConfig(
  db: Db,
  userId: string,
  secretKey: string,
  input: { baseUrl?: string; apiKey?: string },
): GatewayConfig {
  const cur = getUserGatewayConfig(db, userId, secretKey);

  const next: GatewayConfig = {
    baseUrl: (input.baseUrl !== undefined ? input.baseUrl : cur.baseUrl).trim().replace(/\/+$/, ''),
    apiKey: input.apiKey && input.apiKey.includes('*') ? cur.apiKey : (input.apiKey !== undefined ? input.apiKey : cur.apiKey).trim(),
  };

  const upsert = db.prepare(
    'INSERT INTO user_settings(user_id,key,value) VALUES(?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value'
  );
  upsert.run(userId, 'baseUrl', next.baseUrl);
  if (input.apiKey && !input.apiKey.includes('*')) {
    upsert.run(userId, 'apiKey', next.apiKey ? encrypt(next.apiKey, secretKey) : '');
  } else if (input.apiKey === '') {
    upsert.run(userId, 'apiKey', '');
  }

  log('CONFIG', `用户 [${userId}] 更新了网关设置`, { baseUrl: next.baseUrl, hasApiKey: !!next.apiKey });
  return getUserGatewayConfig(db, userId, secretKey);
}

/** OpenAI 兼容尺寸映射 */
const RATIO_SIZE: Record<string, string> = {
  '1:1': '1024x1024',
  '16:9': '1536x864',
  '9:16': '864x1536',
  '4:3': '1152x896',
  '3:4': '896x1152',
};

export function ratioToSize(ratio: string): string {
  return RATIO_SIZE[ratio] ?? RATIO_SIZE['1:1'];
}

export type FetchLike = typeof fetch;

export interface GenerateImageOpts {
  prompt: string;
  ratio: string;
  model: string;
  refImagesB64?: string[];
}

// ============ 借鉴 iLab：协议适配器注册表架构 ============
// 协议（怎么传输）与模型能力（参数怎么编码）分离，替代 if/else 硬编码分支

export interface ProtocolAdapter {
  id: string;
  /** 判断该模型是否适用此协议 */
  matches(model: string, hasRefs: boolean): boolean;
  /** 构造请求 */
  buildRequest(cfg: GatewayConfig, opts: GenerateImageOpts, model: string): BuiltRequest;
  /** 该协议的响应是否可能不含 size 字段（需要提示词注入比例） */
  supportsSizeParam: boolean;
}

export interface BuiltRequest {
  url: string;
  init: RequestInit;
  protocol: string;
  /** 异步任务轮询：非空时响应里出现 task_id 则走轮询 */
  pollBase?: string;
}

/** 协议1：Gemini 图像类 → chat 多模态（不支持 size 参数 → 提示词注入比例） */
const geminiChatAdapter: ProtocolAdapter = {
  id: 'gemini-chat',
  supportsSizeParam: false,
  matches: (model) => /gemini.*image|gemini.*flash.*image|imagen/i.test(model),
  buildRequest(cfg, opts, model) {
    const content: any[] = [{ type: 'text', text: opts.prompt }];
    for (const b64 of opts.refImagesB64 ?? []) {
      content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } });
    }
    return {
      url: cfg.baseUrl + '/v1/chat/completions',
      protocol: 'chat多模态',
      init: {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content }] }),
      },
    };
  },
};

/** 协议2：硅基流动风格（Qwen-Edit 类图生图）→ generations + JSON image 参数 */
const siliconflowAdapter: ProtocolAdapter = {
  id: 'siliconflow-generations',
  supportsSizeParam: true,
  matches: (model, hasRefs) => hasRefs && /qwen-image-edit|Qwen\/Qwen-Image-Edit/i.test(model),
  buildRequest(cfg, opts, model) {
    return {
      url: cfg.baseUrl + '/v1/images/generations',
      protocol: '硅基generations+image',
      pollBase: cfg.baseUrl,
      init: {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: opts.prompt,
          image: `data:image/jpeg;base64,${opts.refImagesB64![0]}`,
          image_size: ratioToSize(opts.ratio),
        }),
      },
    };
  },
};

/** 协议3：OpenAI 标准 multipart edits（图生图） */
const openaiEditsAdapter: ProtocolAdapter = {
  id: 'openai-edits',
  supportsSizeParam: true,
  matches: (_model, hasRefs) => hasRefs,
  buildRequest(cfg, opts, model) {
    const fd = new FormData();
    fd.append('model', model);
    fd.append('prompt', opts.prompt);
    fd.append('size', ratioToSize(opts.ratio));
    for (const [i, b64] of (opts.refImagesB64 ?? []).entries()) {
      const bin = Buffer.from(b64, 'base64');
      fd.append('image', new Blob([new Uint8Array(bin)], { type: 'image/jpeg' }), `ref-${i}.jpg`);
    }
    return {
      url: cfg.baseUrl + '/v1/images/edits',
      protocol: 'multipart-edits',
      pollBase: cfg.baseUrl,
      init: {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
        body: fd as any,
      },
    };
  },
};

/** 协议4：OpenAI 标准 generations（文生图） */
const openaiGenerationsAdapter: ProtocolAdapter = {
  id: 'openai-generations',
  supportsSizeParam: true,
  matches: () => true, // 兜底
  buildRequest(cfg, opts, model) {
    return {
      url: cfg.baseUrl + '/v1/images/generations',
      protocol: 'generations',
      pollBase: cfg.baseUrl,
      init: {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: opts.prompt,
          size: ratioToSize(opts.ratio),
          n: 1,
        }),
      },
    };
  },
};

/** 协议注册表：顺序即优先级（先匹配先用） */
const PROTOCOL_REGISTRY: ProtocolAdapter[] = [
  geminiChatAdapter,
  siliconflowAdapter,
  openaiEditsAdapter,
  openaiGenerationsAdapter,
];

function resolveAdapter(model: string, hasRefs: boolean): ProtocolAdapter {
  return PROTOCOL_REGISTRY.find((a) => a.matches(model, hasRefs)) ?? openaiGenerationsAdapter;
}

// ============ 借鉴 iLab：比例指令注入（chat 协议模型不支持 size 参数时） ============

/** 检测提示词中是否已有比例描述，避免重复注入 */
function promptHasRatioInstruction(prompt: string): boolean {
  return /宽高比|aspect ratio|比例设为|画面比例|尺寸比例|画面尺寸/i.test(prompt);
}

/** 给提示词附加比例指令（iLab append_ratio_prompt_instruction 的简化版） */
export function appendRatioPromptInstruction(prompt: string, ratio: string): string {
  if (!ratio || !/^\d+:\d+$/.test(ratio)) return prompt;
  if (promptHasRatioInstruction(prompt)) return prompt;
  const text = prompt.trim();
  const instruction = `画面宽高比必须为 ${ratio}（如 ${ratio.split(':').join(':')}，横构图或竖构图按此比例严格执行）`;
  if (!text) return instruction;
  return `${text}\n\n${instruction}`;
}

// ============ 借鉴 iLab：错误分类重试 ============

/** 从错误中提取 HTTP 状态码（兼容 "上游返回 502: ..." 格式与 fetch 网络异常） */
function extractHttpStatus(err: any): number | null {
  const msg = String(err?.message ?? '');
  const m = msg.match(/HTTP (\d{3})|上游返回 (\d{3})/);
  if (m) return Number(m[1] ?? m[2]);
  return null;
}

/**
 * 判断错误是否值得重试（借鉴 iLab _is_retryable_transient_image_error）：
 * - 401/403/400/404/422：认证/参数/模型问题，重试无意义 → 快速失败
 * - 429：限速，可重试（退避更久）
 * - 5xx：上游瞬时故障，可重试
 * - 网络类异常（fetch failed/ECONNRESET/timeout）：可重试
 */
export function isRetryableError(err: any): boolean {
  const msg = String(err?.message ?? '').toLowerCase();
  // 网络类异常
  if (/fetch failed|econnreset|econnaborted|broken pipe|timeout|etimedout|socket hang up|network/.test(msg)) {
    return true;
  }
  const status = extractHttpStatus(err);
  if (status === null) {
    // 没有状态码且不匹配网络错误 → 保守认为不可重试（如内容审核拦截）
    return /all channels failed|channel failed|bad gateway|service unavailable/.test(msg);
  }
  if (status === 429) return true; // 限速：重试
  if (status >= 500) return true; // 上游故障：重试
  return false; // 4xx 其他：快速失败
}

/** 指数退避（iLab _transient_image_retry_delay_seconds）：base * 2^(n-1)，带上限 */
function retryDelayMs(failedAttempt: number): number {
  const BASE = 2000;
  const MAX = 15000;
  return Math.min(MAX, BASE * Math.pow(2, Math.max(0, failedAttempt - 1)));
}

const MAX_RETRIES = 3; // 最多重试3次（共4次尝试）

// ============ 借鉴 iLab：异步任务轮询（T8/NewAPI 异步 images 扩展） ============

const ASYNC_POLL_INTERVAL_MS = 8000; // 轮询间隔 8s
const ASYNC_POLL_MAX_ATTEMPTS = 45; // 最多轮询 45 次（约 6 分钟）
const ASYNC_SUCCESS_STATUSES = new Set(['completed', 'success', 'done', 'finished', 'succeeded']);
const ASYNC_FAILURE_STATUSES = new Set(['failed', 'failure', 'error', 'cancelled', 'canceled']);

/** 响应里带 task_id 且没有图片数据 → 进入异步轮询模式 */
function extractTaskId(json: any): string | null {
  const id = json?.task_id ?? json?.id ?? json?.data?.task_id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

async function pollAsyncTask(
  cfg: GatewayConfig,
  fetchLike: FetchLike,
  taskId: string,
  startTime: number,
  model: string,
): Promise<UpstreamImageResult> {
  const url = `${cfg.baseUrl}/v1/images/tasks/${encodeURIComponent(taskId)}`;
  log('UPSTREAM', `⏳ 上游返回异步任务 task_id=${taskId}，开始轮询...`);
  for (let i = 0; i < ASYNC_POLL_MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, ASYNC_POLL_INTERVAL_MS));
    try {
      const res = await fetchLike(url, {
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
      });
      if (!res.ok) {
        logError('UPSTREAM', `轮询任务状态失败 HTTP ${res.status}`, await res.text().catch(() => ''));
        continue;
      }
      const json: any = await res.json();
      const envelope = json?.data ?? json;
      const status = String(envelope?.status ?? '').toLowerCase();
      if (ASYNC_FAILURE_STATUSES.has(status)) {
        throw new Error(`异步任务失败 (${status}): ${JSON.stringify(envelope).slice(0, 200)}`);
      }
      // 成功或已带结果数据
      const resultPayload = envelope?.data ?? (envelope?.b64_json || envelope?.url ? envelope : null);
      if (ASYNC_SUCCESS_STATUSES.has(status) || resultPayload) {
        if (resultPayload) {
          const parsed = extractImageFromPayload(resultPayload, startTime, model, '异步任务轮询');
          if (parsed) return parsed;
        }
        if (ASYNC_SUCCESS_STATUSES.has(status)) {
          throw new Error(`异步任务完成但无图片数据: ${JSON.stringify(envelope).slice(0, 200)}`);
        }
      }
    } catch (e: any) {
      if (String(e?.message).includes('异步任务')) throw e; // 终态错误直接抛
      logError('UPSTREAM', `轮询异常（第 ${i + 1} 次），继续...`, e?.message);
    }
  }
  throw new Error(`异步任务轮询超时（${ASYNC_POLL_MAX_ATTEMPTS * ASYNC_POLL_INTERVAL_MS / 1000}s），task_id=${taskId}`);
}

// ============ 响应解析（多格式兼容） ============

/** 从 OpenAI/硅基格式 payload 中提取图片 */
function extractImageFromPayload(json: any, startTime: number, model: string, via: string): UpstreamImageResult | null {
  const item = json?.data?.[0] ?? json?.images?.[0];
  if (item?.b64_json) {
    log('UPSTREAM', `✅ 上游生图成功 [${via}] (耗时 ${Date.now() - startTime}ms, 模型: ${model}, b64 ${(item.b64_json.length / 1024).toFixed(1)}KB)`);
    return { b64: item.b64_json };
  }
  if (item?.url) {
    log('UPSTREAM', `✅ 上游生图成功 [${via}] (耗时 ${Date.now() - startTime}ms, 模型: ${model}, url)`);
    return { url: item.url };
  }
  return null;
}

/** 从 chat 多模态响应中提取图片（含 Gemini 原生格式） */
function extractImageFromChatResponse(json: any, startTime: number, model: string): UpstreamImageResult | null {
  // OpenAI chat 格式
  const msg = json?.choices?.[0]?.message;
  if (msg) {
    // 形态1: message.images = [{image_url: {url}}] 或 [{url}]
    const imgFromList = msg.images?.[0]?.image_url?.url ?? msg.images?.[0]?.url;
    if (imgFromList) {
      log('UPSTREAM', `✅ 上游生图成功 [chat-images] (耗时 ${Date.now() - startTime}ms, 模型: ${model})`);
      if (imgFromList.startsWith('data:')) return { b64: imgFromList.split(',')[1] };
      return { url: imgFromList };
    }
    // 形态2: content 字符串内嵌 base64 / markdown 图片 URL
    if (typeof msg.content === 'string') {
      const dataUrl = msg.content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]{100,}/);
      if (dataUrl) {
        log('UPSTREAM', `✅ 上游生图成功 [chat-content-b64] (耗时 ${Date.now() - startTime}ms, 模型: ${model})`);
        return { b64: dataUrl[0].split(',')[1] };
      }
      const mdUrl = msg.content.match(/!\[[^\]]*\]\((https?:\/\/\S+)\)/) || msg.content.match(/(https?:\/\/\S+\.(?:png|jpg|jpeg|webp)\S*)/);
      if (mdUrl) {
        log('UPSTREAM', `✅ 上游生图成功 [chat-content-url] (耗时 ${Date.now() - startTime}ms, 模型: ${model})`);
        return { url: mdUrl[1] };
      }
    }
    // 形态3: content 数组含 image_url part
    if (Array.isArray(msg.content)) {
      const imgPart = msg.content.find((p: any) => p.type === 'image_url');
      if (imgPart?.image_url?.url) {
        log('UPSTREAM', `✅ 上游生图成功 [chat-content-array] (耗时 ${Date.now() - startTime}ms, 模型: ${model})`);
        const u = imgPart.image_url.url;
        return u.startsWith('data:') ? { b64: u.split(',')[1] } : { url: u };
      }
    }
  }

  // Gemini 原生格式（借鉴 iLLab gemini.py）：candidates[].content.parts[].inlineData / fileData
  const candidates = json?.candidates;
  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      const parts = candidate?.content?.parts;
      if (!Array.isArray(parts)) continue;
      for (const part of parts) {
        // 跳过思考片段（iLab: thought part）
        if (part?.thought === true) continue;
        // inlineData / inline_data（b64 图片）
        const inline = part?.inlineData ?? part?.inline_data;
        const encoded = inline?.data ?? inline?.b64_json;
        const mime = String(inline?.mimeType ?? inline?.mime_type ?? 'image/png');
        if (typeof encoded === 'string' && encoded && mime.toLowerCase().startsWith('image/')) {
          log('UPSTREAM', `✅ 上游生图成功 [gemini-inlineData] (耗时 ${Date.now() - startTime}ms, 模型: ${model})`);
          return { b64: encoded };
        }
        // fileData / file_data（文件 URI）
        const fileData = part?.fileData ?? part?.file_data;
        const fileUri = fileData?.fileUri ?? fileData?.file_uri ?? fileData?.uri ?? fileData?.url;
        const fileMime = String(fileData?.mimeType ?? fileData?.mime_type ?? '');
        if (typeof fileUri === 'string' && fileUri && fileMime.toLowerCase().startsWith('image/')) {
          log('UPSTREAM', `✅ 上游生图成功 [gemini-fileData] (耗时 ${Date.now() - startTime}ms, 模型: ${model})`);
          return { url: fileUri };
        }
      }
    }
  }
  return null;
}

/** ============ 主入口：生成图片（协议自适配 + 分类重试 + 异步轮询） ============ */
export async function generateImage(
  cfg: GatewayConfig,
  opts: GenerateImageOpts,
  fetchLike: FetchLike = fetch,
): Promise<UpstreamImageResult> {
  const hasRefs = (opts.refImagesB64?.length ?? 0) > 0;
  let finalModel = opts.model || 'gpt-image-2';
  // 针对通义千问：如果有参考图且模型传入的是 Qwen-Image，自动转为编辑模型 Qwen-Image-Edit-2509
  if (hasRefs && finalModel === 'Qwen-Image') {
    finalModel = 'Qwen-Image-Edit-2509';
  }

  const startTime = Date.now();
  const adapter = resolveAdapter(finalModel, hasRefs);

  // 提示词守卫：检测到硬性约束（标题/颜色/限制类关键词）时注入保真规则
  const guardedPrompt = applyPromptGuard(opts.prompt);
  if (guardedPrompt !== opts.prompt) {
    log('GUARD', `🛡️ 检测到硬性约束，已注入保真规则 (提示词 ${opts.prompt.length}→${guardedPrompt.length} 字)`);
  }
  // 比例指令注入：协议不支持 size 参数时，把比例写进提示词
  const effectivePrompt =
    adapter.supportsSizeParam ? guardedPrompt : appendRatioPromptInstruction(guardedPrompt, opts.ratio);

  const req = adapter.buildRequest(
    cfg,
    { ...opts, prompt: effectivePrompt },
    finalModel,
  );

  log('UPSTREAM', `🚀 请求上游中转站: ${req.url} [${req.protocol}]`, {
    model: finalModel,
    ratio: opts.ratio,
    size: ratioToSize(opts.ratio),
    refImagesCount: opts.refImagesB64?.length ?? 0,
    ratioInjected: !adapter.supportsSizeParam,
    prompt: effectivePrompt.length > 80 ? `${effectivePrompt.slice(0, 80)}...` : effectivePrompt,
  });

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchLike(req.url, req.init);
      const json: any = await parseAndValidate(res, startTime, finalModel);

      // 先尝试直接提取图片
      const direct = extractImageFromPayload(json, startTime, finalModel, req.protocol)
        ?? extractImageFromChatResponse(json, startTime, finalModel);
      if (direct) return direct;

      // 没有图片但带 task_id → 异步任务轮询（T8/NewAPI 异步 images 扩展）
      const taskId = extractTaskId(json);
      if (taskId && req.pollBase) {
        return await pollAsyncTask({ ...cfg, baseUrl: req.pollBase }, fetchLike, taskId, startTime, finalModel);
      }

      throw new Error(`上游响应中没有图片数据: ${JSON.stringify(json).slice(0, 200)}`);
    } catch (e: any) {
      lastErr = e;
      // 异步轮询的终态错误不重试
      const isAsyncTerminal = String(e?.message).includes('异步任务');
      const retryable = !isAsyncTerminal && isRetryableError(e);
      if (attempt < MAX_RETRIES && retryable) {
        const delay = retryDelayMs(attempt + 1);
        log('UPSTREAM', `⚠️ 第 ${attempt + 1} 次失败（${String(e?.message).slice(0, 120)}），${delay / 1000}s 后重试...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      if (!retryable && attempt === 0) {
        log('UPSTREAM', `⛔ 不可重试错误，快速失败: ${String(e?.message).slice(0, 150)}`);
      }
      break;
    }
  }
  throw lastErr;
}

/** 校验 HTTP 响应并返回 JSON（非 2xx 抛带状态码的错误） */
async function parseAndValidate(res: any, startTime: number, model: string): Promise<any> {
  if (!res.ok) {
    const rawText = await res.text().catch(() => '');
    logError('UPSTREAM', `上游返回错误 HTTP ${res.status} (耗时 ${Date.now() - startTime}ms, 模型: ${model})`, rawText);
    throw new Error(`上游返回 HTTP ${res.status}: ${rawText.slice(0, 300)}`);
  }
  return await res.json();
}

/** 测试连通：GET /v1/models */
export async function testGateway(cfg: GatewayConfig, fetchLike: FetchLike = fetch): Promise<{ ok: boolean; message: string }> {
  log('UPSTREAM', `🔍 测试连接中转站: ${cfg.baseUrl}/v1/models`);
  try {
    const res = await fetchLike(cfg.baseUrl + '/v1/models', {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logError('UPSTREAM', `中转站连接测试失败 HTTP ${res.status}`, text);
      return { ok: false, message: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const json = await res.json();
    const count = Array.isArray(json?.data) ? json.data.length : 0;
    log('UPSTREAM', `✅ 中转站连接成功，共获取到 ${count} 个可用模型`);
    return { ok: true, message: `连接成功，中转站包含 ${count} 个可用模型` };
  } catch (e: any) {
    logError('UPSTREAM', `中转站连接请求异常`, e);
    return { ok: false, message: e?.message ?? String(e) };
  }
}
