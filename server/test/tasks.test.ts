import { describe, it, expect, beforeAll, vi } from 'vitest';
import { buildApp } from '../src/app.js';

function getCookie(login: any): string {
  const h = login.headers['set-cookie'];
  const first = Array.isArray(h) ? h[0] : h;
  return first ? first.split(';')[0] : '';
}


let app: Awaited<ReturnType<typeof buildApp>>;
let cookie: string;

// mock 上游：返回一个 b64 PNG（1x1 像素）
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

beforeAll(async () => {
  const fakeFetch = vi.fn(async (url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}'));
    if (String(url).endsWith('/v1/images/generations') || String(url).endsWith('/v1/images/edits')) {
      if (!body.model) throw new Error('missing model');
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [{ b64_json: PNG_B64, url: null }] }),
      } as any;
    }
    throw new Error('unexpected upstream call: ' + url);
  });
  app = await buildApp({
    accessPassword: 'pw',
    secretKey: 'k'.repeat(32),
    dataDir: ':memory:dir:',
    upstreamFetch: fakeFetch as any,
  });
  await app.ready();
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'admin', password: 'woshiniu2' } });
  cookie = ((login.headers['set-cookie'] as any as string[] | string) as any)[0] ? (Array.isArray(login.headers['set-cookie']) ? (login.headers['set-cookie'] as string[])[0] : (login.headers['set-cookie'] as string)).split(';')[0] : '';
  // 配置上游
  await app.inject({
    method: 'PUT',
    url: '/api/settings',
    headers: { cookie },
    payload: { baseUrl: 'https://gw.test', apiKey: 'sk-test', imageModel: 'test-image-model' },
  });
});

describe('图片生成任务', () => {
  it('提交任务 → 同步完成，返回本站 media URL 且文件落盘', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie },
      payload: { prompt: 'a cat', ratio: '1:1' },
    });
    expect(res.statusCode).toBe(200);
    const task = res.json();
    expect(task.status).toBe('done');
    expect(task.resultUrl).toMatch(/^\/media\//);
    expect(task.error).toBeNull();

    // 文件确实可取
    const img = await app.inject({ method: 'GET', url: task.resultUrl, headers: { cookie } });
    expect(img.statusCode).toBe(200);
    expect(img.headers['content-type']).toMatch(/png/);

    // 未登录不能取 media
    const img401 = await app.inject({ method: 'GET', url: task.resultUrl });
    expect(img401.statusCode).toBe(401);
  });

  it('任务出现在任务列表并可删除（含文件）', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie },
      payload: { prompt: 'a dog', ratio: '16:9' },
    });
    const task = create.json();
    const list = await app.inject({ method: 'GET', url: '/api/tasks', headers: { cookie } });
    expect(list.json().some((t: any) => t.id === task.id)).toBe(true);

    const del = await app.inject({ method: 'DELETE', url: `/api/tasks/${task.id}`, headers: { cookie } });
    expect(del.statusCode).toBe(200);
    const gone = await app.inject({ method: 'GET', url: task.resultUrl, headers: { cookie } });
    expect(gone.statusCode).toBe(404);
  });

  it('上游失败 → 任务标记 failed 且带错误信息', { timeout: 30000 }, async () => {
    const badApp = await buildApp({
      accessPassword: 'pw',
      secretKey: 'k'.repeat(32),
      dataDir: ':memory:dir:',
      upstreamFetch: (async () => ({
        ok: false,
        status: 502,
        text: async () => 'bad gateway',
      })) as any,
    });
    await badApp.ready();
    const login = await badApp.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'admin', password: 'woshiniu2' } });
    const ck = getCookie(login);
    await badApp.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { cookie: ck },
      payload: { baseUrl: 'https://gw.test', apiKey: 'sk', imageModel: 'm' },
    });
    const res = await badApp.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie: ck },
      payload: { prompt: 'x', ratio: '1:1' },
    });
    const task = res.json();
    expect(task.status).toBe('failed');
    expect(String(task.error)).toBeTruthy();
  });

  it('未配置上游 → 400 提示', async () => {
    const fresh = await buildApp({
      accessPassword: 'pw',
      secretKey: 'k'.repeat(32),
      dataDir: ':memory:dir:',
    });
    await fresh.ready();
    const login = await fresh.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'admin', password: 'woshiniu2' } });
    const ck = getCookie(login);
    const res = await fresh.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie: ck },
      payload: { prompt: 'x', ratio: '1:1' },
    });
    expect(res.statusCode).toBe(400);
  });
});
