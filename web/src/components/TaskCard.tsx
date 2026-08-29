import { useState } from 'react';
import { Download, Trash2, Maximize2, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { apiUrl, mediaUrl } from '../lib/config';
import { saveImageToGallery } from '../lib/native';
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
      // 原生 App：保存到系统相册；网页端：浏览器下载
      const ok = await saveImageToGallery(apiUrl(task.resultUrl), `image-${task.id}.png`);
      if (!ok) {
        const res = await fetch(apiUrl(task.resultUrl), { credentials: 'include' });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `image-${task.id}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch {
      alert('下载失败');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article className="group/card relative mb-3 break-inside-avoid overflow-hidden rounded-[14px] bg-white border border-neutral-200/90 shadow-sm transition hover:shadow-md">
      <button
        type="button"
        disabled={isRunning}
        onClick={() => onOpen(task)}
        className={cn(
          'relative grid w-full place-items-center overflow-hidden text-neutral-400 text-left transition',
          !isRunning && 'cursor-pointer'
        )}
      >
        {isDone ? (
          <img
            src={mediaUrl(`${task.resultUrl!}?thumb=1`) ?? undefined}
            alt={task.prompt}
            className="w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : isRunning ? (
          <div className="flex flex-col items-center justify-center gap-2.5 py-16 text-neutral-500 bg-neutral-50 w-full">
            <Loader2 size={24} className="animate-spin text-neutral-700" />
            <span className="text-xs font-medium">生成中…</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center text-xs text-red-500 bg-red-50/40 w-full transition group-hover:bg-red-50/70">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-red-100 text-red-600">
              <AlertCircle size={16} />
            </div>
            <span className="font-medium text-red-700">生成未成功（点击查看提示词）</span>
            {task.error && (
              <span className="line-clamp-2 text-[11px] text-neutral-400 max-w-[200px] leading-relaxed">
                {task.error}
              </span>
            )}
          </div>
        )}

        <div className="absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm shadow-sm">
          {task.params?.model || '图片'}
        </div>

        {!isRunning && (
          <div className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/95 text-neutral-950 shadow-md backdrop-blur-sm transition transform scale-90 group-hover:scale-100">
              <Maximize2 size={15} />
            </span>
          </div>
        )}
      </button>

      {/* 底部信息栏 */}
      <div className="flex items-center justify-between gap-2 p-3 bg-white border-t border-neutral-100">
        <div
          className="min-w-0 flex-1 cursor-pointer"
          onClick={() => !isRunning && onOpen(task)}
        >
          <p className="line-clamp-1 text-xs text-neutral-800 font-normal hover:text-neutral-950">
            {task.prompt || '无提示词'}
          </p>
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
              className="grid h-7 w-7 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 cursor-pointer"
            >
              <Download size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            title="删除记录"
            className="grid h-7 w-7 place-items-center rounded-full text-neutral-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
