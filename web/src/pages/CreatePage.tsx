import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Upload,
  ArrowUp,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Mic,
  X,
} from 'lucide-react';
import { useApp } from '../stores/app';
import { cn } from '../lib/utils';
import { api, type Task } from '../lib/api';
import { PillSelect, type Option } from '../components/PillSelect';
import { InspirationModal, type InspirationItem } from '../components/InspirationModal';
import { TaskCard } from '../components/TaskCard';
import { Lightbox } from '../components/Lightbox';
import { LivePreviewDock, type ActiveJob } from '../components/LivePreviewDock';

// 静态兜底列表：中转站模型列表拉取失败时使用
const FALLBACK_MODELS: Option[] = [
  { value: 'Qwen-Image', label: 'Qwen-Image (通义万相)', cost: 1 },
  { value: 'Qwen-Image-Edit-2509', label: 'Qwen-Image-Edit-2509 (通义编辑)', cost: 1 },
  { value: 'gpt-image-2', label: 'GPT Image 2', cost: 2 },
  { value: 'gemini-3.1-flash-image', label: 'Gemini 3.1 Flash Image', cost: 2 },
  { value: 'grok-imagine-image', label: 'Grok Imagine', cost: 2 },
];

// 常用画幅比例：覆盖社交头像、短视频、横屏壁纸、海报、电影宽幅等主流场景
const RATIOS = [
  { value: '1:1', label: '1:1 方图' },
  { value: '4:3', label: '4:3 横屏' },
  { value: '3:4', label: '3:4 竖屏' },
  { value: '16:9', label: '16:9 宽屏' },
  { value: '9:16', label: '9:16 竖屏' },
  { value: '3:2', label: '3:2 相机' },
  { value: '2:3', label: '2:3 海报' },
  { value: '21:9', label: '21:9 电影' },
  { value: '9:21', label: '9:21 长图' },
];

const RESOLUTIONS = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
];

const COUNTS = [
  { value: '1', label: '1张' },
  { value: '2', label: '2张' },
  { value: '4', label: '4张' },
];

const MAX_REFS = 10;

/** 前端压缩图片（JPEG 控制体积，长边≤1600px） */
async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.9);
}

