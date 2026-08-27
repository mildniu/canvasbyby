import { useState, useEffect } from 'react';
import { RefreshCw, Trash2, Loader2, Sparkles } from 'lucide-react';
import { api, type Task } from '../lib/api';
import { TaskCard } from '../components/TaskCard';
import { Lightbox } from '../components/Lightbox';

export default function HistoryPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewTask, setPreviewTask] = useState<Task | null>(null);

  const loadTasks = () => {
    setLoading(true);
    api
      .listTasks()
      .then(setTasks)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定删除这个作品吗？')) return;
    await api.deleteTask(id).catch(() => {});
    loadTasks();
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1500px] px-4 pb-16 pt-10 sm:px-8 lg:px-12">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-medium text-neutral-950">生成历史</h1>
          <p className="mt-2 text-sm text-neutral-500">
            图片都可以预览、下载，随时管理和删除历史作品。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadTasks}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-neutral-200 px-3.5 text-sm text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>
      </header>

      <div className="mb-4 text-sm text-neutral-400">
        <span>共 {tasks.length} 条记录</span>
      </div>

      {tasks.length === 0 ? (
        <div className="mx-auto grid max-w-[1500px] place-items-center rounded-[24px] border border-dashed border-neutral-200 py-16 text-neutral-400">
          <Sparkles size={32} />
          <p className="mt-3 text-sm">还没有任何作品</p>
          <p className="mt-1 text-xs text-neutral-400">去图片创作开始你的第一次生成吧。</p>
        </div>
      ) : (
        <div
          className="columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5"
          style={{ columnWidth: '220px' }}
        >
          {tasks.map((t) => (
            <TaskCard
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
