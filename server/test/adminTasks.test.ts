import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

function getCookie(res: any): string {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return '';
  return Array.isArray(setCookie) ? setCookie[0].split(';')[0] : setCookie.split(';')[0];
}

describe('管理员全局生成记录 (Admin Tasks)', () => {
  it('管理员可查看所有用户的记录并附带用户名，支持筛选与统计', async () => {
    const app = await buildApp({
      accessPassword: 'woshiniu2',
      secretKey: 't'.repeat(32),
      dataDir: ':memory:dir:',
      upstreamFetch: (async () => ({
        ok: true,
        json: async () => ({
          data: [
            {
              b64_json:
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            },
          ],
        }),
      })) as any,
    });
    await app.ready();

    // 1. Admin 登录并配网关
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'woshiniu2' },
    });
    const adminCk = getCookie(adminLogin);
    await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { cookie: adminCk },
      payload: { baseUrl: 'https://gw.test', apiKey: 'sk-test' },
    });

    // 2. 创建两个普通用户
    for (const name of ['alice', 'bob']) {
      await app.inject({
        method: 'POST',
        url: '/api/admin/users',
        headers: { cookie: adminCk },
        payload: { username: name, password: 'password123', role: 'user', credits: 50 },
      });
    }

    // 3. alice 生成 2 张（Qwen-Image 扣 1 分），bob 生成 1 张（gpt-image-2 扣 2 分）
    const aliceLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'alice', password: 'password123' },
    });
    const aliceCk = getCookie(aliceLogin);
    const bobLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'bob', password: 'password123' },
    });
    const bobCk = getCookie(bobLogin);

    await app.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie: aliceCk },
      payload: { prompt: 'a red cat', model: 'Qwen-Image', ratio: '1:1' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie: aliceCk },
      payload: { prompt: 'a blue dog', model: 'Qwen-Image', ratio: '1:1' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie: bobCk },
      payload: { prompt: 'a green bird', model: 'gpt-image-2', ratio: '1:1' },
    });

    // 4. Admin 查看全部记录 -> 3 条，每条带正确的用户名
    const all = await app.inject({
      method: 'GET',
      url: '/api/admin/tasks',
      headers: { cookie: adminCk },
    });
    expect(all.statusCode).toBe(200);
    const allBody = all.json();
    expect(allBody.tasks).toHaveLength(3);

    const usernames = allBody.tasks.map((t: any) => t.username).sort();
    expect(usernames).toEqual(['alice', 'alice', 'bob']);

    // alice 的记录扣了积分，bob 的也扣了
    const aliceTask = allBody.tasks.find((t: any) => t.username === 'alice');
    expect(aliceTask.creditsCost).toBe(1);
    const bobTask = allBody.tasks.find((t: any) => t.username === 'bob');
    expect(bobTask.creditsCost).toBe(2);

    // 5. 统计信息：alice 2 条、bob 1 条，积分消耗 1+1+2=4
    const statsMap = Object.fromEntries(allBody.stats.map((s: any) => [s.username, s]));
    expect(statsMap.alice.count).toBe(2);
    expect(statsMap.alice.doneCount).toBe(2);
    expect(statsMap.bob.count).toBe(1);
    expect(statsMap.bob.totalCredits).toBe(2);
    const totalCredits = allBody.stats.reduce((sum: number, s: any) => sum + s.totalCredits, 0);
    expect(totalCredits).toBe(4);

    // 6. 按状态筛选：done -> 3 条
    const doneOnly = await app.inject({
      method: 'GET',
      url: "/api/admin/tasks?status=done",
      headers: { cookie: adminCk },
    });
    expect(doneOnly.json().tasks).toHaveLength(3);

    // 7. 按提示词搜索：'red cat' -> 仅 1 条且属于 alice
    const search = await app.inject({
      method: 'GET',
      url: '/api/admin/tasks?q=red cat',
      headers: { cookie: adminCk },
    });
    const searchBody = search.json();
    expect(searchBody.tasks).toHaveLength(1);
    expect(searchBody.tasks[0].username).toBe('alice');
    expect(searchBody.tasks[0].prompt).toContain('red cat');

    // 8. 按模型筛选：gpt-image-2 -> 仅 bob 的 1 条
    const byModel = await app.inject({
      method: 'GET',
      url: '/api/admin/tasks?model=gpt-image-2',
      headers: { cookie: adminCk },
    });
    const byModelBody = byModel.json();
    expect(byModelBody.tasks).toHaveLength(1);
    expect(byModelBody.tasks[0].username).toBe('bob');

    // 9. 按用户名筛选：alice -> 2 条全部属于 alice
    const byUser = await app.inject({
      method: 'GET',
      url: '/api/admin/tasks?user=alice',
      headers: { cookie: adminCk },
    });
    const byUserBody = byUser.json();
    expect(byUserBody.tasks).toHaveLength(2);
    expect(byUserBody.tasks.every((t: any) => t.username === 'alice')).toBe(true);

    await app.close();
  });

  it('非管理员无权访问全局记录', async () => {
    const app = await buildApp({
      accessPassword: 'woshiniu2',
      secretKey: 'u'.repeat(32),
      dataDir: ':memory:dir:',
      upstreamFetch: (async () => ({ ok: true, json: async () => ({ data: [] }) })) as any,
    });
    await app.ready();

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'woshiniu2' },
    });
    const adminCk = getCookie(adminLogin);
    await app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { cookie: adminCk },
      payload: { username: 'snooper', password: 'password123', role: 'user', credits: 20 },
    });
    const userLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'snooper', password: 'password123' },
    });
    const userCk = getCookie(userLogin);

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/tasks',
      headers: { cookie: userCk },
    });
    expect(res.statusCode).toBe(403);

    await app.close();
  });
});
