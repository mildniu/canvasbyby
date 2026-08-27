import { useState, useEffect } from 'react';
import { Server, Key, Check, AlertCircle, Loader2, Sparkles, Coins, RotateCcw } from 'lucide-react';
import { api, type Settings } from '../lib/api';
import { useApp } from '../stores/app';

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

  const loadSettings = () => {
    api.getSettings().then((s: Settings) => {
      setBaseUrl(s.baseUrl);
      setMasked(s.apiKey);
      setIsCustom(!!s.isCustom);
    });
  };

  useEffect(() => {
    loadSettings();
  }, []);

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

  const isAdmin = user?.role === 'admin';

  return (
    <div className="mx-auto min-h-screen w-full max-w-[800px] px-4 pb-16 pt-10 sm:px-8">
      <header className="mb-8">
        <h1 className="text-[28px] font-medium text-neutral-950">设置</h1>
        <p className="mt-2 text-sm text-neutral-500">
          配置你的中转站网关与 API Key。所有支持的模型（GPT / Qwen / Gemini / Grok）均可即刻调用。
        </p>
      </header>

      {/* 专属接口免积分状态提示卡片 */}
      {!isAdmin && (
        <div
          className={`mb-6 rounded-[20px] p-5 border transition ${
            isCustom
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              : 'bg-sky-50/80 border-sky-200 text-sky-950'
          }`}
        >
          <div className="flex items-start gap-3.5">
            <div
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                isCustom ? 'bg-emerald-500 text-white' : 'bg-sky-500 text-white'
              }`}
            >
              {isCustom ? <Sparkles size={18} /> : <Coins size={18} />}
            </div>
            <div className="flex-1 text-sm">
              <h3 className="font-semibold text-base">
                {isCustom ? '已启用专属接口（免积分特权）' : '当前使用平台共享接口'}
              </h3>
              <p className="mt-1 leading-relaxed text-xs opacity-90">
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

      <div className="rounded-[20px] border border-neutral-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-900">
              <span className="flex items-center gap-1.5">
                <Server size={16} className="text-neutral-500" />
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
            <p className="mt-1.5 text-xs text-neutral-400">
              OpenAI 兼容中转站 Base URL，末尾无需加 /v1。
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-900">
              <span className="flex items-center gap-1.5">
                <Key size={16} className="text-neutral-500" />
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
            <p className="mt-1.5 text-xs text-neutral-400">
              个人 Key 使用 AES-256-GCM 独立强加密存储，多用户相互物理隔离。
            </p>
          </div>

          {msg && (
            <div
              className={`flex items-center gap-2 rounded-[12px] p-3 text-sm ${
                msg.kind === 'ok'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {msg.kind === 'ok' ? <Check size={16} /> : <AlertCircle size={16} />}
              <span>{msg.text}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 items-center justify-center rounded-[12px] bg-neutral-950 px-6 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : '保存配置'}
              </button>

              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !baseUrl.trim()}
                className="inline-flex h-11 items-center justify-center rounded-[12px] border border-neutral-200 bg-white px-6 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-50 cursor-pointer"
              >
                {testing ? <Loader2 size={16} className="animate-spin" /> : '测试连接'}
              </button>
            </div>

            {!isAdmin && isCustom && (
              <button
                type="button"
                onClick={handleResetCustom}
                disabled={resetting}
                className="inline-flex h-11 items-center gap-1.5 rounded-[12px] border border-neutral-200 bg-neutral-50 px-4 text-xs font-medium text-neutral-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw size={14} />
                {resetting ? '恢复中…' : '恢复使用平台共享接口'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
