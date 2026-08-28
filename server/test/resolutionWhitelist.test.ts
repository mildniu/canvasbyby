import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

function getCookie(res: any): string {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return '';
  return Array.isArray(setCookie) ? setCookie[0].split(';')[0] : setCookie.split(';')[0];
}

function makeMockFetch() {
  return (async () => ({
    ok: true,
    json: async () => ({
      data: [
        {
          b64_json:
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        },
      ],
    }),
  })) as any;
}

describe('分辨率白名单 (Resolution Whitelist)', () => {
  it('全局与用户级分辨率限制生效，/api/models 返回允许档位，生图接口拦截越权分辨率', async () => {
    const app = await buildApp({
      accessPassword: 'woshiniu2',
      secretKey: 'r'.repeat(32),
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

    // 2. 设置全局默认：仅允许 1K 与 2K
    const setGlobal = await app.inject({
      method: 'PUT',
      url: '/api/admin/allowed-resolutions',
      headers: { cookie: adminCk },
      payload: { allowedResolutions: ['1K', '2K'] },
    });
    expect(setGlobal.statusCode).toBe(200);
    expect(setGlobal.json().allowedResolutions).toEqual(['1K', '2K']);

    // 3. 创建用户 alice 与 bob
    for (const name of ['alice', 'bob']) {
      await app.inject({
        method: 'POST',
        url: '/api/admin/users',
        headers: { cookie: adminCk },
        payload: { username: name, password: 'password123', role: 'user', credits: 50 },
      });
    }
    const login = async (name: string) => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: name, password: 'password123' },
      });
      return getCookie(res);
    };
    const aliceCk = await login('alice');
    const bobCk = await login('bob');

    // 4. Alice 视角：允许的分辨率为 1K/2K
    const aliceModels = await app.inject({
      method: 'GET',
      url: '/api/models',
      headers: { cookie: aliceCk },
    });
    expect(aliceModels.json().allowedResolutions).toEqual(['1K', '2K']);

    // 5. Alice 使用 4K -> 403 拦截
    const blocked = await app.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie: aliceCk },
      payload: { prompt: 'a cat', model: 'Qwen-Image', ratio: '1:1', resolution: '4K' },
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error).toContain('分辨率');

    // 6. 为 bob 单独配置：仅 1K（覆盖全局）
    const usersList = await app.inject({
      method: 'GET',
      url: '/api/admin/users',
      headers: { cookie: adminCk },
    });
    const bob = usersList.json().find((u: any) => u.username === 'bob');
    const setBob = await app.inject({
      method: 'PUT',
      url: `/api/admin/users/${bob.id}/allowed-resolutions`,
      headers: { cookie: adminCk },
      payload: { allowedResolutions: ['1K'] },
    });
    expect(setBob.statusCode).toBe(200);

    // 7. Bob 视角：仅 1K；bob 使用 2K -> 拦截
    const bobModels = await app.inject({
      method: 'GET',
      url: '/api/models',
      headers: { cookie: bobCk },
    });
    expect(bobModels.json().allowedResolutions).toEqual(['1K']);
    const bobBlocked = await app.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie: bobCk },
      payload: { prompt: 'a cat', model: 'Qwen-Image', ratio: '1:1', resolution: '2K' },
    });
    expect(bobBlocked.statusCode).toBe(403);

    // 8. Bob 使用 1K -> 正常生成
    const bobOk = await app.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie: bobCk },
      payload: { prompt: 'a cat', model: 'Qwen-Image', ratio: '1:1', resolution: '1K' },
    });
    expect(bobOk.statusCode).toBe(200);
    expect(bobOk.json().status).toBe('done');

    // 9. Admin 不受限：4K 直接生成
    const adminOk = await app.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie: adminCk },
      payload: { prompt: 'a cat', model: 'Qwen-Image', ratio: '1:1', resolution: '4K' },
    });
    expect(adminOk.statusCode).toBe(200);

    // 10. bob 恢复继承全局
    const inherit = await app.inject({
      method: 'PUT',
      url: `/api/admin/users/${bob.id}/allowed-resolutions`,
      headers: { cookie: adminCk },
      payload: { mode: 'inherit' },
    });
    expect(inherit.statusCode).toBe(200);
    expect(inherit.json().userAllowedResolutions).toBeNull();
    const bobModelsAfter = await app.inject({
      method: 'GET',
      url: '/api/models',
      headers: { cookie: bobCk },
    });
    expect(bobModelsAfter.json().allowedResolutions).toEqual(['1K', '2K']);

    // 11. 清空全局 -> 不限制
    await app.inject({
      method: 'PUT',
      url: '/api/admin/allowed-resolutions',
      headers: { cookie: adminCk },
      payload: { allowedResolutions: [] },
    });
    const aliceModelsAfter = await app.inject({
      method: 'GET',
      url: '/api/models',
      headers: { cookie: aliceCk },
    });
    expect(aliceModelsAfter.json().allowedResolutions).toEqual(['1K', '2K', '4K']);

    await app.close();
  });

  it('专属接口用户不受分辨率限制', async () => {
    const app = await buildApp({
      accessPassword: 'woshiniu2',
      secretKey: 's'.repeat(32),
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
    // 全局仅允许 1K
    await app.inject({
      method: 'PUT',
      url: '/api/admin/allowed-resolutions',
      headers: { cookie: adminCk },
      payload: { allowedResolutions: ['1K'] },
    });

    // 用户配置专属接口
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
      payload: { baseUrl: 'https://my-own.test', apiKey: 'sk-my-own' },
    });

    // 专属接口用户：允许全部档位，4K 可用
    const models = await app.inject({
      method: 'GET',
      url: '/api/models',
      headers: { cookie: userCk },
    });
    expect(models.json().allowedResolutions).toEqual(['1K', '2K', '4K']);
    const task = await app.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie: userCk },
      payload: { prompt: 'a cat', model: 'Qwen-Image', ratio: '1:1', resolution: '4K' },
    });
    expect(task.statusCode).toBe(200);
    expect(task.json().status).toBe('done');

    await app.close();
  });
});
