import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Task } from '../lib/api';

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    api.listTasks().then(setTasks).catch(() => {});
  }, []);

  const dones = tasks.filter((t) => t.status === 'done');

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">最近作品</h1>
        <Link to="/create" className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white">
          ✨ 开始创作
        </Link>
      </div>

      {dones.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 p-12 text-center text-sm text-neutral-500">
          还没有作品，先生成一张图片吧
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {dones.map((t) => (
            <Link key={t.id} to="/history" className="group block overflow-hidden rounded-xl border border-neutral-800">
              <img
                src={`${t.resultUrl!}?thumb=1`}
                alt={t.prompt}
                loading="lazy"
                className="aspect-square w-full object-cover transition-opacity group-hover:opacity-90"
              />
              <p className="truncate px-2 py-1.5 text-xs text-neutral-500">{t.prompt}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
