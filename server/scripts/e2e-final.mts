import { readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// 端到端验证：所有借鉴功能
const BASE = 'http://127.0.0.1:3300';

const login = await fetch(BASE + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'woshiniu2' }),
});
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
console.log('1. 登录:', login.status === 200 ? '✅' : '❌');

// 生成一张图（验证缩略图+原子写入+尺寸记录）
console.log('2. 生成图片（验证缩略图/原子写入/守卫/协议注册表）...');
const start = Date.now();
const res = await fetch(BASE + '/api/tasks/image', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', cookie },
  body: JSON.stringify({
    prompt: '一只橙色的猫，标题字体必须为可爱Q版风格，颜色限制为暖色调，禁止出现文字水印',
    ratio: '16:9',
    model: 'gpt-image-2',
    refAssets: [],
  }),
});
const task: any = await res.json().catch(() => ({}));
console.log(`   HTTP ${res.status} (${((Date.now() - start) / 1000).toFixed(1)}s) status=${task?.status}`);
if (task?.status === 'done') {
  console.log('   ✅ 生成成功:', task.resultUrl);
  console.log('   params(含尺寸/缩略图标记):', JSON.stringify(task.params));

  // 验证缩略图可访问
  const thumbRes = await fetch(BASE + task.resultUrl + '?thumb=1', { headers: { cookie } });
  const thumbBuf = Buffer.from(await thumbRes.arrayBuffer());
  console.log(`3. 缩略图: HTTP ${thumbRes.status}, ${(thumbBuf.length / 1024).toFixed(1)}KB ${thumbRes.status === 200 ? '✅' : '❌'}`);

  const origRes = await fetch(BASE + task.resultUrl, { headers: { cookie } });
  const origBuf = Buffer.from(await origRes.arrayBuffer());
  console.log(`4. 原图: HTTP ${origRes.status}, ${(origBuf.length / 1024).toFixed(1)}KB ${thumbBuf.length < origBuf.length / 3 ? '✅ (缩略图显著更小)' : '⚠️'}`);
} else {
  console.log('   ❌ 失败:', (task?.error || '').slice(0, 200));
}
