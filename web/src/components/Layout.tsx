import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Image as ImageIcon,
  Sparkles,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Users as UsersIcon,
  ClipboardList as ClipboardListIcon,
  LogOut,
  Menu,
  X,
  User as UserIcon,
  Coins,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { apiUrl } from '../lib/config';
import { useApp } from '../stores/app';

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const nav = useNavigate();
  const user = useApp((s) => s.user);
  const setAuthed = useApp((s) => s.setAuthed);

  // Android 返回键：移动抽屉打开时优先关闭抽屉（消费返回事件）
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleBack = () => {
      setMobileMenuOpen(false);
    };
    window.addEventListener('app:back', handleBack);
    return () => window.removeEventListener('app:back', handleBack);
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' }).catch(() => {});
    setAuthed(false);
    nav('/login');
  };

  const navMain = [
    { to: '/create/image', label: '图片', icon: ImageIcon },
    { to: '/inspiration', label: '灵感', icon: Sparkles },
    { to: '/history', label: '历史', icon: HistoryIcon },
  ];

  const navBottom = [
    ...(user?.role === 'admin'
      ? [
          { to: '/admin/users', label: '用户管理', icon: UsersIcon },
          { to: '/admin/tasks', label: '全部记录', icon: ClipboardListIcon },
        ]
      : []),
    { to: '/settings', label: '设置', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-full bg-white text-neutral-950 flex flex-col" style={{ paddingTop: 'var(--app-safe-top, 0px)', paddingBottom: 'var(--app-safe-bottom, 0px)' }}>
      {/* 桌面端左侧 Rail 窄侧边栏 (w-14 = 56px) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-14 border-r border-neutral-200 bg-white lg:flex lg:flex-col lg:items-center" style={{ top: 'var(--app-safe-top, 0px)', bottom: 'var(--app-safe-bottom, 0px)' }}>
        <button
          type="button"
          onClick={() => nav('/create/image')}
          className="mt-3 grid h-9 w-9 place-items-center rounded-full hover:bg-neutral-100 transition"
          title="老牛 创意生成"
        >
          <img src="/logo.png" alt="老牛" className="h-7 w-7 rounded-lg" />
        </button>

        <nav className="mt-6 flex flex-1 flex-col items-center gap-2">
          {navMain.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'grid h-10 w-10 place-items-center rounded-full text-neutral-600 transition',
                    isActive ? 'bg-neutral-950 text-white shadow-sm' : 'hover:bg-neutral-100 hover:text-neutral-950'
                  )
                }
                title={item.label}
              >
                <Icon size={18} />
              </NavLink>
            );
          })}
        </nav>

        <div className="mb-3 flex flex-col items-center gap-2">
          {navBottom.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'grid h-10 w-10 place-items-center rounded-full text-neutral-600 transition',
                    isActive ? 'bg-neutral-950 text-white shadow-sm' : 'hover:bg-neutral-100 hover:text-neutral-950'
                  )
                }
                title={item.label}
              >
                <Icon size={18} />
              </NavLink>
            );
          })}
          <button
            type="button"
            onClick={handleLogout}
            className="grid h-10 w-10 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
            title="退出登录"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* 顶部 Header (h-14 = 56px) */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-neutral-200 bg-white/95 px-2.5 backdrop-blur sm:gap-3 sm:px-3 lg:ml-14 lg:px-6">
        <button
          type="button"
          aria-label={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-neutral-700 hover:bg-neutral-100 lg:hidden"
        >
          {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>

        <button
          type="button"
          onClick={() => nav('/create/image')}
          className="flex items-center gap-2 rounded-full px-1 py-1 text-left"
        >
          <img src="/logo.png" alt="老牛" className="h-7 w-7 rounded-lg" />
          {/* 手机端顶栏空间有限，隐藏品牌全称，仅保留 Logo 图标；桌面端完整显示 */}
          <span className="hidden text-[15px] font-medium tracking-tight text-neutral-950 sm:inline">
            老牛 创意生成
          </span>
        </button>

        <nav className="ml-4 hidden min-w-0 flex-1 items-center gap-1.5 overflow-x-auto lg:flex">
          {navMain.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'rounded-full px-3.5 py-1.5 text-sm font-normal transition',
                  isActive ? 'bg-neutral-100 text-neutral-950 font-medium' : 'text-neutral-500 hover:text-neutral-950 hover:bg-neutral-50'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
          {user?.role === 'admin' && (
            <NavLink
              to="/admin/users"
              className={({ isActive }) =>
                cn(
                  'rounded-full px-3.5 py-1.5 text-sm font-normal transition',
                  isActive ? 'bg-neutral-100 text-neutral-950 font-medium' : 'text-neutral-500 hover:text-neutral-950 hover:bg-neutral-50'
                )
              }
            >
              用户管理
            </NavLink>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
          {/* 用户信息徽章：手机端精简为图标+用户名，避免溢出 */}
          <div className="flex max-w-[38vw] items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-[11px] text-neutral-700 sm:max-w-none sm:gap-1.5 sm:px-3 sm:text-xs">
            <UserIcon size={12} className="shrink-0 text-neutral-500" />
            <span className="truncate font-medium">{user?.username || '用户'}</span>
            {user?.role === 'admin' && (
              <span className="hidden shrink-0 rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-medium text-white sm:inline">
                管理员
              </span>
            )}
          </div>

          {/* 积分徽章：手机端紧凑显示 */}
          <div
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition shadow-sm sm:gap-1.5 sm:px-2.5 sm:text-xs',
              user?.role === 'admin'
                ? 'bg-amber-50 text-amber-800 border border-amber-200/60'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
            )}
            title={user?.role === 'admin' ? '管理员不受积分限制' : `当前剩余 ${user?.credits ?? 0} 积分`}
          >
            <Coins
              size={12}
              className={cn('shrink-0', user?.role === 'admin' ? 'text-amber-600' : 'text-emerald-600')}
            />
            <span className="whitespace-nowrap">
              {user?.role === 'admin' ? '无限积分' : `${user?.credits ?? 0} 积分`}
            </span>
          </div>

          <NavLink
            to="/settings"
            className="hidden sm:inline-flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950"
          >
            <SettingsIcon size={13} />
            设置网关
          </NavLink>

          <button
            type="button"
            onClick={handleLogout}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 sm:h-9 sm:w-9"
            title="退出"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* 移动端滑出抽屉菜单 */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 flex w-[min(82vw,320px)] flex-col border-r border-neutral-200 bg-white p-4 shadow-2xl lg:hidden" style={{ top: 'var(--app-safe-top, 0px)', bottom: 'var(--app-safe-bottom, 0px)' }}>
            <div className="flex h-12 items-center justify-between border-b border-neutral-100 pb-2">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="老牛" className="h-7 w-7 rounded-lg" />
                <span className="text-sm font-semibold">老牛 创意生成</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-1">
              {[...navMain, ...navBottom].map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                        isActive ? 'bg-neutral-950 font-medium text-white' : 'text-neutral-600 hover:bg-neutral-100'
                      )
                    }
                  >
                    <Icon size={18} />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>

            <div className="mt-auto pt-4 border-t border-neutral-100">
              <div className="mb-2 flex items-center justify-between px-3 py-1 text-xs text-neutral-500">
                <span>用户: <span className="font-medium text-neutral-900">{user?.username}</span></span>
                <span className={cn('font-medium', user?.role === 'admin' ? 'text-amber-600' : 'text-emerald-600')}>
                  {user?.role === 'admin' ? '无限积分' : `${user?.credits ?? 0} 积分`}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-red-600"
              >
                <LogOut size={18} />
                退出登录
              </button>
            </div>
          </div>
        </>
      )}

      {/* 主视图区域 */}
      <main className="flex-1 lg:ml-14 pb-16 lg:pb-0">
        <Outlet />
      </main>

      {/* 移动端底部 Tab 栏 */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 flex border-t border-neutral-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        {[...navMain, ...navBottom].map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] transition',
                  isActive ? 'text-neutral-950 font-medium' : 'text-neutral-400'
                )
              }
            >
              <Icon size={18} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
