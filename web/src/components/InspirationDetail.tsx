import { useEffect } from 'react';
import { X, Copy, Languages, Wand2, Star, Heart } from 'lucide-react';
import { cn } from '../lib/utils';
import { mediaUrl } from '../lib/config';
import type { InspirationItem } from './InspirationModal';

interface InspirationDetailProps {
  item: InspirationItem;
  onClose: () => void;
  onImport: (prompt: string, lang: 'zh' | 'en') => void;
  onToggleFavorite?: (id: number) => void;
  liked?: boolean;
  onLike?: (id: number) => void;
}

/** 从双语提示词中解析出中文与英文部分 */
export function parseBilingualPrompt(prompt: string): { zh: string; en: string } {
  const m = prompt.match(/^\[中文\]\s*\n([\s\S]*?)\n\s*\[English\]\s*\n([\s\S]*)$/);
  if (m) {
    return { zh: m[1].trim(), en: m[2].trim() };
  }
  // 无标准标记：含中文即视为中文，否则视为英文
  const hasZh = /[\u4e00-\u9fff]/.test(prompt);
  return hasZh ? { zh: prompt, en: '' } : { zh: '', en: prompt };
}

export function InspirationDetail({
  item,
  onClose,
  onImport,
  onToggleFavorite,
  liked,
  onLike,
}: InspirationDetailProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const { zh, en } = parseBilingualPrompt(item.prompt);
  const copy = (text: string) => {
    if (text) navigator.clipboard.writeText(text);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm sm:p-4"
      onMouseDown={onClose}
    >
      <div
        className="relative grid max-h-[94dvh] w-full max-w-[1180px] grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-[20px] bg-white shadow-2xl lg:max-h-[92vh] lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-1"
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

        {/* 左侧：封面大图 */}
        <div className="grid min-h-[260px] place-items-center bg-neutral-950 p-3 sm:min-h-[360px] sm:p-6 lg:max-h-[92vh]">
          {item.cover ? (
            <img
              src={mediaUrl(item.cover) ?? undefined}
              alt={item.title}
              className="max-h-[52dvh] max-w-full rounded-[10px] object-contain shadow-lg lg:max-h-[86vh]"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-neutral-400">
              <Wand2 size={32} />
              <span className="text-xs">暂无预览图</span>
            </div>
          )}
        </div>

        {/* 右侧：详情面板 */}
        <aside className="flex max-h-[38dvh] flex-col justify-between overflow-y-auto border-t border-neutral-200 bg-white p-5 pr-12 lg:max-h-[92vh] lg:border-l lg:border-t-0">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-neutral-950">{item.title}</h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                    {item.category}
                  </span>
                  {item.tags?.split(' / ').filter(Boolean).slice(0, 3).map((t) => (
                    <span key={t} className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700 border border-sky-100">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {onToggleFavorite && (
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(item.id)}
                    title={item.isFavorite ? '取消收藏' : '收藏'}
                    className={cn(
                      'grid h-8 w-8 place-items-center rounded-full transition cursor-pointer',
                      item.isFavorite
                        ? 'bg-amber-400 text-white shadow-[0_2px_10px_rgba(245,158,11,.5)]'
                        : 'bg-neutral-100 text-neutral-400 hover:bg-amber-100 hover:text-amber-600'
                    )}
                  >
                    <Star size={15} className={cn(item.isFavorite && 'fill-current')} />
                  </button>
                )}
                {onLike && (
                  <button
                    type="button"
                    onClick={() => onLike(item.id)}
                    title="点赞"
                    className={cn(
                      'grid h-8 w-8 place-items-center rounded-full transition cursor-pointer',
                      liked
                        ? 'bg-red-500 text-white'
                        : 'bg-neutral-100 text-neutral-400 hover:bg-red-50 hover:text-red-500'
                    )}
                  >
                    <Heart size={15} className={cn(liked && 'fill-current')} />
                  </button>
                )}
              </div>
            </div>

            {/* 中文提示词 */}
            {zh && (
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700">
                    <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600 border border-red-100">中</span>
                    中文提示词
                  </span>
                  <button
                    type="button"
                    onClick={() => copy(zh)}
                    className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 font-medium cursor-pointer"
                  >
                    <Copy size={12} />
                    复制
                  </button>
                </div>
                <div className="max-h-[16dvh] overflow-y-auto whitespace-pre-wrap rounded-[12px] border border-neutral-200/80 bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-800 lg:max-h-[26vh] select-text">
                  {zh}
                </div>
              </div>
            )}

            {/* 英文提示词 */}
            {en && (
              <div className="mt-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700">
                    <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-600 border border-sky-100">EN</span>
                    英文提示词
                  </span>
                  <button
                    type="button"
                    onClick={() => copy(en)}
                    className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 font-medium cursor-pointer"
                  >
                    <Copy size={12} />
                    复制
                  </button>
                </div>
                <div className="max-h-[16dvh] overflow-y-auto whitespace-pre-wrap rounded-[12px] border border-neutral-200/80 bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-800 lg:max-h-[26vh] select-text">
                  {en}
                </div>
              </div>
            )}
          </div>

          {/* 底部操作：分开导入中/英文提示词 */}
          <div className="mt-4 flex flex-col gap-2 border-t border-neutral-100 pt-4">
            {zh && (
              <button
                type="button"
                onClick={() => onImport(zh, 'zh')}
                className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[12px] bg-neutral-950 text-xs font-medium text-white transition hover:bg-neutral-800 cursor-pointer shadow-sm"
              >
                <Wand2 size={13} />
                导入中文提示词
              </button>
            )}
            {en && (
              <button
                type="button"
                onClick={() => onImport(en, 'en')}
                className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[12px] border border-neutral-300 bg-white text-xs font-medium text-neutral-800 transition hover:bg-neutral-50 cursor-pointer"
              >
                <Languages size={13} />
                导入英文提示词
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
