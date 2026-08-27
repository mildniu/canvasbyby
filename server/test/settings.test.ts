import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../src/app.js';

function getCookie(login: any): string {
  const h = login.headers['set-cookie'];
  const first = Array.isArray(h) ? h[0] : h;
  return first ? first.split(';')[0] : '';
}


let app: Awaited<ReturnType<typeof buildApp>>;
let cookie: string;

beforeAll(async () => {
  app = await buildApp({
    accessPassword: 'pw',
    secretKey: 'k'.repeat(32),
    dataDir: ':memory:dir:',
  });
  await app.ready();
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'admin', password: 'woshiniu2' } });
  cookie = ((login.headers['set-cookie'] as any as string[] | string) as any)[0] ? (Array.isArray(login.headers['set-cookie']) ? (login.headers['set-cookie'] as string[])[0] : (login.headers['set-cookie'] as string)).split(';')[0] : '';
});

describe('settings 网关配置', () => {
  it('默认为空配置', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/settings', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ baseUrl: '', apiKey: '', isCustom: true });
  });

  it('保存后返回打码 Key，原文不回传', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { cookie },
      payload: { baseUrl: 'https://gw.example.com', apiKey: 'sk-secret-abcdef' },
    });
    expect(put.statusCode).toBe(200);
    const body = put.json();
    expect(body.apiKey).not.toContain('sk-secret-abcdef');
    expect(body.apiKey).toContain('*');

    const get = await app.inject({ method: 'GET', url: '/api/settings', headers: { cookie } });
    expect(get.json().baseUrl).toBe('https://gw.example.com');
    expect(get.json().apiKey).not.toContain('sk-secret-abcdef');
  });

  it('保存时不传 apiKey 则保留旧 Key', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { cookie },
      payload: { baseUrl: 'https://gw2.example.com' },
    });
    const get = await app.inject({ method: 'GET', url: '/api/settings', headers: { cookie } });
    expect(get.json().baseUrl).toBe('https://gw2.example.com');
    // key 仍在（打码），说明没被清空
    expect(get.json().apiKey).toContain('*');
  });

  it('API Key 落库为密文，非明文', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { cookie },
      payload: { apiKey: 'sk-plain-xyz' },
    });
    const raw = (app as any).db.prepare("SELECT value FROM user_settings WHERE user_id='admin' AND key='apiKey'").get();
    expect(String(raw.value)).not.toContain('sk-plain-xyz');
  });
});
