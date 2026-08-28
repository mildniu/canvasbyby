import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  RefreshCw,
  Heart,
  WandSparkles,
  Star,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import type { InspirationItem } from '../components/InspirationModal';
import { InspirationDetail, parseBilingualPrompt } from '../components/InspirationDetail';

const SORTS = [
  { value: 'popular', label: '最多点赞' },
  { value: 'latest', label: '最新' },
];

const FAVORITES_TAB = '__favorites__';

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

  // 动态生成可用分类列表及数量统计（收藏数单独统计）
  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = {};
    let favCount = 0;
    for (const item of list) {
      const c = item.category || '其他';
      counts[c] = (counts[c] || 0) + 1;
      if (item.isFavorite) favCount++;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return [
      { name: '全部', count: list.length },
      { name: FAVORITES_TAB, count: favCount },
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

  // 收藏 / 取消收藏（乐观更新）
  const handleFavorite = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setList((prev) => prev.map((item) => (item.id === id ? { ...item, isFavorite: !item.isFavorite } : item)));
    try {
      await api.toggleFavorite(id);
    } catch {
      // 失败回滚
      setList((prev) => prev.map((item) => (item.id === id ? { ...item, isFavorite: !item.isFavorite } : item)));
    }
  };

  const handleUse = (prompt: string) => {
    nav('/create/image', {
      state: {
        fromInspiration: true,
        prompt,
        ratio: '1:1',
      },
    });
  };

  // 打开详情弹窗（与历史记录 Lightbox 同形式）
  const [detailItem, setDetailItem] = useState<InspirationItem | null>(null);

  const filtered = list
    .filter((item) => {
      if (category === FAVORITES_TAB) {
        if (!item.isFavorite) return false;
      } else if (category !== '全部' && item.category !== category) {
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
    <div className="mx-auto min-h-screen w-full max-w-[1500px] px-3 pb-16 pt-6 sm:px-8 sm:pt-10 lg:px-12">
      {/* 头部标题与操作 */}
      <header className="mb-4 flex flex-col gap-3 sm:mb-6 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[22px] font-medium text-neutral-950 sm:text-[28px]">灵感广场</h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-neutral-500 sm:mt-2 sm:text-sm sm:leading-6">
            浏览公开作品和精选模板，按分类搜索，查看原图、比例和提示词后直接带入创作。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 px-3 text-[13px] text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-50 sm:gap-2 sm:px-3.5 sm:text-sm"
          >
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
            刷新
          </button>
        </div>
      </header>

      {/* 搜索与排序 */}
      <section className="mb-3 rounded-[16px] border border-neutral-200 bg-white p-2.5 shadow-sm sm:p-3">
        <div className="grid gap-2.5 sm:gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
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
            <SlidersHorizontal size={16} className="hidden shrink-0 sm:block" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-10 w-full min-w-[130px] rounded-[12px] border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-800 outline-none focus:border-neutral-300"
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

      {/* 动态分类标签 (支持自动换行分行显示；「我的收藏」使用金色强调样式) */}
      <div className="mb-4 flex flex-wrap gap-2">
        {categoryStats.map((c) => {
          const active = c.name === category;
          const isFav = c.name === FAVORITES_TAB;
          return (
            <button
              key={c.name}
              type="button"
              onClick={() => setCategory(c.name)}
              className={cn(
                'h-8 rounded-full border px-2.5 text-[13px] transition flex items-center gap-1.5 cursor-pointer sm:px-3 sm:text-sm',
                isFav
                  ? active
                    ? 'border-amber-500 bg-gradient-to-r from-amber-400 to-amber-500 text-white font-semibold shadow-[0_2px_10px_rgba(245,158,11,.45)]'
                    : 'border-amber-400/80 bg-amber-50 text-amber-700 font-semibold hover:border-amber-500 hover:bg-amber-100 hover:shadow-[0_2px_8px_rgba(245,158,11,.3)]'
                  : active
                  ? 'border-neutral-950 bg-neutral-950 text-white font-medium shadow-sm'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950'
              )}
            >
              {isFav && <Star size={13} className={cn('shrink-0', active ? 'fill-current' : 'fill-amber-400 text-amber-500')} />}
              <span>{isFav ? '我的收藏' : c.name}</span>
              <span className={cn('text-[11px] sm:text-xs', isFav ? (active ? 'text-white/90 font-normal' : 'text-amber-500') : active ? 'text-white/80 font-normal' : 'text-neutral-400')}>
                {c.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex items-center justify-between text-xs text-neutral-400 sm:text-sm">
        <span>
          {category === FAVORITES_TAB ? `我的收藏共 ${filtered.length} 个灵感` : `当前分类包含 ${filtered.length} 个灵感`}
        </span>
      </div>

      {/* 瀑布流卡片列表 */}
      <div
        className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5"
        style={{ columnWidth: '240px' }}
      >
        {filtered.map((item) => {
          const { zh, en } = parseBilingualPrompt(item.prompt);
          return (
          <article
            key={item.id}
            onClick={() => setDetailItem(item)}
            className={cn(
              'group relative mb-4 break-inside-avoid cursor-pointer overflow-hidden rounded-[16px] border bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md',
              item.isFavorite ? 'border-amber-300 ring-1 ring-amber-300/60' : 'border-neutral-200'
            )}
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
                {/* 收藏星标（悬浮于封面右上角） */}
                <button
                  type="button"
                  onClick={(e) => handleFavorite(e, item.id)}
                  title={item.isFavorite ? '取消收藏' : '收藏'}
                  className={cn(
                    'absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full backdrop-blur-sm transition',
                    item.isFavorite
                      ? 'bg-amber-400 text-white shadow-[0_2px_10px_rgba(245,158,11,.55)] scale-105'
                      : 'bg-black/45 text-white/85 hover:bg-amber-400 hover:scale-105 hover:shadow-[0_2px_10px_rgba(245,158,11,.55)]'
                  )}
                >
                  <Star size={15} className={cn(item.isFavorite && 'fill-current')} />
                </button>
              </div>
            ) : (
              <div className="relative flex aspect-[4/5] w-full items-center justify-center bg-neutral-50 text-neutral-400">
                <WandSparkles size={32} />
                <button
                  type="button"
                  onClick={(e) => handleFavorite(e, item.id)}
                  title={item.isFavorite ? '取消收藏' : '收藏'}
                  className={cn(
                    'absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full backdrop-blur-sm transition',
                    item.isFavorite
                      ? 'bg-amber-400 text-white shadow-md'
                      : 'bg-black/45 text-white/85 hover:bg-amber-400'
                  )}
                >
                  <Star size={15} className={cn(item.isFavorite && 'fill-current')} />
                </button>
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
                {zh || en}
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

                {item.isFavorite && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                    <Star size={12} className="fill-amber-400 text-amber-500" />
                    已收藏
                  </span>
                )}
              </div>

              {/* 中/英文分开一键导入 */}
              <div className="mt-2 flex gap-2">
                {zh && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUse(zh);
                    }}
                    title="导入中文提示词到工作台"
                    className="flex h-8 flex-1 items-center justify-center gap-1 rounded-[10px] bg-neutral-950 text-[11px] font-medium text-white transition hover:bg-neutral-800 cursor-pointer"
                  >
                    <span className="rounded bg-white/20 px-1 text-[9px] font-bold">中</span>
                    导入中文
                  </button>
                )}
                {en && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUse(en);
                    }}
                    title="导入英文提示词到工作台"
                    className="flex h-8 flex-1 items-center justify-center gap-1 rounded-[10px] border border-neutral-300 bg-white text-[11px] font-medium text-neutral-800 transition hover:bg-neutral-50 cursor-pointer"
                  >
                    <span className="rounded bg-sky-100 px-1 text-[9px] font-bold text-sky-700">EN</span>
                    导入英文
                  </button>
                )}
              </div>
            </div>
          </article>
          );
        })}
      </div>

      {/* 详情弹窗（与历史记录 Lightbox 同形式） */}
      {detailItem && (
        <InspirationDetail
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onImport={(prompt) => {
            setDetailItem(null);
            handleUse(prompt);
          }}
          onToggleFavorite={(id) => {
            const fakeEvt = { stopPropagation: () => {} } as React.MouseEvent;
            handleFavorite(fakeEvt, id);
            setDetailItem((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : prev));
          }}
          liked={likedIds.has(detailItem.id)}
          onLike={(id) => handleLike({ stopPropagation: () => {} } as React.MouseEvent, id)}
        />
      )}
    </div>
  );
}
