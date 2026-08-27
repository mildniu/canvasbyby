import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../src/app.js';

function getCookie(login: any): string {
  const h = login.headers['set-cookie'];
  const first = Array.isArray(h) ? h[0] : h;
  return first ? first.split(';')[0] : '';
}


const PASSWORD = 'woshiniu2';

async function makeApp() {
  return buildApp({
    accessPassword: PASSWORD,
    secretKey: 'test-secret-key-32bytes-padding!!',
    dataDir: ':memory:dir:',
  });
}

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await makeApp();
  await app.ready();
});

describe('auth 密码门', () => {
  it('错误密码 → 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'admin', password: 'wrong' } });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBeTruthy();
  });

  it('正确密码 → set-cookie + 200', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'admin', password: PASSWORD } });
    expect(res.statusCode).toBe(200);
    const setCookie = res.headers['set-cookie'];
    const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    expect(cookies.some((c) => c.startsWith('session='))).toBe(true);
  });

  it('连续 10 次错误 → 429 限速', async () => {
    for (let i = 0; i < 10; i++) {
      await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'admin', password: 'nope' } });
    }
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'admin', password: PASSWORD } });
    expect(res.statusCode).toBe(429);
  });

  it('未登录访问 /api/* → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/settings' });
    expect(res.statusCode).toBe(401);
  });

  it('带合法 cookie 访问 /api/* → 非 401', async () => {
    // 限速窗口可能未过：新建 app 实例避免限速干扰
    const app2 = await makeApp();
    await app2.ready();
    const l2 = await app2.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'admin', password: PASSWORD } });
    const c2 = getCookie(l2);
    const res = await app2.inject({ method: 'GET', url: '/api/settings', headers: { cookie: c2 } });
    expect(res.statusCode).not.toBe(401);
  });

  it('伪造/篡改 cookie → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/settings', headers: { cookie: 'session=forged.token.here' } });
    expect(res.statusCode).toBe(401);
  });
});
