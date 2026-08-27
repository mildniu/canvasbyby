import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { openDb, type Db } from './db.js';
import { createListThumbnail, imageDimensions } from './thumbnails.js';
import { atomicWriteFile } from './atomic.js';
import { signToken, verifyToken, maskKey, hashPassword, verifyPassword } from './crypto.js';
import { log, logError } from './logger.js';
import { getModelCreditCost, getModelsPricingMap } from './credits.js';
import {
  getUserGatewayConfig,
  saveUserGatewayConfig,
  clearUserGatewayConfig,
  generateImage,
  testGateway,
  type GatewayConfig,
  type FetchLike,
} from './upstream.js';

export interface AppOptions {
  accessPassword?: string;
  secretKey: string;
  dataDir: string;
  upstreamFetch?: FetchLike;
}

const COOKIE_NAME = 'session';
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000; // 30 天
const LOGIN_LIMIT = 10; // 连续错误次数
const LOGIN_WINDOW_MS = 10 * 60 * 1000; // 窗口 10 分钟

export interface AuthSession {
  userId: string;
  username: string;
  role: 'admin' | 'user';
  exp: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthSession;
  }
}

export async function buildApp(opts: AppOptions) {
  const { db, mediaDir } = openDb(opts.dataDir);
  const app = Fastify({ logger: false, bodyLimit: 30 * 1024 * 1024 }); // 参考图 base64 可达数 MB
  await app.register(cookie);

  // 兜底：容忍空 body + Content-Type: application/json 的 POST（否则 Fastify 返回 400）
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    if (body === '' || body == null) {
      (req.body as any) = {};
      return done(null, {});
    }
    try {
      const json = JSON.parse(body as string);
      done(null, json);
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  // 登录限速（内存）
  let failCount = 0;
  let firstFailAt = 0;

  // ---- 鉴权中间件 ----
  app.addHook('preHandler', async (req, reply) => {
    const url = req.url;
    const isPublic =
      url.startsWith('/api/auth/login') ||
      (req.method === 'GET' && url.startsWith('/assets/')) ||
      url === '/' ||
      url === '/health';
    if (isPublic) return;
    if (!url.startsWith('/api/') && !url.startsWith('/media/')) return; // 前端 SPA 路由放行

    const token = req.cookies[COOKIE_NAME];
    const payload = verifyToken<AuthSession>(token, opts.secretKey);
    if (!payload || !payload.userId) {
      return reply.code(401).send({ error: 'unauthorized' });
    }

    // 检查用户是否被禁用
    const u = db.prepare('SELECT id, username, role, status FROM users WHERE id=?').get(payload.userId) as any;
    if (!u || u.status === 0) {
      log('AUTH', `被禁用的账号尝试访问: ${payload.username} [${payload.userId}]`);
      return reply.code(401).send({ error: '账号已停用或不存在' });
    }

    req.user = {
      userId: u.id,
      username: u.username,
      role: u.role,
      exp: payload.exp,
    };
  });

  // ---- auth 接口 ----
  app.post('/api/auth/login', async (req, reply) => {
    const now = Date.now();
    if (now - firstFailAt > LOGIN_WINDOW_MS) {
      failCount = 0;
      firstFailAt = 0;
    }
    if (failCount >= LOGIN_LIMIT) {
      log('AUTH', `⚠️ 触发登录限速 (失败次数达到 ${LOGIN_LIMIT} 次)`);
      return reply.code(429).send({ error: '尝试过多，请 10 分钟后再试' });
    }

    const { username = 'admin', password } = (req.body ?? {}) as { username?: string; password?: string };
    if (!password) {
      return reply.code(400).send({ error: '请输入密码' });
    }

    // 支持通过用户名登录
    const u = db.prepare('SELECT * FROM users WHERE username=?').get(username.trim()) as any;
    let matched = false;

    if (u) {
      matched = verifyPassword(password, u.password_hash);
    } else if (username === 'admin' && opts.accessPassword && password === opts.accessPassword) {
      // 兼容历史单一 accessPassword
      matched = true;
    }

    if (!matched) {
      failCount++;
      if (firstFailAt === 0) firstFailAt = now;
      log('AUTH', `❌ 用户登录失败: [${username}] 密码错误`);
      return reply.code(401).send({ error: '用户名或密码错误' });
    }

    if (u && u.status === 0) {
      log('AUTH', `❌ 用户登录被拒: [${username}] 账号已被禁用`);
      return reply.code(403).send({ error: '账号已被禁用' });
    }

    failCount = 0;
    firstFailAt = 0;

    const userObj = u || { id: 'admin', username: 'admin', role: 'admin', credits: 999999 };
    const sessionData: AuthSession = {
      userId: userObj.id,
      username: userObj.username,
      role: userObj.role,
      exp: now + SESSION_TTL_MS,
    };

    const token = signToken(sessionData, opts.secretKey);
    reply.setCookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    });

    log('AUTH', `🔑 用户登录成功: [${userObj.username}] (角色: ${userObj.role})`);

    return {
      ok: true,
      user: {
        id: userObj.id,
        username: userObj.username,
        role: userObj.role,
        credits: userObj.role === 'admin' ? 999999 : (userObj.credits ?? 20),
      },
    };
  });

  app.post('/api/auth/register', async (_req, reply) => {
    // 注册已关闭：账号由管理员在「用户管理」中创建
    return reply.code(403).send({ error: '注册已关闭，请联系管理员开通账号' });
  });

  app.post('/api/auth/register-disabled', async (req, reply) => {
    const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
    if (!username?.trim() || !password?.trim()) {
      return reply.code(400).send({ error: '用户名和密码不能为空' });
    }
    if (username.length < 3 || username.length > 20) {
      return reply.code(400).send({ error: '用户名长度需在 3-20 位' });
    }
    if (password.length < 6) {
      return reply.code(400).send({ error: '密码长度不能少于 6 位' });
    }

    const exist = db.prepare('SELECT id FROM users WHERE username=?').get(username.trim());
    if (exist) {
      return reply.code(400).send({ error: '用户名已存在' });
    }

    const id = randomUUID();
    const hash = hashPassword(password);
    db.prepare('INSERT INTO users(id, username, password_hash, role, status, credits, created_at) VALUES(?,?,?,?,?,?,?)').run(
      id,
      username.trim(),
      hash,
      'user',
      1,
      20,
      Date.now()
    );

    const token = signToken(
      { userId: id, username: username.trim(), role: 'user', exp: Date.now() + SESSION_TTL_MS },
      opts.secretKey
    );
    reply.setCookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    });

    log('AUTH', `✨ 新用户注册成功: [${username.trim()}] [ID: ${id}]`);

    return {
      ok: true,
      user: { id, username: username.trim(), role: 'user', credits: 20 },
    };
  });

  app.get('/api/auth/me', async (req) => {
    const u = db.prepare('SELECT id, username, role, status, credits FROM users WHERE id=?').get(req.user!.userId) as any;
    const cfg = getUserGatewayConfig(db, req.user!.userId, opts.secretKey);
    if (!u) {
      return {
        user: {
          ...req.user,
          credits: req.user!.role === 'admin' ? 999999 : 20,
          hasCustomGateway: !!cfg.isCustom,
        },
      };
    }
    return {
      user: {
        id: u.id,
        username: u.username,
        role: u.role,
        credits: u.role === 'admin' ? 999999 : (u.credits ?? 20),
        hasCustomGateway: !!cfg.isCustom,
      },
    };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    if (req.user) {
      log('AUTH', `🚪 用户退出登录: [${req.user.username}]`);
    }
    reply.clearCookie(COOKIE_NAME, { path: '/' });
    return { ok: true };
  });

  // ---- 管理员用户管理接口 (仅 admin) ----
  app.get('/api/admin/users', async (req, reply) => {
    if (req.user?.role !== 'admin') {
      return reply.code(403).send({ error: '需要管理员权限' });
    }
    const rows = db.prepare('SELECT id, username, role, status, credits, created_at FROM users ORDER BY created_at DESC').all() as any[];
    return rows.map((r) => ({
      ...r,
      credits: r.role === 'admin' ? 999999 : (r.credits ?? 20),
    }));
  });

  app.post('/api/admin/users', async (req, reply) => {
    if (req.user?.role !== 'admin') return reply.code(403).send({ error: '需要管理员权限' });
    const { username, password, role = 'user', credits = 20 } = (req.body ?? {}) as any;
    if (!username?.trim() || !password?.trim()) return reply.code(400).send({ error: '用户名和密码必填' });
    const exist = db.prepare('SELECT id FROM users WHERE username=?').get(username.trim());
    if (exist) return reply.code(400).send({ error: '用户名已存在' });

    const id = randomUUID();
    const initialCredits = role === 'admin' ? 999999 : (typeof credits === 'number' && credits >= 0 ? credits : 20);
    db.prepare('INSERT INTO users(id, username, password_hash, role, status, credits, created_at) VALUES(?,?,?,?,?,?,?)').run(
      id,
      username.trim(),
      hashPassword(password),
      role === 'admin' ? 'admin' : 'user',
      1,
      initialCredits,
      Date.now()
    );
    log('ADMIN', `管理员创建新用户: [${username.trim()}] (角色: ${role}, 初始积分: ${initialCredits})`);
    return { ok: true, id };
  });

  app.put('/api/admin/users/:id', async (req, reply) => {
    if (req.user?.role !== 'admin') return reply.code(403).send({ error: '需要管理员权限' });
    const { id } = req.params as { id: string };
    const { password, role, status, credits } = (req.body ?? {}) as any;

    if (id === req.user.userId && status === 0) {
      return reply.code(400).send({ error: '不能禁用当前登录的管理员账号' });
    }

    if (password && password.trim()) {
      db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(password.trim()), id);
      log('ADMIN', `管理员修改了用户 [${id}] 的密码`);
    }
    if (role && (role === 'admin' || role === 'user')) {
      db.prepare('UPDATE users SET role=? WHERE id=?').run(role, id);
      log('ADMIN', `管理员修改了用户 [${id}] 的角色为 [${role}]`);
    }
    if (typeof status === 'number') {
      db.prepare('UPDATE users SET status=? WHERE id=?').run(status, id);
      log('ADMIN', `管理员将用户 [${id}] 状态修改为 [${status === 1 ? '启用' : '禁用'}]`);
    }
    if (typeof credits === 'number' && credits >= 0) {
      const cVal = Math.floor(credits);
      db.prepare('UPDATE users SET credits=? WHERE id=?').run(cVal, id);
      log('ADMIN', `管理员将用户 [${id}] 的积分修改为 [${cVal}]`);
    }
    return { ok: true };
  });

  app.delete('/api/admin/users/:id', async (req, reply) => {
    if (req.user?.role !== 'admin') return reply.code(403).send({ error: '需要管理员权限' });
    const { id } = req.params as { id: string };
    if (id === req.user.userId) return reply.code(400).send({ error: '不能删除自己' });
    db.prepare('DELETE FROM users WHERE id=?').run(id);
    db.prepare('DELETE FROM user_settings WHERE user_id=?').run(id);
    log('ADMIN', `管理员删除了用户 [${id}] 及其配置`);
    return { ok: true };
  });

  // ---- settings 网关配置（仅 BaseURL 和 API Key） ----
  app.get('/api/settings', async (req) => {
    const isAdmin = req.user!.role === 'admin';
    const cfg = getUserGatewayConfig(db, req.user!.userId, opts.secretKey);
    // 普通用户如果未配置专属网关，严禁泄露和回显管理员的内部默认地址/端口与 Key
    if (!isAdmin && !cfg.isCustom) {
      return {
        baseUrl: '',
        apiKey: '',
        isCustom: false,
      };
    }
    return {
      baseUrl: cfg.baseUrl,
      apiKey: maskKey(cfg.apiKey),
      isCustom: !!cfg.isCustom,
    };
  });

  app.put('/api/settings', async (req, reply) => {
    const body = (req.body ?? {}) as { baseUrl?: string; apiKey?: string };
    if (body.baseUrl !== undefined && body.baseUrl && !/^https?:\/\//.test(body.baseUrl)) {
      return reply.code(400).send({ error: '网关地址必须以 http(s):// 开头' });
    }
    saveUserGatewayConfig(db, req.user!.userId, opts.secretKey, body);
    const cfg = getUserGatewayConfig(db, req.user!.userId, opts.secretKey);
    const isAdmin = req.user!.role === 'admin';
    if (!isAdmin && !cfg.isCustom) {
      return {
        baseUrl: '',
        apiKey: '',
        isCustom: false,
      };
    }
    return {
      baseUrl: cfg.baseUrl,
      apiKey: maskKey(cfg.apiKey),
      isCustom: !!cfg.isCustom,
    };
  });

  app.delete('/api/settings/custom', async (req) => {
    clearUserGatewayConfig(db, req.user!.userId);
    return {
      ok: true,
      baseUrl: '',
      apiKey: '',
      isCustom: false,
    };
  });

  app.post('/api/settings/test', async (req, reply) => {
    const cfg = getUserGatewayConfig(db, req.user!.userId, opts.secretKey);
    const isAdmin = req.user!.role === 'admin';
    // 普通用户未配置专属网关时，提示填写专属网关
    if (!isAdmin && !cfg.isCustom) {
      return reply.code(400).send({
        ok: false,
        message: '您当前使用的是平台共享接口，由管理员维护；如需配置专属接口，请先输入您的网关地址与 API Key 后保存测试。',
      });
    }
    if (!cfg.baseUrl) return reply.code(400).send({ ok: false, message: '请先填写网关地址' });
    return testGateway(cfg, opts.upstreamFetch);
  });

  // ---- 模型列表：透传中转站 /v1/models，过滤出可用生图模型 ----
  app.get('/api/models', async (req, reply) => {
    const cfg = getUserGatewayConfig(db, req.user!.userId, opts.secretKey);
    if (!cfg.baseUrl || !cfg.apiKey) {
      return reply.code(400).send({ error: '请先在「设置」页配置网关地址与 API Key' });
    }
    try {
      const fetchLike = opts.upstreamFetch ?? fetch;
      const res = await fetchLike(cfg.baseUrl + '/v1/models', {
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        logError('MODELS', `拉取模型列表失败 HTTP ${res.status}`, text);
        return reply.code(502).send({ error: `中转站返回 ${res.status}: ${text.slice(0, 200)}` });
      }
      const json: any = await res.json();
      const all: string[] = (json?.data ?? []).map((m: any) => m.id).filter(Boolean);
      // 生图模型关键词过滤（排除纯对话/嵌入模型）
      const IMAGE_RE = /image|dall|flux|seedream|banana|imagen|photo|draw|paint|mj|midjourney|sd|stable|kolors|hidream|cogview|irag|janus|omnigen|pixart|playground|recraft|ideogram|doubao-seed|wanx|grok-imagine/i;
      const imageModels = all.filter((m) => IMAGE_RE.test(m));
      const finalModels = imageModels.length ? imageModels : all;
      const pricing = getModelsPricingMap(finalModels);
      log('MODELS', `✅ 拉取到 ${all.length} 个模型，其中生图模型 ${imageModels.length} 个`, { imageModels: imageModels.slice(0, 15) });
      return { models: finalModels, total: all.length, pricing, isCustom: !!cfg.isCustom };
    } catch (e: any) {
      logError('MODELS', '拉取模型列表异常', e);
      return reply.code(502).send({ error: e?.message ?? '连接中转站失败' });
    }
  });

  // ---- tasks: 图片生成 ----
  app.post('/api/tasks/image', async (req, reply) => {
    const cfg = getUserGatewayConfig(db, req.user!.userId, opts.secretKey);
    const { prompt, ratio = '1:1', refAssets = [], model = 'gpt-image-2' } = (req.body ?? {}) as {
      prompt?: string;
      ratio?: string;
      refAssets?: string[];
      model?: string;
    };

    const isAdmin = req.user!.role === 'admin';
    const isCustomGateway = !!cfg.isCustom;
    const isFree = isAdmin || isCustomGateway; // 用户专属接口或 admin 免消耗积分
    const creditCost = isFree ? 0 : getModelCreditCost(model);

    log('TASK', `📥 收到生图请求 [用户: ${req.user!.username} (${req.user!.userId}), 角色: ${req.user!.role}, 自定义接口免扣分: ${isCustomGateway}]`, {
      model,
      creditCost,
      isFree,
      ratio,
      refAssetsCount: refAssets.length,
      prompt: prompt?.slice(0, 60),
    });

    if (!prompt?.trim()) return reply.code(400).send({ error: '提示词不能为空' });
    if (refAssets.length > 10) return reply.code(400).send({ error: '参考图最多 10 张' });

    if (!cfg.baseUrl || !cfg.apiKey) {
      logError('TASK', `生图失败: 用户 [${req.user!.username}] 尚未配置网关地址或 API Key`);
      return reply.code(400).send({ error: '系统尚未配置网关地址或 API Key，请联系管理员在设置中配置' });
    }

    // 检查并预扣积分 (admin 或 配置了自定义专属接口的用户免扣积分)
    if (!isFree) {
      const userRow = db.prepare('SELECT credits FROM users WHERE id=?').get(req.user!.userId) as { credits: number } | undefined;
      const currentCredits = userRow?.credits ?? 0;
      if (currentCredits < creditCost) {
        log('CREDITS', `⛔ 用户 [${req.user!.username}] 积分不足 (需要 ${creditCost} 积分, 剩余 ${currentCredits} 积分)`);
        return reply.code(402).send({
          error: `积分不足：模型「${model}」生成需要 ${creditCost} 积分，您当前剩余 ${currentCredits} 积分。您可以联系管理员充值，或在「设置」中配置自己的 API Key 免积分使用！`,
          required: creditCost,
          current: currentCredits,
        });
      }

      // 预扣积分
      db.prepare('UPDATE users SET credits = credits - ? WHERE id=?').run(creditCost, req.user!.userId);
      log('CREDITS', `🪙 用户 [${req.user!.username}] 扣除 ${creditCost} 积分 (模型: ${model}, 余额: ${currentCredits - creditCost})`);
    }

    const id = randomUUID();
    const now = Date.now();
    const insert = db.prepare(
      'INSERT INTO tasks(id,user_id,kind,status,prompt,params_json,credits_cost,created_at) VALUES(?,?,?,?,?,?,?,?)'
    );
    insert.run(id, req.user!.userId, 'image', 'running', prompt, JSON.stringify({ ratio, model, refCount: refAssets.length }), creditCost, now);

    try {
      const result = await runImageTask(cfg, prompt, ratio, model, refAssets);
      const filename = `${id}${result.ext}`;
      const path = join(mediaDir, filename);
      // 原子写入主图（防崩溃半截文件）
      await atomicWriteFile(path, result.buffer);
      // 并行生成缩略图与尺寸信息
      const [thumb, dims] = await Promise.all([
        createListThumbnail(result.buffer),
        imageDimensions(result.buffer),
      ]);
      if (thumb) {
        await atomicWriteFile(join(mediaDir, `${id}_thumb.jpg`), thumb);
      }
      const paramsJson = JSON.stringify({
        ratio,
        model,
        refCount: refAssets.length,
        ...(dims ? { width: dims.width, height: dims.height } : {}),
        ...(thumb ? { hasThumb: true } : {}),
      });
      db.prepare('UPDATE tasks SET status=?, result_path=?, params_json=?, done_at=? WHERE id=?').run('done', filename, paramsJson, Date.now(), id);
      const task = getTask(db, id);
      log('TASK', `🎉 任务完成并落盘 [ID: ${id}] -> ${filename} (${(result.buffer.length / 1024).toFixed(1)} KB${thumb ? `, 缩略图 ${(thumb.length / 1024).toFixed(1)} KB` : ''}, 消耗 ${creditCost} 积分)`);
      
      const latestUser = db.prepare('SELECT credits FROM users WHERE id=?').get(req.user!.userId) as any;
      return {
        ...task,
        resultUrl: `/media/${filename}`,
        userCredits: isAdmin ? 999999 : (latestUser?.credits ?? 0),
        isCustomGateway,
      };
    } catch (e: any) {
      const errMsg = String(e?.message ?? e);
      db.prepare('UPDATE tasks SET status=?, error=?, done_at=? WHERE id=?').run('failed', errMsg, Date.now(), id);
      
      // 任务失败，为非免扣用户自动原路返还积分
      if (!isFree) {
        db.prepare('UPDATE users SET credits = credits + ? WHERE id=?').run(creditCost, req.user!.userId);
        const refUser = db.prepare('SELECT credits FROM users WHERE id=?').get(req.user!.userId) as any;
        log('CREDITS', `🔄 任务失败，已自动向用户 [${req.user!.username}] 返还 ${creditCost} 积分 (当前余额: ${refUser?.credits})`);
      }
      
      logError('TASK', `💥 生图任务失败 [ID: ${id}]`, errMsg);
      const latestUser = db.prepare('SELECT credits FROM users WHERE id=?').get(req.user!.userId) as any;
      return {
        ...getTask(db, id),
        resultUrl: null,
        userCredits: isAdmin ? 999999 : (latestUser?.credits ?? 0),
        refunded: !isFree,
      };
    }
  });

  async function runImageTask(
    cfg: GatewayConfig,
    prompt: string,
    ratio: string,
    model: string,
    refAssets: string[],
  ): Promise<{ buffer: Buffer; ext: string }> {
    const refs = refAssets.map((a) => (a.startsWith('data:') ? a.split(',')[1] ?? '' : a)).filter(Boolean);
    const result = await generateImage(cfg, { prompt, ratio, model, refImagesB64: refs }, opts.upstreamFetch ?? fetch);
    if (result.b64) {
      return { buffer: Buffer.from(result.b64, 'base64'), ext: '.png' };
    }
    if (result.url) {
      log('TASK', `⬇️ 下载上游图片结果: ${result.url}`);
      const res = await (opts.upstreamFetch ?? fetch)(result.url);
      if (!res.ok) throw new Error(`下载生成结果失败: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const ext = extname(new URL(result.url).pathname) || '.png';
      return { buffer: buf, ext };
    }
    throw new Error('未获取到图片');
  }

  function getTask(db: Db, id: string) {
    const row = db.prepare('SELECT * FROM tasks WHERE id=?').get(id) as any;
    return row ? taskRowToApi(row) : null;
  }

  function taskRowToApi(row: any) {
    return {
      id: row.id,
      userId: row.user_id,
      kind: row.kind,
      status: row.status,
      prompt: row.prompt,
      params: JSON.parse(row.params_json || '{}'),
      resultUrl: row.result_path ? `/media/${row.result_path}` : null,
      error: row.error,
      creditsCost: row.credits_cost ?? 0,
      createdAt: row.created_at,
      doneAt: row.done_at,
    };
  }

  // ---- tasks 列表（仅返回当前用户的任务） ----
  app.get('/api/tasks', async (req) => {
    const since = Number((req.query as any).since ?? 0);
    const rows = db
      .prepare('SELECT * FROM tasks WHERE user_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 200')
      .all(req.user!.userId, since) as any[];
    return rows.map(taskRowToApi);
  });

  app.delete('/api/tasks/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = db.prepare('SELECT * FROM tasks WHERE id=?').get(id) as any;
    if (!row) return reply.code(404).send({ error: 'not found' });

    // 权限隔离：只能删自己的任务（admin 也可以删）
    if (row.user_id !== req.user!.userId && req.user!.role !== 'admin') {
      return reply.code(403).send({ error: '无权删除此作品' });
    }

    if (row.result_path) {
      await unlink(join(mediaDir, row.result_path)).catch(() => {});
    }
    db.prepare('DELETE FROM tasks WHERE id=?').run(id);
    log('TASK', `🗑️ 删除生图任务 [ID: ${id}] (操作者: ${req.user!.username})`);
    return { ok: true };
  });

  // ---- media（也走鉴权，见 preHandler）----
  app.get('/media/:file', async (req, reply) => {
    const { file } = req.params as { file: string };
    if (file.includes('..') || file.includes('/')) return reply.code(400).send({ error: 'bad file' });
    // ?thumb=1 → 优先返回缩略图（无缩略图时降级原图）
    const wantThumb = (req.query as any).thumb === '1';
    let actualFile = file;
    if (wantThumb) {
      const base = file.replace(/\.(png|jpg|jpeg|webp)$/i, '');
      const thumbFile = `${base}_thumb.jpg`;
      try {
        await readFile(join(mediaDir, thumbFile));
        actualFile = thumbFile;
      } catch {
        // 无缩略图，降级原图
      }
    }
    const path = join(mediaDir, actualFile);
    let buf: Buffer;
    try {
      buf = await readFile(path);
    } catch {
      return reply.code(404).send({ error: 'not found' });
    }
    const ext = extname(file).toLowerCase();
    const types: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
    };
    return reply.header('content-type', types[ext] ?? 'application/octet-stream').send(buf);
  });

  // ---- inspirations 灵感模板 ----
  app.get('/api/inspirations', async (req) => {
    const { category, q } = (req.query ?? {}) as { category?: string; q?: string };
    let rows = db
      .prepare('SELECT * FROM inspirations ORDER BY likes DESC, id ASC')
      .all() as any[];
    if (category && category !== '全部') rows = rows.filter((r) => r.category === category);
    if (q?.trim()) {
      const needle = q.trim().toLowerCase();
      rows = rows.filter((r) => `${r.title}${r.prompt}${r.tags}`.toLowerCase().includes(needle));
    }
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      prompt: r.prompt,
      category: r.category,
      tags: r.tags,
      cover: r.cover_path
        ? r.cover_path.startsWith('http')
          ? r.cover_path
          : `/media/${r.cover_path}`
        : null,
      likes: r.likes,
      isOwn: !!r.is_own,
    }));
  });

  app.post('/api/inspirations/:id/like', async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = db.prepare('UPDATE inspirations SET likes = likes + 1 WHERE id=?').run(id);
    if (!r.changes) return reply.code(404).send({ error: 'not found' });
    const row = db.prepare('SELECT likes FROM inspirations WHERE id=?').get(id) as any;
    return { likes: row.likes };
  });

  app.post('/api/inspirations', async (req, reply) => {
    const { title, prompt, category = '我的', coverFile } = (req.body ?? {}) as {
      title?: string;
      prompt?: string;
      category?: string;
      coverFile?: string;
    };
    if (!title?.trim() || !prompt?.trim()) return reply.code(400).send({ error: '标题和提示词不能为空' });
    let coverPath: string | null = null;
    if (coverFile) {
      const b64 = coverFile.startsWith('data:') ? coverFile.split(',')[1] : coverFile;
      const filename = `insp-${Date.now()}-${randomUUID().slice(0, 8)}.png`;
      await writeFile(join(mediaDir, filename), Buffer.from(b64, 'base64'));
      coverPath = filename;
    }
    const r = db
      .prepare(
        'INSERT INTO inspirations(title,prompt,category,tags,cover_path,source,is_own,created_at) VALUES(?,?,?,?,?,?,1,?)'
      )
      .run(title.trim(), prompt.trim(), category, '', coverPath, 'own', Date.now());
    return { id: Number(r.lastInsertRowid) };
  });

  app.get('/health', async () => ({ ok: true }));

  (app as any).db = db;
  return app;
}
