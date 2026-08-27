import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../stores/app';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const setUser = useApp((s) => s.setUser);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.login({ username: username.trim(), password });
      setUser(res.user);
      nav('/create/image', { replace: true });
    } catch (err: any) {
      setError(err?.message ?? '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fdfdfd] p-4">
      <div className="w-full max-w-sm rounded-[28px] border border-neutral-200 bg-white p-8 shadow-[0_18px_55px_rgba(15,23,42,.08)]">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/logo.png" alt="老牛创意生成" className="h-14 w-14 rounded-2xl shadow-sm mb-3" />
          <h1 className="text-xl font-medium tracking-tight text-neutral-950">老牛 创意生成</h1>
          <p className="mt-1 text-xs text-neutral-400">
            请输入账号与密码登录
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3.5">
          <div className="relative">
            <User size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用户名"
              autoFocus
              className="h-11 w-full rounded-[14px] border border-neutral-200 bg-neutral-50 pl-10 pr-3.5 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white"
            />
          </div>

          <div className="relative">
            <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="访问密码"
              className="h-11 w-full rounded-[14px] border border-neutral-200 bg-neutral-50 pl-10 pr-3.5 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white"
            />
          </div>

          {error && <p className="text-center text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-neutral-950 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <span>进入工作台</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 border-t border-neutral-100 pt-4 text-center text-xs text-neutral-400">
          账号由管理员分配，如需开通请联系管理员
        </div>
      </div>
    </div>
  );
}
