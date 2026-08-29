import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import './index.css';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import CreatePage from './pages/CreatePage';
import InspirationPage from './pages/InspirationPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminTasksPage from './pages/AdminTasksPage';
import { useApp } from './stores/app';

function Guard({ children }: { children: React.ReactNode }) {
  const authed = useApp((s) => s.authed);
  const checkAuth = useApp((s) => s.checkAuth);

  React.useEffect(() => {
    if (authed === null) checkAuth();
  }, [authed, checkAuth]);

  if (authed === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-white text-sm text-neutral-400">
        加载中…
      </div>
    );
  }
  if (!authed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const user = useApp((s) => s.user);
  if (user && user.role !== 'admin') {
    return <Navigate to="/create/image" replace />;
  }
  return <>{children}</>;
}

window.addEventListener('auth:expired', () => useApp.getState().setAuthed(false));

// ---- Android 原生能力初始化（网页端自动跳过） ----
async function initNative() {
  if (!(window as any).Capacitor?.isNativePlatform?.()) return;
  try {
    const { App: CapApp } = await import('@capacitor/app');
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    const { SplashScreen } = await import('@capacitor/splash-screen');

    // 状态栏：白底黑字，与页面风格一致
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#FFFFFF' }).catch(() => {});

    // Android 返回键：由页面通过自定义事件声明“已消费”（关闭弹窗等），未消费则走 WebView 历史
    CapApp.addListener('backButton', () => {
      const consumed = window.dispatchEvent(new CustomEvent('app:back', { cancelable: true, detail: { source: 'native' } }));
      if (!consumed) {
        CapApp.minimizeApp();
      }
    });

    // 启动页在首屏渲染完成后隐藏
    setTimeout(() => SplashScreen.hide().catch(() => {}), 600);
  } catch {
    /* 原生环境异常时静默降级 */
  }
}
initNative();

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <Guard>
        <Layout />
      </Guard>
    ),
    children: [
      { index: true, element: <Navigate to="/create/image" replace /> },
      { path: 'create/image', element: <CreatePage /> },
      { path: 'inspiration', element: <InspirationPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'settings', element: <SettingsPage /> },
      {
        path: 'admin/users',
        element: (
          <AdminGuard>
            <AdminUsersPage />
          </AdminGuard>
        ),
      },
      {
        path: 'admin/tasks',
        element: (
          <AdminGuard>
            <AdminTasksPage />
          </AdminGuard>
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/create/image" replace /> },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
