import { useState, useEffect } from 'react';
import { UserPlus, Trash2, KeyRound, Shield, Ban, CheckCircle2, RefreshCw, X, Coins, Plus, Minus } from 'lucide-react';
import { cn } from '../lib/utils';
import { api, type User } from '../lib/api';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [resetModal, setResetModal] = useState<User | null>(null);
  const [creditsModal, setCreditsModal] = useState<User | null>(null);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [newCredits, setNewCredits] = useState<number>(20);

  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [creditsVal, setCreditsVal] = useState<number>(20);
  const [actionLoading, setActionLoading] = useState(false);

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