export default function CreatePage() {
  const user = useApp((s) => s.user);
  const setCredits = useApp((s) => s.setCredits);

  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('');
  const [modelOptions, setModelOptions] = useState<Option[]>(FALLBACK_MODELS);
  const [ratio, setRatio] = useState('1:1');
  const [resolution, setResolution] = useState('1K');
  const [resolutionOptions, setResolutionOptions] = useState<Option[]>(RESOLUTIONS);
  const [count, setCount] = useState('1');
  const [refs, setRefs] = useState<{ id: string; name: string; dataUrl: string }[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [templates, setTemplates] = useState<InspirationItem[]>([]);
  const [inspModalOpen, setInspModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [previewTask, setPreviewTask] = useState<Task | null>(null);
  const [refPreview, setRefPreview] = useState<{ id: string; name: string; dataUrl: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const nav = useNavigate();

  // 从中转站动态拉取可用生图模型列表、定价与允许的分辨率档位
  useEffect(() => {
    api
      .getModels()
      .then((data) => {
        if (Array.isArray(data.models) && data.models.length > 0) {
          const options: Option[] = data.models.map((m) => ({
            value: m,
            label: m,
            cost: data.pricing?.[m] ?? 2,
          }));
          setModelOptions(options);
          // 默认选中第一个可用模型
          setModel((cur) => (cur && data.models.includes(cur) ? cur : data.models[0]));
        }
        // 分辨率白名单：仅展示被允许的档位；默认选中最高的允许档位
        if (Array.isArray(data.allowedResolutions) && data.allowedResolutions.length > 0) {
          const sorted = ['1K', '2K', '4K'].filter((r) => data.allowedResolutions!.includes(r));
          const resOptions: Option[] = sorted.map((r) => ({ value: r, label: r }));
          setResolutionOptions(resOptions);
          setResolution((cur) => (sorted.includes(cur) ? cur : sorted[0]));
        }
      })
      .catch(() => {
        // 拉取失败使用兜底列表
        setModelOptions(FALLBACK_MODELS);
        setModel((cur) => cur || FALLBACK_MODELS[0].value);
      });
  }, []);

  // 当前选中模型的积分单价与是否免扣积分
  const currentModelOption = modelOptions.find((o) => o.value === model) ?? modelOptions[0];
  const isFree = user?.role === 'admin' || !!user?.hasCustomGateway;
  const currentCost = isFree ? 0 : (currentModelOption?.cost ?? 2);
  const isInsufficient = !isFree && (user?.credits ?? 0) < currentCost;

  // 加载灵感模板与历史任务
  useEffect(() => {
    fetch('/api/inspirations')
      .then((r) => (r.ok ? r.json() : []))
      .then(setTemplates)
      .catch(() => {});

    loadTasks();
  }, []);

  const loadTasks = () => {
    api.listTasks().then(setTasks).catch(() => {});
  };

  // 如果上传了参考图且当前选的是 Qwen-Image，自动转为编辑模型（仅当中转站提供该模型时）
  useEffect(() => {
    const has = (m: string) => modelOptions.some((o) => o.value === m);
    if (refs.length > 0 && model === 'Qwen-Image' && has('Qwen-Image-Edit-2509')) {
      setModel('Qwen-Image-Edit-2509');
    } else if (refs.length === 0 && model === 'Qwen-Image-Edit-2509' && has('Qwen-Image')) {
      setModel('Qwen-Image');
    }
  }, [refs.length, model, modelOptions]);

  // 接收从灵感广场跳过来的 state
  useEffect(() => {
    const state = location.state as { fromInspiration?: boolean; prompt?: string; ratio?: string; ref_assets?: string[] } | null;
    if (state?.fromInspiration) {
      if (state.prompt) setPrompt(state.prompt);
      if (state.ratio) setRatio(state.ratio);
      nav(location.pathname, { replace: true, state: null });
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [location, nav]);

  // 自动撑高 textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
    }
  }, [prompt]);

  const handleAddFiles = async (files: FileList | null) => {
    if (!files) return;
    const remain = MAX_REFS - refs.length;
    const list = Array.from(files).slice(0, remain);
    const added: typeof refs = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (!f.type.startsWith('image/')) continue;
      try {
        const dataUrl = await compressImage(f);
        added.push({ id: `ref-${Date.now()}-${i}`, name: f.name, dataUrl });
      } catch (err) {
        console.error('读取图片失败', err);
      }
    }
    setRefs((prev) => [...prev, ...added].slice(0, MAX_REFS));
  };

  const handleGenerate = async () => {
    const rawPrompt = prompt.trim();
    if (!rawPrompt || loading) return;
    if (isInsufficient) {
      alert(`积分不足：模型「${model}」生成需要 ${currentCost} 积分，您当前剩余 ${user?.credits ?? 0} 积分。请联系管理员充值。`);
      return;
    }

    const currentModel = model;
    const currentRatio = ratio;
    const currentRefs = refs.map((r) => r.dataUrl);
    const startTime = Date.now();

    // 1. 初始化右侧微型窗口为「实时生成中」
    setActiveJob({
      id: `temp-${startTime}`,
      prompt: rawPrompt,
      model: currentModel,
      ratio: currentRatio,
      startTime,
      elapsedMs: 0,
      status: 'running',
    });
    setLoading(true);

    // 2. 核心：立即清空输入框与参考图，光标重新就绪，方便进行下一次创作
    setPrompt('');
    setRefs([]);
    requestAnimationFrame(() => textareaRef.current?.focus());

    // 3. 异步请求后端
    try {
      const task = await api.createImage({
        prompt: rawPrompt,
        ratio: currentRatio,
        model: currentModel,
        refAssets: currentRefs,
      });

      const elapsedMs = Date.now() - startTime;
      if (task.status === 'done' && task.resultUrl) {
        setActiveJob({
          id: task.id,
          prompt: rawPrompt,
          model: currentModel,
          ratio: currentRatio,
          startTime,
          elapsedMs,
          status: 'done',
          resultUrl: task.resultUrl,
        });
      } else {
        setActiveJob({
          id: task.id,
          prompt: rawPrompt,
          model: currentModel,
          ratio: currentRatio,
          startTime,
          elapsedMs,
          status: 'failed',
          error: task.error || '生成失败',
        });
      }

      if (typeof task.userCredits === 'number') {
        setCredits(task.userCredits);
      }
      loadTasks();
    } catch (err: any) {
      setActiveJob({
        id: `err-${startTime}`,
        prompt: rawPrompt,
        model: currentModel,
        ratio: currentRatio,
        startTime,
        elapsedMs: Date.now() - startTime,
        status: 'failed',
        error: err?.message ?? '请求发生错误',
      });
      api.getMe().then((res) => {
        if (res.user && typeof res.user.credits === 'number') {
          setCredits(res.user.credits);
        }
      }).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('确定删除这个作品吗？')) return;
    await api.deleteTask(id).catch(() => {});
    loadTasks();
  };

  const handleScrollInsp = (dir: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * 300, behavior: 'smooth' });
    }
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1500px] px-3 pb-16 pt-5 sm:px-8 sm:pt-10 lg:px-12">
      {/* 居中创作区 (max-w-[1020px]) */}
      <section className="mx-auto max-w-[1020px]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
          <h1 className="text-[20px] font-medium tracking-normal text-neutral-950 sm:text-[28px]">
            图片
          </h1>
        </div>

        {/* 提示词输入卡片 + 右侧实时生成预览微窗口 */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-[1fr_250px] items-stretch">
          {/* 核心大输入卡片 (rounded-[28px] + 浮雕投影) */}
          <div className="flex flex-col justify-between rounded-[20px] border border-neutral-200 bg-white p-2.5 shadow-[0_18px_55px_rgba(15,23,42,.10)] sm:rounded-[28px] sm:p-4">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述新图片（点击生成后自动清空，方便继续下一次创作）"
              maxLength={5000}
              className="studio-prompt min-h-[60px] w-full resize-none border-0 bg-transparent px-2 pt-1 text-sm font-normal leading-6 text-neutral-950 outline-none ring-0 placeholder:font-normal placeholder:text-neutral-400 focus:border-0 focus:outline-none focus:ring-0 sm:min-h-[66px] sm:text-[15px] sm:leading-7"
            />

            {/* 底部控制栏 */}
            <div className="mt-2 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-2 max-sm:overflow-x-auto max-sm:pb-1 sm:flex-nowrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleAddFiles(e.target.files);
                    e.target.value = '';
                  }}
                />

                {/* 灵感菜单弹窗 */}
                <InspirationModal
                  open={inspModalOpen}
                  onOpenChange={setInspModalOpen}
                  templates={templates}
                  onPick={(item) => {
                    setPrompt(item.prompt);
                    setInspModalOpen(false);
                    requestAnimationFrame(() => textareaRef.current?.focus());
                  }}
                />

                {/* 上传参考图按钮 */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-neutral-600 hover:bg-neutral-100 transition cursor-pointer"
                  title={`上传参考图（支持多图，最多 ${MAX_REFS} 张）`}
                >
                  <Upload size={18} />
                </button>

                {/* 模型选择 (从中转站动态拉取的可用模型) */}
                <PillSelect
                  value={model}
                  options={modelOptions}
                  onChange={setModel}
                  wide
                  placeholder="请先在设置中配置网关"
                />

                {/* 比例选择 */}
                <PillSelect
                  value={ratio}
                  options={RATIOS}
                  onChange={setRatio}
                />

                {/* 分辨率 */}
                <PillSelect
                  value={resolution}
                  options={resolutionOptions}
                  onChange={setResolution}
                />

                {/* 生成张数 */}
                <PillSelect
                  value={count}
                  options={COUNTS}
                  onChange={setCount}
                />
              </div>

              {/* 右侧操作按钮与积分提示 */}
              <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition',
                      user?.hasCustomGateway
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                        : isInsufficient
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : 'bg-neutral-100 text-neutral-600'
                    )}
                    title={
                      user?.hasCustomGateway
                        ? '已配置专属网关接口，生成完全免费不消耗积分'
                        : user?.role === 'admin'
                        ? '管理员无扣费限制'
                        : `每次生成消耗 ${currentCost} 积分`
                    }
                  >
                    <span>{user?.hasCustomGateway ? '专属接口 (免积分)' : `单次: ${currentCost} 积分`}</span>
                  </span>
                  {isInsufficient && (
                    <span className="hidden sm:inline text-red-500 font-normal text-[11px]">
                      (积分不足)
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  title="语音输入"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-neutral-600 hover:bg-neutral-100 cursor-pointer"
                >
                  <Mic size={17} />
                </button>

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={loading || !prompt.trim() || isInsufficient}
                  title={isInsufficient ? `积分不足（需 ${currentCost} 积分，剩余 ${user?.credits ?? 0} 积分）` : '生成'}
                  className={cn(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-full text-white transition cursor-pointer',
                    isInsufficient
                      ? 'bg-red-400 cursor-not-allowed hover:bg-red-500'
                      : 'bg-neutral-950 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300'
                  )}
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <ArrowUp size={19} />
                  )}
                </button>
              </div>
            </div>

            {/* 参考图缩略列表 */}
            {refs.length > 0 && (
              <div className="mt-3 border-t border-neutral-100 pt-3">
                <div className="mb-2 text-xs text-neutral-400">
                  参考图 {refs.length} / {MAX_REFS}，支持点击放大；图生图会把这些图一起作为参考。
                </div>
                <div className="flex flex-wrap gap-2">
                  {refs.map((r, idx) => (
                    <div
                      key={r.id}
                      onClick={() => setRefPreview(r)}
                      className="group relative h-14 w-14 cursor-pointer overflow-hidden rounded-[12px] bg-neutral-100 outline-none ring-neutral-900/20 transition hover:ring-2"
                    >
                      <img src={r.dataUrl} alt={r.name} className="h-full w-full object-cover" />
                      <span className="pointer-events-none absolute left-1 top-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] leading-none text-white">
                        {idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRefs((arr) => arr.filter((x) => x.id !== r.id));
                        }}
                        className="absolute right-1 top-1 z-10 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                        title="移除"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 右侧：实时生成与耗时预览微窗口 */}
          <div className="w-full flex">
            <LivePreviewDock
              job={activeJob}
              onOpenTask={(task) => setPreviewTask(task)}
              onReusePrompt={(p) => {
                setPrompt(p);
                requestAnimationFrame(() => textareaRef.current?.focus());
              }}
            />
          </div>
        </div>
      </section>

      {/* 灵感推荐卡片横向滚动栏 */}
      <section className="mx-auto mt-8 max-w-[760px] sm:mt-12">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[20px] font-medium text-neutral-950">创建图片</h2>
          <div className="flex items-center gap-2 text-neutral-400">
            <button
              type="button"
              onClick={() => handleScrollInsp(-1)}
              className="grid h-9 w-9 place-items-center rounded-full border border-neutral-200 hover:text-neutral-900 transition"
              title="向左"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => handleScrollInsp(1)}
              className="grid h-9 w-9 place-items-center rounded-full border border-neutral-200 hover:text-neutral-900 transition"
              title="向右"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 no-scrollbar"
        >
          {templates.slice(0, 15).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setPrompt(item.prompt);
                requestAnimationFrame(() => textareaRef.current?.focus());
              }}
              className="group relative aspect-[4/5] w-[132px] shrink-0 snap-start overflow-hidden rounded-[22px] bg-neutral-100 text-left shadow-sm sm:w-[140px] transition"
            >
              {item.cover ? (
                <img
                  src={item.cover}
                  alt={item.title}
                  className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-neutral-400">
                  <Sparkles size={26} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <span className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-black/50 px-2 py-0.5 text-[11px] text-white">
                {item.category}
              </span>
              <span className="absolute bottom-2.5 left-2.5 right-2.5 truncate text-xs font-medium text-white drop-shadow">
                {item.title}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 我的作品瀑布流列表 */}
      <section className="mt-10 sm:mt-14">
        <div className="mx-auto mb-4 flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
          <h2 className="text-[20px] font-medium text-neutral-950">我的作品</h2>
        </div>

        {tasks.length === 0 ? (
          <div className="mx-auto grid max-w-[1500px] place-items-center rounded-[24px] border border-dashed border-neutral-200 py-14 text-neutral-400">
            <Sparkles size={28} />
            <p className="mt-2 text-sm">还没有作品，先生成一张图片吧</p>
          </div>
        ) : (
          <div
            className="mx-auto max-w-[1500px] columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5"
            style={{ columnWidth: '220px' }}
          >
            {tasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onOpen={setPreviewTask}
                onDelete={handleDeleteTask}
              />
            ))}
          </div>
        )}
      </section>

      {/* Lightbox 大图预览 */}
      {previewTask && (
        <Lightbox preview={previewTask} onClose={() => setPreviewTask(null)} />
      )}

      {/* 参考图查看浮层 */}
      {refPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setRefPreview(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <img src={refPreview.dataUrl} alt={refPreview.name} className="max-h-[85vh] rounded-xl object-contain" />
            <button
              onClick={() => setRefPreview(null)}
              className="absolute -right-3 -top-3 grid h-8 w-8 place-items-center rounded-full bg-white text-neutral-900 shadow-md"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
