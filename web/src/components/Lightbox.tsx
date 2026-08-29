import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Download, Copy, Sparkles, AlertCircle, Wand2, RotateCcw, Clock } from 'lucide-react';
import { mediaUrl } from '../lib/config';
import { copyText } from '../lib/native';
import type { Task } from '../lib/api';

interface LightboxProps {
  preview: Task;
  onClose: () => void;
  onReuse?: (prompt: string) => void;
}

export function Lightbox({ preview, onClose, onReuse }: LightboxProps) {
  const nav = useNavigate();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Android 返回键：打开详情时消费返回事件并关闭弹窗
  useEffect(() => {
    const handleBack = () => onClose();
    window.addEventListener('app:back', handleBack);
    return () => window.removeEventListener('app:back', handleBack);
  }, [onClose]);

  const copyPrompt = async () => {
    if (preview.prompt) {
      await copyText(preview.prompt);
    }
  };

  const handleReuse = () => {
    if (preview.prompt) {
      if (onReuse) {
        onReuse(preview.prompt);
      } else {
        nav('/create/image', {
          state: {
            fromInspiration: true,
            prompt: preview.prompt,
            ratio: preview.params?.ratio,
          },
        });
      }
      onClose();
    }
  };

  const isFailed = preview.status === 'failed';
  const isDone = preview.status === 'done' && !!preview.resultUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="relative grid max-h-[94dvh] w-full max-w-[1180px] grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-[20px] bg-white shadow-2xl lg:max-h-[92vh] lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-1"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-neutral-900 shadow-md transition hover:bg-white cursor-pointer"
          title="关闭"
        >
          <X size={18} />
        </button>

        {/* 左侧：图片或失败卡片展示区 */}
        <div className="grid min-h-[260px] place-items-center bg-neutral-950 p-3 sm:min-h-[360px] sm:p-6 lg:max-h-[92vh]">
          {isDone ? (
            <img
              src={mediaUrl(preview.resultUrl) ?? undefined}
              alt={preview.prompt}
              className="max-h-[56dvh] max-w-full rounded-[10px] object-contain shadow-lg lg:max-h-[86vh]"
            />
          ) : isFailed ? (
            <div className="flex max-w-md flex-col items-center justify-center rounded-[20px] border border-red-900/50 bg-red-950/30 p-8 text-center text-red-200 shadow-xl backdrop-blur">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                <AlertCircle size={24} />
              </div>
              <h3 className="mt-3 text-base font-semibold text-red-300">生成任务未成功</h3>
              <p className="mt-2 text-xs leading-relaxed text-red-200/80">
                {preview.error || '上游服务暂时响应超时，系统已为您自动返还扣除积分'}
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-[11px] font-medium text-red-300 border border-red-500/20">
                <span>🪙 积分已全额返还</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-neutral-400">正在生成中…</div>
          )}
        </div>

        {/* 右侧属性面板 */}
        <aside className="max-h-[36dvh] overflow-y-auto border-t border-neutral-200 bg-white p-5 pr-12 lg:max-h-[92vh] lg:border-l lg:border-t-0 flex flex-col justify-between">
          <div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-neutral-950">任务详情</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    isDone
                      ? 'bg-emerald-100 text-emerald-800'
                      : isFailed
                      ? 'bg-red-100 text-red-800'
                      : 'bg-sky-100 text-sky-800'
                  }`}
                >
                  {isDone ? '生成成功' : isFailed ? '生成失败' : '执行中'}
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                {new Date(preview.createdAt).toLocaleString()} · 比例 {preview.params?.ratio ?? '1:1'}
              </p>
              {preview.params?.model && (
                <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-700">
                  {preview.params.model}
                </p>
              )}
            </div>

            {/* 提示词展示区 */}
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">完整提示词</span>
                <button
                  type="button"
                  onClick={copyPrompt}
                  className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 font-medium cursor-pointer"
                >
                  <Copy size={12} />
                  复制
                </button>
              </div>
              <div className="max-h-[22dvh] overflow-y-auto whitespace-pre-wrap rounded-[12px] border border-neutral-200/80 bg-neutral-50 p-3.5 text-xs leading-relaxed text-neutral-800 lg:max-h-[44vh] select-text">
                {preview.prompt || '无提示词'}
              </div>
            </div>
          </div>

          {/* 底部操作按钮 */}
          <div className="mt-6 pt-4 border-t border-neutral-100 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleReuse}
              className="inline-flex items-center justify-center gap-1.5 w-full rounded-[12px] bg-neutral-950 py-2.5 text-xs font-medium text-white transition hover:bg-neutral-800 cursor-pointer shadow-sm"
            >
              <Wand2 size={13} />
              填入工作台继续创作
            </button>

            {isDone && preview.resultUrl && (
              <a
                href={mediaUrl(preview.resultUrl) ?? '#'}
                download={`image-${preview.id}.png`}
                className="inline-flex items-center justify-center gap-1.5 w-full rounded-[12px] border border-neutral-200 bg-white py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 cursor-pointer"
              >
                <Download size={13} />
                下载作品原图
              </a>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
