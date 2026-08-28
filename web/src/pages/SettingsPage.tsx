import { useState, useEffect } from 'react';
import { Server, Key, Check, AlertCircle, Loader2, Sparkles, Coins, RotateCcw, ShieldCheck, ListChecks } from 'lucide-react';
import { api, type Settings, type ModelsResponse } from '../lib/api';
import { useApp } from '../stores/app';
import { cn } from '../lib/utils';

export default function SettingsPage() {
  const user = useApp((s) => s.user);
  const checkAuth = useApp((s) => s.checkAuth);

  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [masked, setMasked] = useState('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // 管理员模型白名单
  const [availableModels, setAvailableModels] = useState<{ value: string; cost: number }[]>([]);
  const [allowedModels, setAllowedModels] = useState<string[]>([]);
  const [savingModels, setSavingModels] = useState(false);
  const [modelsMsg, setModelsMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [modelQuery, setModelQuery] = useState('');

  // 管理员全局分辨率白名单
  const [globalResolutions, setGlobalResolutions] = useState<string[]>([]);
  const [savingResolutions, setSavingResolutions] = useState(false);

  const isAdmin = user?.role === 'admin';

  const loadSettings = () => {
    api.getSettings().then((s: Settings) => {
      setBaseUrl(s.baseUrl);
      setMasked(s.apiKey);
      setIsCustom(!!s.isCustom);
    });
  };

  // 管理员：加载网关可用模型与当前白名单
  const loadModelWhitelist = () => {
    if (!isAdmin) return;
    api.getModels().then((data: ModelsResponse) => {
      const list = (data.models ?? []).map((m) => ({
        value: m,
        cost: data.pricing?.[m] ?? 2,
      }));
      setAvailableModels(list);
    }).catch(() => {});
    api.adminGetAllowedModels().then((r) => {
      setAllowedModels(r.allowedModels ?? []);
    }).catch(() => {});
    api.adminGetAllowedResolutions().then((r) => {
      setGlobalResolutions(r.allowedResolutions ?? []);
    }).catch(() => {});
  };

  useEffect(() => {
    loadSettings();
    loadModelWhitelist();
  }, [isAdmin]);

  const toggleModel = (m: string) => {
    setAllowedModels((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const toggleResolution = (r: string) => {
    setGlobalResolutions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  };

  const saveResolutions = async () => {
    setSavingResolutions(true);
    try {
      await api.adminSetAllowedResolutions(globalResolutions);
      setModelsMsg({
        kind: 'ok',
        text: globalResolutions.length
          ? `已保存：普通用户仅可使用 ${globalResolutions.join(' / ')} 分辨率`
          : '已保存：不限制，普通用户可使用全部分辨率',
      });
    } catch (err: any) {
      setModelsMsg({ kind: 'err', text: err?.message ?? '保存失败' });
    } finally {
      setSavingResolutions(false);
    }
  };

  const saveWhitelist = async () => {
    setSavingModels(true);
    setModelsMsg(null);
    try {
      await api.adminSetAllowedModels(allowedModels);
      setModelsMsg({
        kind: 'ok',
        text: allowedModels.length
          ? `已保存：普通用户仅可使用 ${allowedModels.length} 个模型`
          : '已保存：不限制，普通用户可使用全部模型',
      });
    } catch (err: any) {
      setModelsMsg({ kind: 'err', text: err?.message ?? '保存失败' });
    } finally {
      setSavingModels(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const s = await api.saveSettings({
        baseUrl,
        ...(apiKey ? { apiKey } : {}),
      });
      setMasked(s.apiKey);
      setApiKey('');
      setIsCustom(!!s.isCustom);
      setMsg({ kind: 'ok', text: '网关配置已保存成功！' });
      checkAuth();
    } catch (err: any) {
      setMsg({ kind: 'err', text: err?.message ?? '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetCustom = async () => {
    if (!window.confirm('确定清除你的专属接口配置，并恢复使用平台默认共享接口吗？')) return;
    setResetting(true);
    setMsg(null);
    try {
      const s = await api.resetSettings();
      setBaseUrl(s.baseUrl);
      setMasked(s.apiKey);
      setApiKey('');
      setIsCustom(!!s.isCustom);
      setMsg({ kind: 'ok', text: '已恢复使用平台默认共享接口' });
      checkAuth();
    } catch (err: any) {
      setMsg({ kind: 'err', text: err?.message ?? '重置失败' });
    } finally {
      setResetting(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMsg(null);
    try {
      const r = await api.testSettings();
      setMsg({ kind: r.ok ? 'ok' : 'err', text: r.message });
    } catch (err: any) {
      setMsg({ kind: 'err', text: err?.message ?? '测试失败' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-[800px] px-3 pb-16 pt-6 sm:px-8 sm:pt-10">
      <header className="mb-5 sm:mb-8">
        <h1 className="text-[22px] font-medium text-neutral-950 sm:text-[28px]">设置</h1>
        <p className="mt-1.5 text-xs leading-5 text-neutral-500 sm:mt-2 sm:text-sm sm:leading-6">
          配置你的中转站网关与 API Key。所有支持的模型（GPT / Qwen / Gemini / Grok）均可即刻调用。
        </p>
      </header>

      {/* 专属接口免积分状态提示卡片 */}
      {!isAdmin && (
        <div
          className={`mb-5 rounded-[20px] p-4 border transition sm:mb-6 sm:p-5 ${
            isCustom
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              : 'bg-sky-50/80 border-sky-200 text-sky-950'
          }`}
        >
          <div className="flex items-start gap-3 sm:gap-3.5">
            <div
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl sm:h-9 sm:w-9 ${
                isCustom ? 'bg-emerald-500 text-white' : 'bg-sky-500 text-white'
              }`}
            >
              {isCustom ? <Sparkles size={16} /> : <Coins size={16} />}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <h3 className="text-[15px] font-semibold sm:text-base">
                {isCustom ? '已启用专属接口（免积分特权）' : '当前使用平台共享接口'}
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed opacity-90 sm:mt-1.5 sm:text-xs">
                {isCustom ? (
                  <>
                    您已配置个人专属网关与 Key，后续生成图片将<strong>直接通过您的专属接口运行，完全免费且不消耗任何平台积分！</strong>
                  </>
                ) : (
                  <>
                    您目前正在使用管理员配置的平台共享接口，每次生图将消耗平台积分（Qwen 1分，GPT/Gemini/Grok 2分）。<strong>如果您在下方填入自己的中转站 Base URL 和 API Key，生图将免除所有积分扣减！</strong>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-[20px] border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
        <form onSubmit={handleSave} className="space-y-5 sm:space-y-6">
          <div>
            <label className="mb-2 block text-[13px] font-medium text-neutral-900 sm:text-sm">
              <span className="flex items-center gap-1.5">
                <Server size={15} className="shrink-0 text-neutral-500 sm:size-4" />
                中转站网关地址（Base URL）
              </span>
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={isAdmin ? 'https://your-gateway.example.com' : '例如: https://api.openai.com 或 您的中转站地址'}
              className="h-11 w-full rounded-[12px] border border-neutral-200 bg-neutral-50 px-3.5 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white"
            />
            <p className="mt-1.5 text-[11px] text-neutral-400 sm:text-xs">
              OpenAI 兼容中转站 Base URL，末尾无需加 /v1。
            </p>
          </div>

          <div>
            <label className="mb-2 block text-[13px] font-medium text-neutral-900 sm:text-sm">
              <span className="flex items-center gap-1.5">
                <Key size={15} className="shrink-0 text-neutral-500 sm:size-4" />
                API Key
              </span>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={masked && (isCustom || isAdmin) ? `已配置: ${masked} (留空不修改)` : 'sk-...'}
              className="h-11 w-full rounded-[12px] border border-neutral-200 bg-neutral-50 px-3.5 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white"
            />
            <p className="mt-1.5 text-[11px] text-neutral-400 sm:text-xs">
              个人 Key 使用 AES-256-GCM 独立强加密存储，多用户相互物理隔离。
            </p>
          </div>

          {msg && (
            <div
              className={`flex items-start gap-2 rounded-[12px] p-3 text-[13px] leading-relaxed sm:text-sm ${
                msg.kind === 'ok'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {msg.kind === 'ok' ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
              <span>{msg.text}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-1 items-center gap-2.5 sm:flex-none sm:gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-[12px] bg-neutral-950 px-5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50 cursor-pointer sm:flex-none sm:px-6"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : '保存配置'}
              </button>

              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !baseUrl.trim()}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-[12px] border border-neutral-200 bg-white px-5 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-50 cursor-pointer sm:flex-none sm:px-6"
              >
                {testing ? <Loader2 size={16} className="animate-spin" /> : '测试连接'}
              </button>
            </div>

            {!isAdmin && isCustom && (
              <button
                type="button"
                onClick={handleResetCustom}
                disabled={resetting}
                className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-[12px] border border-neutral-200 bg-neutral-50 px-4 text-xs font-medium text-neutral-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 cursor-pointer sm:w-auto"
              >
                <RotateCcw size={14} className="shrink-0" />
                {resetting ? '恢复中…' : '恢复使用平台共享接口'}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* 管理员：模型白名单管理（限制普通用户可用的共享接口模型） */}
      {isAdmin && (
        <div className="mt-6 rounded-[20px] border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neutral-950 text-white">
              <ListChecks size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-semibold text-neutral-950 sm:text-base">普通用户可用模型</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-neutral-500 sm:text-xs">
                勾选允许普通用户（使用平台共享接口时）调用的生图模型；不勾选任何模型则不限制。
                管理员本人与配置了专属接口的用户始终不受限制。
              </p>
            </div>
          </div>

          {/* 搜索与统计 */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={modelQuery}
              onChange={(e) => setModelQuery(e.target.value)}
              placeholder="搜索模型..."
              className="h-9 min-w-[160px] flex-1 rounded-[10px] border border-neutral-200 bg-neutral-50 px-3 text-[13px] text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white"
            />
            <span className="text-[11px] text-neutral-400">
              已选 {allowedModels.length} / {availableModels.length} 个
              {allowedModels.length === 0 && '（不限制）'}
            </span>
            <button
              type="button"
              onClick={() => setAllowedModels(availableModels.map((m) => m.value))}
              className="h-9 rounded-[10px] border border-neutral-200 px-3 text-[11px] font-medium text-neutral-600 transition hover:bg-neutral-50 cursor-pointer"
            >
              全选
            </button>
            <button
              type="button"
              onClick={() => setAllowedModels([])}
              className="h-9 rounded-[10px] border border-neutral-200 px-3 text-[11px] font-medium text-neutral-600 transition hover:bg-neutral-50 cursor-pointer"
            >
              清空
            </button>
          </div>

          {/* 模型勾选列表 */}
          <div className="mt-3 max-h-[280px] overflow-y-auto rounded-[14px] border border-neutral-100 bg-neutral-50/50 p-2">
            {availableModels.length === 0 ? (
              <p className="py-6 text-center text-xs text-neutral-400">
                暂未拉取到模型列表，请先在上方保存网关配置
              </p>
            ) : (
              availableModels
                .filter((m) => m.value.toLowerCase().includes(modelQuery.trim().toLowerCase()))
                .map((m) => {
                  const checked = allowedModels.includes(m.value);
                  return (
                    <label
                      key={m.value}
                      className={cn(
                        'flex cursor-pointer items-center justify-between gap-2 rounded-[10px] px-3 py-2 transition',
                        checked ? 'bg-white shadow-sm border border-neutral-200' : 'hover:bg-white/70 border border-transparent'
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleModel(m.value)}
                          className="h-4 w-4 shrink-0 cursor-pointer accent-neutral-900"
                        />
                        <span className="truncate text-[13px] text-neutral-800">{m.value}</span>
                      </span>
                      <span className="shrink-0 rounded bg-sky-100/80 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                        {m.cost} 积分
                      </span>
                    </label>
                  );
                })
            )}
          </div>

          {modelsMsg && (
            <div
              className={cn(
                'mt-3 flex items-start gap-2 rounded-[12px] p-3 text-[13px]',
                modelsMsg.kind === 'ok'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              )}
            >
              {modelsMsg.kind === 'ok' ? (
                <ShieldCheck size={16} className="mt-0.5 shrink-0" />
              ) : (
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
              )}
              <span>{modelsMsg.text}</span>
            </div>
          )}

          <button
            type="button"
            onClick={saveWhitelist}
            disabled={savingModels}
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[12px] bg-neutral-950 px-5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50 cursor-pointer sm:w-auto"
          >
            {savingModels ? <Loader2 size={15} className="animate-spin" /> : '保存模型白名单'}
          </button>

          {/* 全局默认分辨率白名单 */}
          <div className="mt-5 border-t border-neutral-100 pt-4">
            <p className="text-sm font-semibold text-neutral-950">普通用户可用分辨率（全局默认）</p>
            <p className="mt-1 text-xs text-neutral-500">
              勾选允许普通用户（使用平台共享接口时）使用的分辨率档位；不勾选任何档位则不限制。
              可在「用户管理」中对单个用户单独覆盖。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['1K', '2K', '4K'].map((r) => {
                const checked = globalResolutions.includes(r);
                return (
                  <label
                    key={r}
                    className={cn(
                      'flex h-10 w-[84px] cursor-pointer items-center justify-center gap-2 rounded-[12px] border text-sm transition',
                      checked
                        ? 'border-violet-500 bg-violet-50 font-semibold text-violet-800'
                        : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleResolution(r)}
                      className="h-4 w-4 cursor-pointer accent-violet-700"
                    />
                    {r}
                  </label>
                );
              })}
            </div>

            <button
              type="button"
              onClick={saveResolutions}
              disabled={savingResolutions}
              className="mt-3 inline-flex h-9 items-center justify-center rounded-[10px] border border-neutral-300 px-4 text-xs font-medium text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-50 cursor-pointer"
            >
              {savingResolutions ? <Loader2 size={13} className="animate-spin" /> : '保存分辨率白名单'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
