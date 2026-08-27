import { useEffect } from 'react';
import { X, Download, Copy } from 'lucide-react';
import type { Task } from '../lib/api';

interface LightboxProps {
  preview: Task;
  onClose: () => void;
}

export function Lightbox({ preview, onClose }: LightboxProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const copyPrompt = () => {
    if (preview.prompt) {
      navigator.clipboard.writeText(preview.prompt);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="relative grid max-h-[94dvh] w-full max-w-[1180px] grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-[14px] bg-white shadow-2xl lg:max-h-[92vh] lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-1"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-neutral-900 shadow-sm transition hover:bg-white"
          title="关闭"
        >
          <X size={18} />
        </button>

        {/* 图片展示区 */}
        <div className="grid min-h-[260px] place-items-center bg-black p-2 sm:min-h-[360px] sm:p-4 lg:max-h-[92vh]">
          {preview.resultUrl ? (
            <img
              src={preview.resultUrl}
              alt={preview.prompt}
              className="max-h-[56dvh] max-w-full rounded-[8px] object-contain lg:max-h-[86vh]"
            />
          ) : (
            <div className="text-sm text-neutral-400">无预览图</div>
          )}
        </div>

        {/* 右侧属性面板 */}
        <aside className="max-h-[34dvh] overflow-y-auto border-t border-neutral-200 bg-white p-5 pr-12 lg:max-h-[92vh] lg:border-l lg:border-t-0">
          <div className="space-y-1">
            <p className="text-sm font-medium text-neutral-950">图片生成</p>
            <p className="text-xs text-neutral-500">
              {new Date(preview.createdAt).toLocaleString()} · 比例 {preview.params?.ratio ?? '1:1'}
            </p>
            {preview.params?.model && (
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                {preview.params.model}
              </p>
            )}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-500">提示词</span>
              <button
                type="button"
                onClick={copyPrompt}
                className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700"
              >
                <Copy size={12} />
                复制
              </button>
            </div>
            <div className="max-h-[22dvh] overflow-y-auto whitespace-pre-wrap rounded-[10px] bg-neutral-50 p-3 text-sm leading-6 text-neutral-800 lg:max-h-[50vh]">
              {preview.prompt || '无提示词'}
            </div>
          </div>

          {preview.resultUrl && (
            <div className="mt-5 pt-3 border-t border-neutral-100 flex gap-2">
              <a
                href={preview.resultUrl}
                download
                className="inline-flex items-center justify-center gap-1.5 w-full rounded-[10px] bg-neutral-950 py-2.5 text-xs font-medium text-white transition hover:bg-neutral-800"
              >
                <Download size={14} />
                下载作品
              </a>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
