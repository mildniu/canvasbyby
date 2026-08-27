import { useState } from 'react';
import { Download, Trash2, Maximize2, Loader2, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Task } from '../lib/api';

interface TaskCardProps {
  task: Task;
  onOpen: (task: Task) => void;
  onDelete: (id: string) => void;
}

export function TaskCard({ task, onOpen, onDelete }: TaskCardProps) {
  const [downloading, setDownloading] = useState(false);

  const isDone = task.status === 'done' && !!task.resultUrl;
  const isFailed = task.status === 'failed';
  const isRunning = task.status === 'running' || task.status === 'pending';

  const download = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.resultUrl || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(task.resultUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `image-${task.id}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('下载失败');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article className="group/card relative mb-3 break-inside-avoid overflow-hidden rounded-[8px] bg-neutral-100 border border-neutral-200/80 shadow-sm transition hover:shadow-md">
      <button
        type="button"
        disabled={!isDone}
        onClick={() => onOpen(task)}
        className={cn(
          'relative grid w-full place-items-center overflow-hidden text-neutral-400 text-left',
          isDone && 'group cursor-zoom-in'
        )}
      >
        {isDone ? (
          <img
            src={`${task.resultUrl!}?thumb=1`}
            alt={task.prompt}
            className="w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : isRunning ? (
          <div className="flex flex-col items-center justify-center gap-2.5 py-16 text-neutral-500">
            <Loader2 size={24} className="animate-spin text-neutral-700" />
            <span className="text-xs font-medium">生成中…</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-xs text-red-500">
            <span>生成失败</span>
            {task.error && <span className="line-clamp-2 text-[11px] text-neutral-400">{task.error}</span>}
          </div>
        )}

        <div className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-normal text-white backdrop-blur-sm">
          {task.params?.model || '图片'}
        </div>

        {isDone && (
          <div className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-neutral-950 shadow-sm backdrop-blur-sm">
              <Maximize2 size={16} />
            </span>
          </div>
        )}
      </button>

      {/* 底部信息栏 */}
      <div className="flex items-center justify-between gap-2 p-2.5 bg-white border-t border-neutral-100">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-xs text-neutral-700 font-normal">{task.prompt || '无提示词'}</p>
          {task.params?.model && (
            <p className="mt-0.5 line-clamp-1 text-[10px] text-neutral-400">{task.params.model}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover/card:opacity-100">
          {isDone && (
            <button
              type="button"
              onClick={download}
              title="下载作品"
              className="grid h-7 w-7 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            >
              <Download size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            title="删除作品"
            className="grid h-7 w-7 place-items-center rounded-full text-neutral-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
