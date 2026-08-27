import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  RefreshCw,
  Heart,
  WandSparkles,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { InspirationItem } from '../components/InspirationModal';

const SORTS = [
  { value: 'popular', label: '最多点赞' },
  { value: 'latest', label: '最新' },
];

export default function InspirationPage() {
  const [list, setList] = useState<InspirationItem[]>([]);
  const [category, setCategory] = useState('全部');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('popular');
  const [loading, setLoading] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());

  const nav = useNavigate();

  const loadData = () => {
    setLoading(true);
    fetch('/api/inspirations')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setList(data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // 动态生成可用分类列表及数量统计
  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of list) {
      const c = item.category || '其他';
      counts[c] = (counts[c] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return [
      { name: '全部', count: list.length },
      ...sorted.map(([name, count]) => ({ name, count })),
    ];
  }, [list]);

  const handleLike = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (likedIds.has(id)) return;
    try {
      const res = await fetch(`/api/inspirations/${id}/like`, { method: 'POST' });
      if (res.ok) {
        setLikedIds((prev) => new Set(prev).add(id));
        setList((prev) =>
          prev.map((item) => (item.id === id ? { ...item, likes: (item.likes ?? 0) + 1 } : item))
        );
      }
    } catch {}
  };

  const handleUse = (item: InspirationItem) => {
    nav('/create/image', {
      state: {
        fromInspiration: true,
        prompt: item.prompt,
        ratio: '1:1',
      },
    });
  };

  const filtered = list
    .filter((item) => {
      if (category !== '全部' && item.category !== category) {
        return false;
      }
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return `${item.title} ${item.prompt} ${item.category} ${item.tags ?? ''}`.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sort === 'popular') return (b.likes ?? 0) - (a.likes ?? 0);
      return b.id - a.id;
    });

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1500px] px-4 pb-16 pt-10 sm:px-8 lg:px-12">
      {/* 头部标题与操作 */}
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[28px] font-medium text-neutral-950">灵感广场</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
            浏览公开作品和精选模板，按分类搜索，查看原图、比例和提示词后直接带入创作。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-neutral-200 px-3.5 text-sm text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-50"
          >
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
            刷新
          </button>
        </div>
      </header>

      {/* 搜索与排序 */}
      <section className="mb-3 rounded-[16px] border border-neutral-200 bg-white p-3 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <label className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索标题、提示词、作者或标签"
              className="h-10 w-full rounded-[12px] border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-300 focus:bg-white"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-neutral-500">
            <SlidersHorizontal size={16} />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-10 min-w-[130px] rounded-[12px] border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-800 outline-none focus:border-neutral-300"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* 动态分类标签 (支持自动换行分行显示) */}
      <div className="mb-4 flex flex-wrap gap-2">
        {categoryStats.map((c) => {
          const active = c.name === category;
          return (
            <button
              key={c.name}
              type="button"
              onClick={() => setCategory(c.name)}
              className={cn(
                'h-8 rounded-full border px-3 text-sm transition flex items-center gap-1.5 cursor-pointer',
                active
                  ? 'border-neutral-950 bg-neutral-950 text-white font-medium shadow-sm'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950'
              )}
            >
              <span>{c.name}</span>
              <span className={cn('text-xs', active ? 'text-white/80 font-normal' : 'text-neutral-400')}>
                {c.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex items-center justify-between text-sm text-neutral-400">
        <span>当前分类包含 {filtered.length} 个灵感</span>
      </div>

      {/* 瀑布流卡片列表 */}
      <div
        className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5"
        style={{ columnWidth: '240px' }}
      >
        {filtered.map((item) => (
          <article
            key={item.id}
            onClick={() => handleUse(item)}
            className="group relative mb-4 break-inside-avoid cursor-pointer overflow-hidden rounded-[16px] border border-neutral-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            {item.cover ? (
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-neutral-100">
                <img
                  src={item.cover}
                  alt={item.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
              </div>
            ) : (
              <div className="flex aspect-[4/5] w-full items-center justify-center bg-neutral-50 text-neutral-400">
                <WandSparkles size={32} />
              </div>
            )}

            <div className="p-3.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate text-sm font-medium text-neutral-950">{item.title}</h3>
                <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600">
                  {item.category}
                </span>
              </div>

              <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-neutral-500">
                {item.prompt}
              </p>

              <div className="mt-3 flex items-center justify-between pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={(e) => handleLike(e, item.id)}
                  className={cn(
                    'inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-red-500 transition',
                    likedIds.has(item.id) && 'text-red-500 font-medium'
                  )}
                >
                  <Heart size={14} className={cn(likedIds.has(item.id) && 'fill-current text-red-500')} />
                  <span>{item.likes ?? 0}</span>
                </button>

                <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 group-hover:translate-x-0.5 transition">
                  <WandSparkles size={12} />
                  一键带入
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
