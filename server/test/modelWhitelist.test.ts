import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

function getCookie(res: any): string {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return '';
  return Array.isArray(setCookie) ? setCookie[0].split(';')[0] : setCookie.split(';')[0];
}

// 模拟上游 /v1/models 返回多个生图模型
const MOCK_MODELS = [
  'Qwen-Image',
  'Qwen-Image-Edit-2509',
  'gpt-image-2',
  'gpt-image-2-4k',
  'gemini-3.1-flash-image',
  'grok-imagine-image',
];

function makeMockFetch(models: string[] = MOCK_MODELS) {
  return (async (url: string) => {
    if (String(url).includes('/v1/models')) {
      return {
        ok: true,
        json: async () => ({ data: models.map((id) => ({ id })) }),
      };
    }
    // 生图请求
    return {
      ok: true,
      json: async () => ({
        data: [{ b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' }],
      }),
    };
  }) as any;
}

describe('模型白名单 (Admin Model Whitelist)', () => {
  it('管理员可设置白名单，普通用户模型列表被过滤', async () => {
    const app = await buildApp({
      accessPassword: 'woshiniu2',
      secretKey: 'w'.repeat(32),
      dataDir: ':memory:dir:',
      upstreamFetch: makeMockFetch(),
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

    // 2. Admin 拉取模型列表 -> 全量可见
    const adminModels = await app.inject({
      method: 'GET',
      url: '/api/models',
      headers: { cookie: adminCk },
    });
    expect(adminModels.statusCode).toBe(200);
    expect(adminModels.json().models).toHaveLength(6);

    // 3. 设置白名单：仅允许 Qwen 系列
    const setWl = await app.inject({
      method: 'PUT',
      url: '/api/admin/allowed-models',
      headers: { cookie: adminCk },
      payload: { allowedModels: ['Qwen-Image', 'Qwen-Image-Edit-2509'] },
    });
    expect(setWl.statusCode).toBe(200);
    expect(setWl.json().allowedModels).toEqual(['Qwen-Image', 'Qwen-Image-Edit-2509']);

    // 4. 创建普通用户并登录
    await app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { cookie: adminCk },
      payload: { username: 'limited', password: 'password123', role: 'user', credits: 50 },
    });
    const userLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'limited', password: 'password123' },
    });
    const userCk = getCookie(userLogin);

    // 5. 普通用户拉取模型列表 -> 仅能看到白名单中的 2 个
    const userModels = await app.inject({
      method: 'GET',
      url: '/api/models',
      headers: { cookie: userCk },
    });
    expect(userModels.statusCode).toBe(200);
    expect(userModels.json().models).toEqual(['Qwen-Image', 'Qwen-Image-Edit-2509']);

    // 6. 普通用户调用白名单外模型 -> 403 拦截
    const blocked = await app.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie: userCk },
      payload: { prompt: 'a cat', model: 'gpt-image-2', ratio: '1:1' },
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error).toContain('未对普通用户开放');

    // 7. 普通用户调用白名单内模型 -> 正常生成并扣 1 积分
    const allowedTask = await app.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie: userCk },
      payload: { prompt: 'a cat', model: 'Qwen-Image', ratio: '1:1' },
    });
    expect(allowedTask.statusCode).toBe(200);
    expect(allowedTask.json().status).toBe('done');
    expect(allowedTask.json().userCredits).toBe(49);

    // 8. 管理员调用白名单外模型 -> 不受限
    const adminTask = await app.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie: adminCk },
      payload: { prompt: 'a cat', model: 'gpt-image-2', ratio: '1:1' },
    });
    expect(adminTask.statusCode).toBe(200);
    expect(adminTask.json().status).toBe('done');

    // 9. 清空白名单 -> 普通用户恢复全量模型
    await app.inject({
      method: 'PUT',
      url: '/api/admin/allowed-models',
      headers: { cookie: adminCk },
      payload: { allowedModels: [] },
    });
    const userModelsAfter = await app.inject({
      method: 'GET',
      url: '/api/models',
      headers: { cookie: userCk },
    });
    expect(userModelsAfter.json().models).toHaveLength(6);

    await app.close();
  });

  it('配置专属接口的普通用户不受白名单限制', async () => {
    const app = await buildApp({
      accessPassword: 'woshiniu2',
      secretKey: 'x'.repeat(32),
      dataDir: ':memory:dir:',
      upstreamFetch: makeMockFetch(),
    });
    await app.ready();

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
      payload: { baseUrl: 'https://gw.test', apiKey: 'sk-admin' },
    });

    // 设置白名单仅允许 Qwen-Image
    await app.inject({
      method: 'PUT',
      url: '/api/admin/allowed-models',
      headers: { cookie: adminCk },
      payload: { allowedModels: ['Qwen-Image'] },
    });

    // 创建用户并配置专属接口
    await app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { cookie: adminCk },
      payload: { username: 'customgw', password: 'password123', role: 'user', credits: 10 },
    });
    const userLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'customgw', password: 'password123' },
    });
    const userCk = getCookie(userLogin);
    await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { cookie: userCk },
      payload: { baseUrl: 'https://my-own-gw.test', apiKey: 'sk-my-own' },
    });

    // 专属接口用户拉取模型列表 -> 全量可见（不受白名单限制）
    const models = await app.inject({
      method: 'GET',
      url: '/api/models',
      headers: { cookie: userCk },
    });
    expect(models.json().models).toHaveLength(6);

    // 专属接口用户调用白名单外模型 -> 正常，免积分
    const task = await app.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie: userCk },
      payload: { prompt: 'a cat', model: 'gpt-image-2', ratio: '1:1' },
    });
    expect(task.statusCode).toBe(200);
    expect(task.json().status).toBe('done');
    expect(task.json().userCredits).toBe(10); // 未扣积分

    await app.close();
  });

  it('非管理员无法管理白名单', async () => {
    const app = await buildApp({
      accessPassword: 'woshiniu2',
      secretKey: 'y'.repeat(32),
      dataDir: ':memory:dir:',
      upstreamFetch: makeMockFetch(),
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
      payload: { username: 'hacker', password: 'password123', role: 'user', credits: 20 },
    });
    const userLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'hacker', password: 'password123' },
    });
    const userCk = getCookie(userLogin);

    const read = await app.inject({
      method: 'GET',
      url: '/api/admin/allowed-models',
      headers: { cookie: userCk },
    });
    expect(read.statusCode).toBe(403);

    const write = await app.inject({
      method: 'PUT',
      url: '/api/admin/allowed-models',
      headers: { cookie: userCk },
      payload: { allowedModels: ['gpt-image-2'] },
    });
    expect(write.statusCode).toBe(403);

    await app.close();
  });
});
