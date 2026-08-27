import { useState, useEffect } from 'react';
import {
  Sparkles,
  Clock,
  Maximize2,
  RotateCcw,
  Download,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { Task } from '../lib/api';

export interface ActiveJob {
  id: string;
  prompt: string;
  model: string;
  ratio: string;
  startTime: number;
  elapsedMs: number;
  status: 'idle' | 'running' | 'done' | 'failed';
  resultUrl?: string | null;
  error?: string | null;
}

interface LivePreviewDockProps {
  job: ActiveJob | null;
  onOpenTask?: (task: Task) => void;
  onReusePrompt?: (prompt: string) => void;
}

export function LivePreviewDock({
  job,
  onOpenTask,
  onReusePrompt,
}: LivePreviewDockProps) {
  const [tickerMs, setTickerMs] = useState<number>(0);

  // 秒表定时器
  useEffect(() => {
    if (!job || job.status !== 'running') {
      return;
    }
    const interval = setInterval(() => {
      setTickerMs(Date.now() - job.startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [job?.status, job?.startTime]);

  const displayElapsed =
    job?.status === 'running'
      ? (tickerMs / 1000).toFixed(1)
      : ((job?.elapsedMs ?? 0) / 1000).toFixed(1);

  // 空闲状态 (Idle)
  if (!job || job.status === 'idle') {
    return (
      <div className="flex h-full min-h-[160px] w-full flex-col items-center justify-center rounded-[24px] border border-dashed border-neutral-200/90 bg-neutral-50/60 p-4 text-center text-neutral-400 transition sm:min-h-[190px]">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-neutral-400 shadow-sm border border-neutral-100">
          <Sparkles size={18} />
        </div>
        <p className="mt-2 text-xs font-medium text-neutral-500">生成预览小窗口</p>
        <p className="mt-0.5 text-[11px] text-neutral-400">点击生成后此处将实时显示耗时与渲染进度</p>
      </div>
    );
  }

  // 生成中 (Running)
  if (job.status === 'running') {
    return (
      <div className="relative flex h-full min-h-[160px] w-full flex-col justify-between overflow-hidden rounded-[24px] border border-sky-200/80 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 p-4 text-white shadow-[0_12px_36px_rgba(15,23,42,.15)] transition sm:min-h-[190px]">
        {/* 背景动态炫彩光晕 */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-sky-500/20 blur-2xl animate-pulse" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-purple-500/20 blur-2xl animate-pulse" />

        {/* 顶部：实时秒表计时器 */}
        <div className="relative z-10 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-300 backdrop-blur border border-white/10">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
            </span>
            渲染中
          </span>

          <div className="inline-flex items-center gap-1 text-xs font-mono font-semibold tracking-wider text-amber-300">
            <Clock size={13} className="animate-spin text-amber-400" />
            <span>{displayElapsed}s</span>
          </div>
        </div>

        {/* 中部：微型流光脉冲骨架与提示 */}
        <div className="relative z-10 my-auto py-2 text-center">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-sky-400 backdrop-blur shadow-inner">
            <Sparkles size={22} className="animate-pulse" />
          </div>
          <p className="mt-2 text-xs font-medium text-neutral-200 truncate px-2">
            {job.prompt ? `"${job.prompt}"` : 'AI 正在构思构图与光影...'}
          </p>
        </div>

        {/* 底部：模型与比例标签 */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-2 text-[11px] text-neutral-400">
          <span className="truncate max-w-[120px] text-neutral-300 font-medium">{job.model}</span>
          <span className="rounded bg-white/10 px-1.5 py-0.2 text-[10px] text-neutral-300">{job.ratio}</span>
        </div>
      </div>
    );
  }

  // 失败 (Failed)
  if (job.status === 'failed') {
    return (
      <div className="relative flex h-full min-h-[160px] w-full flex-col justify-between rounded-[24px] border border-red-200 bg-red-50/70 p-4 text-red-950 transition sm:min-h-[190px]">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
            <AlertCircle size={14} />
            生成失败
          </span>
          <span className="text-xs font-mono text-neutral-400">{displayElapsed}s</span>
        </div>

        <p className="my-auto line-clamp-3 text-xs leading-relaxed text-red-700">
          {job.error || '上游服务暂时响应超时，积分已自动退回'}
        </p>

        <div className="flex items-center justify-between border-t border-red-200/60 pt-2 text-[11px]">
          <span className="text-neutral-500">已退回积分</span>
          {onReusePrompt && (
            <button
              type="button"
              onClick={() => onReusePrompt(job.prompt)}
              className="inline-flex items-center gap-1 font-medium text-red-600 hover:underline cursor-pointer"
            >
              <RotateCcw size={12} />
              重试填回
            </button>
          )}
        </div>
      </div>
    );
  }

  // 完成 (Done) - 结果展示微窗口
  const asTask: Task = {
    id: job.id,
    kind: 'image',
    status: 'done',
    prompt: job.prompt,
    params: { ratio: job.ratio, model: job.model },
    resultUrl: job.resultUrl ?? null,
    error: null,
    createdAt: job.startTime,
    doneAt: job.startTime + job.elapsedMs,
  };

  return (
    <div className="group relative flex h-full min-h-[160px] w-full flex-col overflow-hidden rounded-[24px] border border-neutral-200 bg-neutral-900 shadow-sm transition sm:min-h-[190px]">
      {job.resultUrl ? (
        <img
          src={job.resultUrl}
          alt={job.prompt}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-white">
          <Sparkles size={24} />
        </div>
      )}

      {/* 渐变遮罩与快捷操作 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 opacity-90 transition group-hover:opacity-100 flex flex-col justify-between p-3">
        {/* 顶部耗时徽章与放大 */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur shadow-sm">
            <Zap size={11} />
            {displayElapsed}s 完成
          </span>

          <button
            type="button"
            onClick={() => onOpenTask?.(asTask)}
            title="查看大图"
            className="grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-white hover:text-black transition cursor-pointer"
          >
            <Maximize2 size={13} />
          </button>
        </div>

        {/* 底部信息与填回 */}
        <div>
          <p className="line-clamp-1 text-xs font-medium text-white drop-shadow">
            {job.prompt}
          </p>
          <div className="mt-1.5 flex items-center justify-between border-t border-white/20 pt-1.5 text-[11px] text-white/80">
            <span className="truncate max-w-[110px]">{job.model}</span>
            <div className="flex items-center gap-2">
              {onReusePrompt && (
                <button
                  type="button"
                  onClick={() => onReusePrompt(job.prompt)}
                  title="填回提示词"
                  className="hover:text-white hover:underline cursor-pointer flex items-center gap-0.5"
                >
                  <RotateCcw size={11} /> 填回
                </button>
              )}
              {job.resultUrl && (
                <a
                  href={job.resultUrl}
                  download={`${job.id}.png`}
                  title="下载原图"
                  className="hover:text-white cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download size={12} />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
