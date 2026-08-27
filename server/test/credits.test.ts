import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';
import { getModelCreditCost } from '../src/credits.js';

function getCookie(res: any): string {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return '';
  return Array.isArray(setCookie) ? setCookie[0].split(';')[0] : setCookie.split(';')[0];
}

describe('积分系统 (Credits System)', () => {
  it('模型能力差异化定价规则正确 (Qwen=1分, GPT/Gemini/Grok=2分)', () => {
    // Qwen 系列 1 积分
    expect(getModelCreditCost('Qwen-Image')).toBe(1);
    expect(getModelCreditCost('Qwen-Image-Edit-2509')).toBe(1);
    expect(getModelCreditCost('Qwen/Qwen-Image-Edit')).toBe(1);
    expect(getModelCreditCost('qwen-image-plus')).toBe(1);

    // GPT 系列 2 积分
    expect(getModelCreditCost('gpt-image-2')).toBe(2);
    expect(getModelCreditCost('gpt-image-1.5')).toBe(2);
    expect(getModelCreditCost('dall-e-3')).toBe(2);

    // Gemini 系列 2 积分
    expect(getModelCreditCost('gemini-3.1-flash-image')).toBe(2);
    expect(getModelCreditCost('gemini-2.5-flash-image')).toBe(2);
    expect(getModelCreditCost('imagen-3')).toBe(2);

    // Grok 系列 2 积分
    expect(getModelCreditCost('grok-imagine-image')).toBe(2);
    expect(getModelCreditCost('grok-imagine-image-quality')).toBe(2);

    // 默认兜底 2 积分
    expect(getModelCreditCost('some-unknown-image-model')).toBe(2);
  });

  it('用户初始积分为 20 分，Admin 不受限制', async () => {
    const app = await buildApp({
      accessPassword: 'woshiniu2',
      secretKey: 'a'.repeat(32),
      dataDir: ':memory:dir:',
      upstreamFetch: (async () => ({
        ok: true,
        json: async () => ({ data: [{ b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' }] }),
      })) as any,
    });
    await app.ready();

    // 1. Admin 登录
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'woshiniu2' },
    });
    const adminCk = getCookie(adminLogin);
    const adminMe = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: adminCk },
    });
    expect(adminMe.json().user.credits).toBeGreaterThan(10000);

    // 2. Admin 配置网关
    await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { cookie: adminCk },
      payload: { baseUrl: 'https://gw.test', apiKey: 'sk-test' },
    });

    // 3. Admin 创建普通用户 testuser (初始 20 积分)
    const createUser = await app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { cookie: adminCk },
      payload: { username: 'testuser', password: 'password123', role: 'user' },
    });
    expect(createUser.statusCode).toBe(200);
    const userId = createUser.json().id;

    // 4. 普通用户登录并查询 me
    const userLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'testuser', password: 'password123' },
    });
    expect(userLogin.statusCode).toBe(200);
    expect(userLogin.json().user.credits).toBe(20);

    const userCk = getCookie(userLogin);
    const userMe = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: userCk },
    });
    expect(userMe.json().user.credits).toBe(20);

    // 5. 普通用户使用 Qwen-Image 生图 (消耗 1 积分)
    const task1 = await app.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie: userCk },
      payload: { prompt: 'a cute cat', model: 'Qwen-Image', ratio: '1:1' },
    });
    expect(task1.statusCode).toBe(200);
    expect(task1.json().status).toBe('done');
    expect(task1.json().creditsCost).toBe(1);
    expect(task1.json().userCredits).toBe(19);

    // 6. 普通用户使用 gpt-image-2 (消耗 2 积分)
    const task2 = await app.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie: userCk },
      payload: { prompt: 'a cute dog', model: 'gpt-image-2', ratio: '1:1' },
    });
    expect(task2.statusCode).toBe(200);
    expect(task2.json().creditsCost).toBe(2);
    expect(task2.json().userCredits).toBe(17);

    // 7. Admin 将用户积分修改为 1 分
    const setCredits = await app.inject({
      method: 'PUT',
      url: `/api/admin/users/${userId}`,
      headers: { cookie: adminCk },
      payload: { credits: 1 },
    });
    expect(setCredits.statusCode).toBe(200);

    // 8. 用户尝试使用 gpt-image-2 (需 2 积分) -> 拦截 402 积分不足
    const taskTooExpensive = await app.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie: userCk },
      payload: { prompt: 'a futuristic city', model: 'gpt-image-2', ratio: '1:1' },
    });
    expect(taskTooExpensive.statusCode).toBe(402);
    expect(taskTooExpensive.json().error).toContain('积分不足');

    // 9. 用户使用 Qwen-Image-Edit-2509 (需 1 积分) -> 成功并扣至 0 分
    const taskCheap = await app.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie: userCk },
      payload: { prompt: 'a flower', model: 'Qwen-Image-Edit-2509', ratio: '1:1' },
    });
    expect(taskCheap.statusCode).toBe(200);
    expect(taskCheap.json().userCredits).toBe(0);

    await app.close();
  });

  it('任务失败时自动向普通用户退还积分', async () => {
    const app = await buildApp({
      accessPassword: 'woshiniu2',
      secretKey: 'b'.repeat(32),
      dataDir: ':memory:dir:',
      upstreamFetch: (async () => ({
        ok: false,
        status: 500,
        text: async () => 'internal upstream error',
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

    // 2. 创建用户并登录
    await app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { cookie: adminCk },
      payload: { username: 'refunduser', password: 'password123', role: 'user', credits: 20 },
    });
    const userLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'refunduser', password: 'password123' },
    });
    const userCk = getCookie(userLogin);

    // 3. 执行必定失败的任务 (gpt-image-2 消耗 2 积分)
    const failedTask = await app.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie: userCk },
      payload: { prompt: 'fail me', model: 'gpt-image-2', ratio: '1:1' },
    });
    expect(failedTask.statusCode).toBe(200);
    expect(failedTask.json().status).toBe('failed');
    expect(failedTask.json().refunded).toBe(true);

    // 4. 检查用户积分依然是 20（扣 2 返 2）
    const userMe = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: userCk },
    });
    expect(userMe.json().user.credits).toBe(20);

    await app.close();
  }, 25000);

  it('普通用户配置自己的专属接口后免扣积分 (0积分)', async () => {
    let usedKey = '';
    const app = await buildApp({
      accessPassword: 'woshiniu2',
      secretKey: 'c'.repeat(32),
      dataDir: ':memory:dir:',
      upstreamFetch: (async (_url: string, init: any) => {
        usedKey = init?.headers?.Authorization || '';
        return {
          ok: true,
          json: async () => ({ data: [{ b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' }] }),
        };
      }) as any,
    });
    await app.ready();

    // 1. Admin 登录并配全局网关
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
      payload: { baseUrl: 'https://gw.test', apiKey: 'sk-admin-shared-key' },
    });

    // 2. 创建普通用户 customuser，初始 5 积分
    await app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { cookie: adminCk },
      payload: { username: 'customuser', password: 'password123', role: 'user', credits: 5 },
    });
    const userLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'customuser', password: 'password123' },
    });
    const userCk = getCookie(userLogin);

    // 3. 用户尚未配置专属网关 -> 使用平台共享接口 -> 消耗 2 积分 (5 -> 3)
    const taskShared = await app.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie: userCk },
      payload: { prompt: 'shared task', model: 'gpt-image-2', ratio: '1:1' },
    });
    expect(taskShared.statusCode).toBe(200);
    expect(taskShared.json().creditsCost).toBe(2);
    expect(taskShared.json().userCredits).toBe(3);
    expect(usedKey).toBe('Bearer sk-admin-shared-key');

    // 4. 用户配置自己的专属网关与 Key
    const saveCustom = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { cookie: userCk },
      payload: { baseUrl: 'https://my-own-gw.test', apiKey: 'sk-my-own-private-key' },
    });
    expect(saveCustom.statusCode).toBe(200);
    expect(saveCustom.json().isCustom).toBe(true);

    // 5. 查看 me 接口，hasCustomGateway 应当为 true
    const meCustom = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: userCk },
    });
    expect(meCustom.json().user.hasCustomGateway).toBe(true);

    // 6. 使用专属网关生图 -> 积分不扣除 (依然为 3 积分)，且请求携带的是用户的私有 Key
    const taskCustom = await app.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie: userCk },
      payload: { prompt: 'custom task', model: 'gpt-image-2', ratio: '1:1' },
    });
    expect(taskCustom.statusCode).toBe(200);
    expect(taskCustom.json().creditsCost).toBe(0);
    expect(taskCustom.json().userCredits).toBe(3);
    expect(usedKey).toBe('Bearer sk-my-own-private-key');

    // 7. 清除专属网关 (恢复使用平台共享接口)
    const resetCustom = await app.inject({
      method: 'DELETE',
      url: '/api/settings/custom',
      headers: { cookie: userCk },
    });
    expect(resetCustom.statusCode).toBe(200);
    expect(resetCustom.json().isCustom).toBe(false);

    // 8. 再次生图 -> 重新恢复扣积分 (3 -> 1) 且使用平台 Key
    const taskSharedAgain = await app.inject({
      method: 'POST',
      url: '/api/tasks/image',
      headers: { cookie: userCk },
      payload: { prompt: 'shared again', model: 'gpt-image-2', ratio: '1:1' },
    });
    expect(taskSharedAgain.statusCode).toBe(200);
    expect(taskSharedAgain.json().creditsCost).toBe(2);
    expect(taskSharedAgain.json().userCredits).toBe(1);
    expect(usedKey).toBe('Bearer sk-admin-shared-key');

    await app.close();
  });
});
