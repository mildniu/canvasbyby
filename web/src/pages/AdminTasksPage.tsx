import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Search, Loader2, Users, Image as ImageIcon, XCircle, Coins } from 'lucide-react';
import { cn } from '../lib/utils';
import { api, type Task, type AdminTaskStats } from '../lib/api';
import { TaskCard } from '../components/TaskCard';
import { Lightbox } from '../components/Lightbox';

const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'done', label: '生成成功' },
  { value: 'failed', label: '生成失败' },
  { value: 'running', label: '进行中' },
];

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<AdminTaskStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [userFilter, setUserFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [previewTask, setPreviewTask] = useState<Task | null>(null);

  const loadTasks = () => {
    setLoading(true);
    api
      .adminListTasks({ user: userFilter, status: statusFilter, q: query })
      .then((res) => {
        setTasks(res.tasks);
        setStats(res.stats);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTasks();
  }, [userFilter, statusFilter]);

  // 从记录中提取出现过的模型列表（用于展示）
  const modelOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) {
      if (t.params?.model) set.add(t.params.model);
    }
    return Array.from(set).sort();
  }, [tasks]);

  const totals = useMemo(() => {
    return stats.reduce(
      (acc, s) => ({
        count: acc.count + s.count,
        done: acc.done + s.doneCount,
        failed: acc.failed + s.failedCount,
        credits: acc.credits + s.totalCredits,
      }),
      { count: 0, done: 0, failed: 0, credits: 0 }
    );
  }, [stats]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定删除这条生成记录吗？（含生成图片文件）')) return;
    await api.deleteTask(id).catch(() => {});
    loadTasks();
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1500px] px-3 pb-16 pt-6 sm:px-8 sm:pt-10 lg:px-12">
      <header className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-[22px] font-medium text-neutral-950 sm:text-[28px]">全部生成记录</h1>
          <p className="mt-1.5 text-xs leading-5 text-neutral-500 sm:mt-2 sm:text-sm sm:leading-6">
            查看所有用户的生图记录，了解各用户的使用情况与积分消耗。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadTasks}
            disabled={loading}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-3 text-[13px] text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-50 cursor-pointer sm:gap-2 sm:px-3.5 sm:text-sm"
          >
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
            刷新
          </button>
        </div>
      </header>

      {/* 汇总统计卡片 */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <div className="rounded-[16px] border border-neutral-200 bg-white p-3.5 shadow-sm sm:p-4">
          <div className="flex items-center gap-2 text-neutral-500">
            <ImageIcon size={15} className="shrink-0" />
            <span className="text-[11px] font-medium sm:text-xs">总生成次数</span>
          </div>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-neutral-950 sm:text-2xl">{totals.count}</p>
        </div>
        <div className="rounded-[16px] border border-neutral-200 bg-white p-3.5 shadow-sm sm:p-4">
          <div className="flex items-center gap-2 text-neutral-500">
            <span className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full bg-emerald-100 text-[9px] text-emerald-600">✓</span>
            <span className="text-[11px] font-medium sm:text-xs">成功作品</span>
          </div>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-neutral-950 sm:text-2xl">{totals.done}</p>
        </div>
        <div className="rounded-[16px] border border-neutral-200 bg-white p-3.5 shadow-sm sm:p-4">
          <div className="flex items-center gap-2 text-neutral-500">
            <XCircle size={15} className="shrink-0" />
            <span className="text-[11px] font-medium sm:text-xs">失败任务</span>
          </div>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-neutral-950 sm:text-2xl">{totals.failed}</p>
        </div>
        <div className="rounded-[16px] border border-neutral-200 bg-white p-3.5 shadow-sm sm:p-4">
          <div className="flex items-center gap-2 text-neutral-500">
            <Coins size={15} className="shrink-0 text-amber-500" />
            <span className="text-[11px] font-medium sm:text-xs">总积分消耗</span>
          </div>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-amber-700 sm:text-2xl">{totals.credits}</p>
        </div>
      </div>

      {/* 筛选栏 */}
      <section className="mb-3 rounded-[16px] border border-neutral-200 bg-white p-2.5 shadow-sm sm:p-3">
        <div className="grid gap-2.5 sm:grid-cols-[1fr_auto_auto] sm:items-center">
          <label className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadTasks()}
              placeholder="搜索提示词或用户名..."
              className="h-10 w-full rounded-[12px] border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-300 focus:bg-white"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 w-full rounded-[12px] border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-800 outline-none focus:border-neutral-300 sm:w-auto"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={loadTasks}
            className="h-10 rounded-[12px] bg-neutral-950 px-4 text-sm font-medium text-white transition hover:bg-neutral-800 cursor-pointer sm:w-auto"
          >
            搜索
          </button>
        </div>

        {/* 用户快捷筛选标签（含统计） */}
        <div className="mt-2.5 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
          <button
            type="button"
            onClick={() => setUserFilter('all')}
            className={cn(
              'h-7 rounded-full border px-2.5 text-[11px] transition flex items-center gap-1.5 cursor-pointer sm:h-8 sm:text-[13px]',
              userFilter === 'all'
                ? 'border-neutral-950 bg-neutral-950 text-white font-medium shadow-sm'
                : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
            )}
          >
            <Users size={12} className="shrink-0" />
            全部用户
          </button>
          {stats.map((s) => {
            // 没有唯一 id，用 username 作为筛选键（后端按 user_id 精确匹配，这里用统计里的 username 反查）
            const isActive = userFilter === s.username;
            return (
              <button
                key={s.username}
                type="button"
                onClick={() => setUserFilter(isActive ? 'all' : s.username)}
                title={`成功 ${s.doneCount} · 失败 ${s.failedCount} · 消耗 ${s.totalCredits} 积分`}
                className={cn(
                  'h-7 rounded-full border px-2.5 text-[11px] transition flex items-center gap-1.5 cursor-pointer sm:h-8 sm:text-[13px]',
                  isActive
                    ? 'border-neutral-950 bg-neutral-950 text-white font-medium shadow-sm'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
                )}
              >
                <span>{s.username}</span>
                <span className={cn('text-[10px] sm:text-[11px]', isActive ? 'text-white/70' : 'text-neutral-400')}>
                  {s.count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 记录瀑布流 */}
      {loading ? (
        <div className="grid place-items-center py-20 text-neutral-400">
          <Loader2 size={28} className="animate-spin" />
          <p className="mt-2 text-sm">加载中…</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="mx-auto grid max-w-[1500px] place-items-center rounded-[24px] border border-dashed border-neutral-200 py-16 text-neutral-400">
          <ImageIcon size={32} />
          <p className="mt-3 text-sm">暂无符合条件的生成记录</p>
        </div>
      ) : (
        <div
          className="columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5"
          style={{ columnWidth: '240px' }}
        >
          {tasks.map((t) => (
            <AdminTaskCard
              key={t.id}
              task={t}
              onOpen={setPreviewTask}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {previewTask && (
        <Lightbox preview={previewTask} onClose={() => setPreviewTask(null)} />
      )}
    </div>
  );
}

/** 管理员视图的任务卡片：在普通卡片基础上叠加用户归属徽章 */
function AdminTaskCard({
  task,
  onOpen,
  onDelete,
}: {
  task: Task;
  onOpen: (task: Task) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="relative mb-3 break-inside-avoid">
      {/* 用户归属徽章 */}
      <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm shadow-sm">
        <Users size={10} className="shrink-0" />
        <span className="max-w-[100px] truncate">{task.username ?? '未知用户'}</span>
        {typeof task.creditsCost === 'number' && task.creditsCost > 0 && (
          <span className="rounded bg-amber-500/90 px-1 text-[9px]">-{task.creditsCost}分</span>
        )}
      </div>
      <TaskCard task={task} onOpen={onOpen} onDelete={onDelete} />
    </div>
  );
}
