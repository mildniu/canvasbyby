import { useState, useEffect } from 'react';
import { UserPlus, Trash2, KeyRound, Shield, Ban, CheckCircle2, RefreshCw, X, Coins, Plus, Minus, ListChecks } from 'lucide-react';
import { cn } from '../lib/utils';
import { api, type User } from '../lib/api';

interface ModelsWhitelistModalState {
  user: User;
  userAllowedModels: string[] | null; // null = 跟随全局默认
  globalAllowedModels: string[];
  availableModels: { value: string; cost: number }[];
  mode: 'inherit' | 'override';
  checked: string[];
  // 分辨率白名单（同一弹窗内管理）
  userAllowedResolutions: string[] | null;
  globalAllowedResolutions: string[];
  resMode: 'inherit' | 'override';
  resChecked: string[];
}

const ALL_RESOLUTIONS = ['1K', '2K', '4K'];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [resetModal, setResetModal] = useState<User | null>(null);
  const [creditsModal, setCreditsModal] = useState<User | null>(null);
  const [modelsModal, setModelsModal] = useState<ModelsWhitelistModalState | null>(null);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [newCredits, setNewCredits] = useState<number>(20);

  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [creditsVal, setCreditsVal] = useState<number>(20);
  const [actionLoading, setActionLoading] = useState(false);
  const [modelQuery, setModelQuery] = useState('');

  // 打开用户权限弹窗：拉取网关可用模型 + 该用户的模型/分辨率当前配置
  const openModelsModal = async (user: User) => {
    try {
      const [modelsRes, wlRes, resRes] = await Promise.all([
        api.getModels(),
        api.adminGetUserAllowedModels(user.id),
        api.adminGetUserAllowedResolutions(user.id),
      ]);
      setModelsModal({
        user,
        userAllowedModels: wlRes.userAllowedModels,
        globalAllowedModels: wlRes.globalAllowedModels,
        availableModels: (modelsRes.models ?? []).map((m) => ({
          value: m,
          cost: modelsRes.pricing?.[m] ?? 2,
        })),
        mode: wlRes.userAllowedModels ? 'override' : 'inherit',
        checked: wlRes.userAllowedModels ?? wlRes.globalAllowedModels ?? [],
        userAllowedResolutions: resRes.userAllowedResolutions,
        globalAllowedResolutions: resRes.globalAllowedResolutions,
        resMode: resRes.userAllowedResolutions ? 'override' : 'inherit',
        resChecked: resRes.userAllowedResolutions ?? resRes.globalAllowedResolutions ?? ALL_RESOLUTIONS,
      });
      setModelQuery('');
    } catch (err: any) {
      alert(err?.message ?? '加载配置失败');
    }
  };

  const toggleModel = (m: string) => {
    setModelsModal((prev) =>
      prev
        ? { ...prev, checked: prev.checked.includes(m) ? prev.checked.filter((x) => x !== m) : [...prev.checked, m] }
        : prev
    );
  };

  const handleSaveUserModels = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelsModal || actionLoading) return;
    setActionLoading(true);
    try {
      // 保存模型白名单
      if (modelsModal.mode === 'inherit') {
        await api.adminSetUserAllowedModels(modelsModal.user.id, { mode: 'inherit' });
      } else {
        await api.adminSetUserAllowedModels(modelsModal.user.id, { allowedModels: modelsModal.checked });
      }
      // 保存分辨率白名单
      if (modelsModal.resMode === 'inherit') {
        await api.adminSetUserAllowedResolutions(modelsModal.user.id, { mode: 'inherit' });
      } else {
        await api.adminSetUserAllowedResolutions(modelsModal.user.id, {
          allowedResolutions: modelsModal.resChecked,
        });
      }
      setModelsModal(null);
      loadUsers();
    } catch (err: any) {
      alert(err?.message ?? '保存失败');
    } finally {
      setActionLoading(false);
    }
  };

  const loadUsers = () => {
    setLoading(true);
    api
      .adminListUsers()
      .then(setUsers)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim() || actionLoading) return;
    setActionLoading(true);
    try {
      await api.adminCreateUser({
        username: newUsername.trim(),
        password: newPassword.trim(),
        role: newRole,
        credits: Number(newCredits) || 20,
      });
      setCreateModal(false);
      setNewUsername('');
      setNewPassword('');
      setNewCredits(20);
      loadUsers();
    } catch (err: any) {
      alert(err?.message ?? '创建用户失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModal || !resetPasswordVal.trim() || actionLoading) return;
    setActionLoading(true);
    try {
      await api.adminUpdateUser(resetModal.id, { password: resetPasswordVal.trim() });
      setResetModal(null);
      setResetPasswordVal('');
      alert('重置密码成功');
    } catch (err: any) {
      alert(err?.message ?? '重置密码失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditsModal || actionLoading) return;
    const finalAmount = Math.max(0, Math.floor(Number(creditsVal)));
    setActionLoading(true);
    try {
      await api.adminUpdateUser(creditsModal.id, { credits: finalAmount });
      setCreditsModal(null);
      loadUsers();
    } catch (err: any) {
      alert(err?.message ?? '设置积分失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    const nextStatus = user.status === 1 ? 0 : 1;
    const msg = nextStatus === 0 ? `确定禁用用户「${user.username}」吗？` : `确定解禁用户「${user.username}」吗？`;
    if (!window.confirm(msg)) return;
    try {
      await api.adminUpdateUser(user.id, { status: nextStatus });
      loadUsers();
    } catch (err: any) {
      alert(err?.message ?? '操作失败');
    }
  };

  const handleToggleRole = async (user: User) => {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    if (!window.confirm(`确定将用户「${user.username}」的角色调整为 ${nextRole} 吗？`)) return;
    try {
      await api.adminUpdateUser(user.id, { role: nextRole });
      loadUsers();
    } catch (err: any) {
      alert(err?.message ?? '调整角色失败');
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`警告：确定彻底删除用户「${user.username}」吗？其关联的配置和生图任务都将被清理。`)) return;
    try {
      await api.adminDeleteUser(user.id);
      loadUsers();
    } catch (err: any) {
      alert(err?.message ?? '删除失败');
    }
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1100px] px-3 pb-16 pt-6 sm:px-8 sm:pt-10">
      <header className="mb-5 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-[22px] font-medium text-neutral-950 sm:text-[28px]">用户管理</h1>
          <p className="mt-1.5 text-xs leading-5 text-neutral-500 sm:mt-2 sm:text-sm sm:leading-6">
            查看所有系统用户、分配管理员权限、充值/设置积分余额、重置密码或停用账号。
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-3 text-[13px] text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-50 cursor-pointer sm:gap-2 sm:px-3.5 sm:text-sm"
          >
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
            刷新
          </button>
          <button
            type="button"
            onClick={() => {
              setNewCredits(20);
              setCreateModal(true);
            }}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-neutral-950 px-3.5 text-[13px] font-medium text-white transition hover:bg-neutral-800 cursor-pointer sm:gap-2 sm:px-4 sm:text-sm"
          >
            <UserPlus size={15} className="shrink-0" />
            <span className="whitespace-nowrap">添加用户</span>
          </button>
        </div>
      </header>

      {/* 用户表格 */}
      <div className="overflow-hidden rounded-[20px] border border-neutral-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[13px] text-neutral-700 sm:text-sm">
            <thead className="border-b border-neutral-100 bg-neutral-50 text-[11px] font-medium text-neutral-400 sm:text-xs">
              <tr>
                <th className="px-4 py-3 sm:px-6 sm:py-4">用户名</th>
                <th className="px-4 py-3 sm:px-6 sm:py-4">角色</th>
                <th className="px-4 py-3 sm:px-6 sm:py-4">积分余额</th>
                <th className="px-4 py-3 sm:px-6 sm:py-4">模型权限</th>
                <th className="px-4 py-3 sm:px-6 sm:py-4">状态</th>
                <th className="hidden px-4 py-3 sm:table-cell sm:px-6 sm:py-4">注册时间</th>
                <th className="px-4 py-3 text-right sm:px-6 sm:py-4">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {users.map((u) => {
                const isAdmin = u.role === 'admin';
                const isActive = u.status === 1;
                return (
                  <tr key={u.id} className="transition hover:bg-neutral-50/70">
                    <td className="px-4 py-3 font-medium text-neutral-950 sm:px-6 sm:py-4">{u.username}</td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium sm:px-2.5 sm:text-xs ${
                          isAdmin ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {isAdmin && <Shield size={11} className="shrink-0" />}
                        {isAdmin ? '管理员' : '用户'}
                      </span>
                    </td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4">
                      {isAdmin ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200/60 sm:px-2.5 sm:text-xs">
                          <Coins size={12} className="shrink-0 text-amber-600" />
                          无限积分
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-neutral-900 sm:text-sm">
                            <Coins size={13} className="shrink-0 text-amber-500" />
                            {u.credits ?? 0}
                            <span className="text-[11px] font-normal text-neutral-400 sm:text-xs">分</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setCreditsModal(u);
                              setCreditsVal(u.credits ?? 20);
                            }}
                            className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 cursor-pointer transition"
                          >
                            充值
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4">
                      {isAdmin ? (
                        <span className="text-[11px] text-neutral-400 sm:text-xs">不受限</span>
                      ) : u.userAllowedModels ? (
                        <button
                          type="button"
                          onClick={() => openModelsModal(u)}
                          className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 border border-sky-200/60 hover:bg-sky-100 transition cursor-pointer"
                          title={u.userAllowedModels.join('、')}
                        >
                          <ListChecks size={11} className="shrink-0" />
                          {u.userAllowedModels.length} 个模型
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openModelsModal(u)}
                          className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500 hover:bg-neutral-200 transition cursor-pointer"
                        >
                          跟随全局
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] sm:text-xs ${
                          isActive ? 'text-emerald-600' : 'text-red-500'
                        }`}
                      >
                        {isActive ? <CheckCircle2 size={13} className="shrink-0" /> : <Ban size={13} className="shrink-0" />}
                        {isActive ? '正常' : '已停用'}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-[11px] text-neutral-400 sm:table-cell sm:px-6 sm:py-4 sm:text-xs">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-right sm:px-6 sm:py-4">
                      <div className="flex items-center justify-end gap-0.5 sm:gap-1.5">
                        {!isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setCreditsModal(u);
                                setCreditsVal(u.credits ?? 20);
                              }}
                              title="设置积分"
                              className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-amber-50 hover:text-amber-700 cursor-pointer"
                            >
                              <Coins size={15} className="shrink-0" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openModelsModal(u)}
                              title="模型权限（限制该用户可用的模型）"
                              className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-sky-50 hover:text-sky-700 cursor-pointer"
                            >
                              <ListChecks size={15} className="shrink-0" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => setResetModal(u)}
                          title="修改密码"
                          className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 cursor-pointer"
                        >
                          <KeyRound size={15} className="shrink-0" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleRole(u)}
                          title={isAdmin ? '降为普通用户' : '设为管理员'}
                          className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 cursor-pointer"
                        >
                          <Shield size={15} className="shrink-0" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(u)}
                          title={isActive ? '禁用用户' : '启用用户'}
                          className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-amber-600 cursor-pointer"
                        >
                          <Ban size={15} className="shrink-0" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u)}
                          title="删除用户"
                          className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 size={15} className="shrink-0" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 创建新用户 Modal */}
      {createModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setCreateModal(false)}
        >
          <div
            className="w-full max-w-md rounded-[24px] border border-neutral-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-base font-semibold text-neutral-950">添加新用户</h3>
              <button
                type="button"
                onClick={() => setCreateModal(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 hover:bg-neutral-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-700">用户名</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="3-20 位用户名"
                  className="h-10 w-full rounded-[12px] border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-950 outline-none focus:border-neutral-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-700">初始密码</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少 6 位"
                  className="h-10 w-full rounded-[12px] border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-950 outline-none focus:border-neutral-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-700">分配角色</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="h-10 w-full rounded-[12px] border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-950 outline-none focus:border-neutral-900 focus:bg-white"
                >
                  <option value="user">普通用户 (消耗积分)</option>
                  <option value="admin">管理员 (无限积分)</option>
                </select>
              </div>

              {newRole === 'user' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-700">初始积分</label>
                  <input
                    type="number"
                    min={0}
                    value={newCredits}
                    onChange={(e) => setNewCredits(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="默认 20 积分"
                    className="h-10 w-full rounded-[12px] border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-950 outline-none focus:border-neutral-900 focus:bg-white"
                  />
                  <p className="mt-1 text-[11px] text-neutral-400">系统默认赠送 20 积分，可按需为该用户调整初始额度。</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModal(false)}
                  className="rounded-[10px] border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-[10px] bg-neutral-950 px-5 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? '创建中…' : '确认创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 设置用户积分 / 充值 Modal */}
      {creditsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setCreditsModal(null)}
        >
          <div
            className="w-full max-w-md rounded-[24px] border border-neutral-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-amber-50 text-amber-600">
                  <Coins size={16} />
                </div>
                <h3 className="text-base font-semibold text-neutral-950">
                  为用户「{creditsModal.username}」设置积分
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreditsModal(null)}
                className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 hover:bg-neutral-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateCredits} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-700">积分余额</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    required
                    value={creditsVal}
                    onChange={(e) => setCreditsVal(Math.max(0, parseInt(e.target.value) || 0))}
                    className="h-11 w-full rounded-[12px] border border-neutral-200 bg-neutral-50 px-3 pr-12 text-base font-semibold text-neutral-950 outline-none focus:border-neutral-900 focus:bg-white"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-neutral-400">
                    积分
                  </span>
                </div>
              </div>

              {/* 快捷增减与预设按钮 */}
              <div>
                <span className="mb-2 block text-xs font-normal text-neutral-500">快捷操作：</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setCreditsVal((v) => v + 10)}
                    className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                  >
                    <Plus size={12} /> 10
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreditsVal((v) => v + 50)}
                    className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                  >
                    <Plus size={12} /> 50
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreditsVal((v) => v + 100)}
                    className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                  >
                    <Plus size={12} /> 100
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreditsVal(20)}
                    className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 cursor-pointer"
                  >
                    重置为 20
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreditsVal((v) => Math.max(0, v - 10))}
                    className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                  >
                    <Minus size={12} /> 10
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreditsModal(null)}
                  className="rounded-[10px] border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-[10px] bg-neutral-950 px-5 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? '保存中…' : '保存修改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 用户模型权限 Modal（限制该用户可用的生图模型） */}
      {modelsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setModelsModal(null)}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-[24px] border border-neutral-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-sky-50 text-sky-600">
                  <ListChecks size={16} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-950">
                    「{modelsModal.user.username}」的模型权限
                  </h3>
                  <p className="text-[11px] text-neutral-400">限制该用户使用平台共享接口时可调用的模型</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModelsModal(null)}
                className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 hover:bg-neutral-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveUserModels} className="flex min-h-0 flex-1 flex-col overflow-hidden p-5">
              {/* 模式切换：跟随全局 / 单独配置 */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setModelsModal((prev) =>
                      prev ? { ...prev, mode: 'inherit', checked: prev.globalAllowedModels ?? [] } : prev
                    )
                  }
                  className={cn(
                    'rounded-[12px] border p-2.5 text-left transition cursor-pointer',
                    modelsModal.mode === 'inherit'
                      ? 'border-neutral-900 bg-neutral-950 text-white'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                  )}
                >
                  <p className="text-xs font-semibold">跟随全局默认</p>
                  <p className={cn('mt-0.5 text-[10px]', modelsModal.mode === 'inherit' ? 'text-white/70' : 'text-neutral-400')}>
                    {modelsModal.globalAllowedModels.length
                      ? `使用设置页的全局白名单（${modelsModal.globalAllowedModels.length} 个）`
                      : '当前全局不限制，可用全部模型'}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setModelsModal((prev) => (prev ? { ...prev, mode: 'override' } : prev))}
                  className={cn(
                    'rounded-[12px] border p-2.5 text-left transition cursor-pointer',
                    modelsModal.mode === 'override'
                      ? 'border-sky-600 bg-sky-50'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                  )}
                >
                  <p className="text-xs font-semibold">单独配置（优先级更高）</p>
                  <p className={cn('mt-0.5 text-[10px]', modelsModal.mode === 'override' ? 'text-sky-700' : 'text-neutral-400')}>
                    仅对该用户生效，覆盖全局设置
                  </p>
                </button>
              </div>

              {/* 模型勾选列表（仅单独配置模式可用） */}
              {modelsModal.mode === 'override' && (
                <div className="mt-4 flex min-h-0 flex-1 flex-col">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={modelQuery}
                      onChange={(e) => setModelQuery(e.target.value)}
                      placeholder="搜索模型..."
                      className="h-9 min-w-0 flex-1 rounded-[10px] border border-neutral-200 bg-neutral-50 px-3 text-[13px] text-neutral-950 outline-none focus:border-neutral-900 focus:bg-white"
                    />
                    <span className="shrink-0 text-[11px] text-neutral-400">
                      已选 {modelsModal.checked.length}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setModelsModal((prev) =>
                          prev ? { ...prev, checked: prev.availableModels.map((m) => m.value) } : prev
                        )
                      }
                      className="h-9 shrink-0 rounded-[10px] border border-neutral-200 px-3 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50 cursor-pointer"
                    >
                      全选
                    </button>
                    <button
                      type="button"
                      onClick={() => setModelsModal((prev) => (prev ? { ...prev, checked: [] } : prev))}
                      className="h-9 shrink-0 rounded-[10px] border border-neutral-200 px-3 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50 cursor-pointer"
                    >
                      清空
                    </button>
                  </div>

                  <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-[14px] border border-neutral-100 bg-neutral-50/50 p-2">
                    {modelsModal.availableModels.length === 0 ? (
                      <p className="py-6 text-center text-xs text-neutral-400">暂未拉取到模型列表</p>
                    ) : (
                      modelsModal.availableModels
                        .filter((m) => m.value.toLowerCase().includes(modelQuery.trim().toLowerCase()))
                        .map((m) => {
                          const checked = modelsModal.checked.includes(m.value);
                          return (
                            <label
                              key={m.value}
                              className={cn(
                                'flex cursor-pointer items-center justify-between gap-2 rounded-[10px] px-3 py-2 transition',
                                checked
                                  ? 'bg-white shadow-sm border border-neutral-200'
                                  : 'hover:bg-white/70 border border-transparent'
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
                  <p className="mt-1.5 text-[10px] text-neutral-400">
                    不勾选任何模型 = 该用户不限制，可用全部模型（专属接口与管理员始终不受限）
                  </p>
                </div>
              )}

              {/* 分辨率权限设置 */}
              <div className="mt-5 border-t border-neutral-100 pt-4">
                <p className="text-xs font-semibold text-neutral-900">分辨率权限</p>
                <p className="mt-0.5 text-[10px] text-neutral-400">限制该用户使用平台共享接口时可用的分辨率档位</p>

                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setModelsModal((prev) =>
                        prev
                          ? { ...prev, resMode: 'inherit', resChecked: prev.globalAllowedResolutions.length ? prev.globalAllowedResolutions : ALL_RESOLUTIONS }
                          : prev
                      )
                    }
                    className={cn(
                      'rounded-[12px] border p-2.5 text-left transition cursor-pointer',
                      modelsModal.resMode === 'inherit'
                        ? 'border-neutral-900 bg-neutral-950 text-white'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                    )}
                  >
                    <p className="text-xs font-semibold">跟随全局默认</p>
                    <p className={cn('mt-0.5 text-[10px]', modelsModal.resMode === 'inherit' ? 'text-white/70' : 'text-neutral-400')}>
                      {modelsModal.globalAllowedResolutions.length
                        ? `全局允许：${modelsModal.globalAllowedResolutions.join(' / ')}`
                        : '当前全局不限制'}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModelsModal((prev) => (prev ? { ...prev, resMode: 'override' } : prev))}
                    className={cn(
                      'rounded-[12px] border p-2.5 text-left transition cursor-pointer',
                      modelsModal.resMode === 'override'
                        ? 'border-violet-600 bg-violet-50'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                    )}
                  >
                    <p className="text-xs font-semibold">单独配置（优先级更高）</p>
                    <p className={cn('mt-0.5 text-[10px]', modelsModal.resMode === 'override' ? 'text-violet-700' : 'text-neutral-400')}>
                      仅对该用户生效，覆盖全局设置
                    </p>
                  </button>
                </div>

                {modelsModal.resMode === 'override' && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {ALL_RESOLUTIONS.map((r) => {
                      const checked = modelsModal.resChecked.includes(r);
                      return (
                        <label
                          key={r}
                          className={cn(
                            'flex h-9 w-[72px] cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border text-[13px] transition',
                            checked
                              ? 'border-violet-500 bg-violet-50 font-semibold text-violet-800'
                              : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setModelsModal((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      resChecked: checked
                                        ? prev.resChecked.filter((x) => x !== r)
                                        : [...prev.resChecked, r],
                                    }
                                  : prev
                              )
                            }
                            className="h-3.5 w-3.5 cursor-pointer accent-violet-700"
                          />
                          {r}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-2 border-t border-neutral-100 pt-3">
                <button
                  type="button"
                  onClick={() => setModelsModal(null)}
                  className="rounded-[10px] border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-[10px] bg-neutral-950 px-5 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? '保存中…' : '保存权限'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 修改/重置密码 Modal */}
      {resetModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setResetModal(null)}
        >
          <div
            className="w-full max-w-md rounded-[24px] border border-neutral-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-base font-semibold text-neutral-950">
                重置用户「{resetModal.username}」的密码
              </h3>
              <button
                type="button"
                onClick={() => setResetModal(null)}
                className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 hover:bg-neutral-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-700">新密码</label>
                <input
                  type="password"
                  required
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  placeholder="输入新的密码 (≥6位)"
                  className="h-10 w-full rounded-[12px] border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-950 outline-none focus:border-neutral-900 focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModal(null)}
                  className="rounded-[10px] border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-[10px] bg-neutral-950 px-5 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? '保存中…' : '保存密码'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
