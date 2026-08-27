import { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, X, Search } from 'lucide-react';
import { cn } from '../lib/utils';

export interface InspirationItem {
  id: number;
  title: string;
  prompt: string;
  category: string;
  tags?: string;
  cover?: string | null;
  likes?: number;
}

interface InspirationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: InspirationItem[];
  onPick: (item: InspirationItem) => void;
}

export function InspirationModal({
  open,
  onOpenChange,
  templates,
  onPick,
}: InspirationModalProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部');
  const ref = useRef<HTMLDivElement>(null);

  // 动态统计分类及数量
  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of templates) {
      const c = item.category || '其他';
      counts[c] = (counts[c] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return [
      { name: '全部', count: templates.length },
      ...sorted.map(([name, count]) => ({ name, count })),
    ];
  }, [templates]);

  const filtered = templates.filter((t) => {
    if (category !== '全部' && t.category !== category) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return `${t.title} ${t.prompt} ${t.category} ${t.tags ?? ''}`.toLowerCase().includes(q);
  });

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open, onOpenChange]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-normal outline-none transition',
          open ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950'
        )}
        title="灵感菜单"
      >
        <Sparkles size={15} />
        灵感
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-[20px] border border-neutral-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,.18)] sm:absolute sm:inset-x-auto sm:left-0 sm:top-10 sm:w-[min(calc(100vw-2rem),760px)]">
          <div className="border-b border-neutral-100 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-neutral-950">灵感菜单</p>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {templates.length ? `${templates.length} 个模板` : '来自 awesome-gpt-image-2'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                title="关闭"
              >
                <X size={16} />
              </button>
            </div>

            <div className="relative mt-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索标题、分类或提示词"
                className="h-10 w-full rounded-[14px] border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-300 focus:bg-white"
              />
            </div>

            {/* 弹窗内的分类标签：分行换行显示，方便点击 */}
            <div className="mt-3 flex flex-wrap gap-1.5 max-h-36 overflow-y-auto no-scrollbar pt-0.5">
              {categoryStats.map((c) => {
                const active = c.name === category;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setCategory(c.name)}
                    className={cn(
                      'h-7 rounded-full px-2.5 text-xs font-normal transition flex items-center gap-1 cursor-pointer',
                      active
                        ? 'bg-neutral-950 text-white font-medium shadow-sm'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-950'
                    )}
                  >
                    <span>{c.name}</span>
                    <span className={cn('text-[10px]', active ? 'text-white/80' : 'text-neutral-400')}>
                      {c.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-h-[calc(100dvh-16rem)] overflow-y-auto p-2 sm:max-h-[380px]">
            {filtered.length === 0 ? (
              <div className="grid h-28 place-items-center text-sm text-neutral-400">没有匹配的灵感模板</div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {filtered.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onPick(item)}
                    className="group flex cursor-pointer gap-3 rounded-[14px] border border-neutral-100 bg-white p-2.5 transition hover:border-neutral-200 hover:bg-neutral-50"
                  >
                    {item.cover ? (
                      <img
                        src={item.cover}
                        alt={item.title}
                        className="h-16 w-16 shrink-0 rounded-[10px] object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[10px] bg-neutral-100 text-neutral-400">
                        <Sparkles size={20} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="truncate text-xs font-medium text-neutral-900">{item.title}</h4>
                        <span className="shrink-0 text-[10px] text-neutral-400">{item.category}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500">{item.prompt}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
