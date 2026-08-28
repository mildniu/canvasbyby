import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

function getCookie(res: any): string {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return '';
  return Array.isArray(setCookie) ? setCookie[0].split(';')[0] : setCookie.split(';')[0];
}

describe('灵感收藏 (Inspiration Favorites)', () => {
  it('用户可收藏/取消收藏灵感，收藏列表按用户隔离', async () => {
    const app = await buildApp({
      accessPassword: 'woshiniu2',
      secretKey: 'f'.repeat(32),
      dataDir: ':memory:dir:',
    });
    await app.ready();

    // 1. Admin 登录并插入两条测试灵感
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'woshiniu2' },
    });
    const adminCk = getCookie(adminLogin);
    for (const title of ['灵感A', '灵感B']) {
      await app.inject({
        method: 'POST',
        url: '/api/inspirations',
        headers: { cookie: adminCk },
        payload: { title, prompt: `prompt of ${title}`, category: '测试' },
      });
    }

    // 2. 创建两个用户
    for (const name of ['alice', 'bob']) {
      await app.inject({
        method: 'POST',
        url: '/api/admin/users',
        headers: { cookie: adminCk },
        payload: { username: name, password: 'password123', role: 'user', credits: 20 },
      });
    }
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

    // 3. 拉取灵感列表拿到 id（自建灵感按 likes/id 排序在前面）
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/inspirations',
      headers: { cookie: aliceCk },
    });
    const items = listRes.json().filter((t: any) => t.category === '测试');
    expect(items).toHaveLength(2);
    const [a, b] = items;

    // 4. alice 收藏 A 和 B
    const fav1 = await app.inject({
      method: 'POST',
      url: `/api/inspirations/${a.id}/favorite`,
      headers: { cookie: aliceCk },
    });
    expect(fav1.statusCode).toBe(200);
    expect(fav1.json().favorite).toBe(true);
    await app.inject({
      method: 'POST',
      url: `/api/inspirations/${b.id}/favorite`,
      headers: { cookie: aliceCk },
    });

    // 5. alice 视角：两个灵感均标记 isFavorite
    const aliceList = await app.inject({
      method: 'GET',
      url: '/api/inspirations',
      headers: { cookie: aliceCk },
    });
    const aliceFavs = aliceList.json().filter((t: any) => t.isFavorite);
    expect(aliceFavs).toHaveLength(2);

    // 6. bob 视角：收藏互相隔离，bob 看到的 isFavorite 均为 false
    const bobList = await app.inject({
      method: 'GET',
      url: '/api/inspirations',
      headers: { cookie: bobCk },
    });
    const bobFavs = bobList.json().filter((t: any) => t.isFavorite);
    expect(bobFavs).toHaveLength(0);

    // 7. bob 也收藏 B -> bob 视角有 1 个收藏
    await app.inject({
      method: 'POST',
      url: `/api/inspirationsations/${b.id}/favorite`.replace('inspirationsations', 'inspirations'),
      headers: { cookie: bobCk },
    });
    const bobList2 = await app.inject({
      method: 'GET',
      url: '/api/inspirations',
      headers: { cookie: bobCk },
    });
    expect(bobList2.json().filter((t: any) => t.isFavorite)).toHaveLength(1);

    // 8. alice 取消收藏 A -> 再取消一次（幂等切换）
    const unfav = await app.inject({
      method: 'POST',
      url: `/api/inspirations/${a.id}/favorite`,
      headers: { cookie: aliceCk },
    });
    expect(unfav.json().favorite).toBe(false);
    const aliceList2 = await app.inject({
      method: 'GET',
      url: '/api/inspirations',
      headers: { cookie: aliceCk },
    });
    expect(aliceList2.json().filter((t: any) => t.isFavorite)).toHaveLength(1);

    // 9. 收藏不存在的灵感 -> 404
    const notFound = await app.inject({
      method: 'POST',
      url: '/api/inspirations/99999/favorite',
      headers: { cookie: aliceCk },
    });
    expect(notFound.statusCode).toBe(404);

    await app.close();
  });
});
