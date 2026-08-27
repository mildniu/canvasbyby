import { readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// 完整端到端：登录 → 用 Qwen-Image-Edit-2509 + 参考图生图
const BASE = 'http://127.0.0.1:3300';

// 1. 登录
const login = await fetch(BASE + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'woshiniu2' }),
});
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
console.log('1. 登录:', login.status === 200 ? '✅' : '❌');

// 2. 参考图
const mediaDir = '/home/ctyun/demo/aigc-studio/data/media';
const files = readdirSync(mediaDir).filter((f) => f.endsWith('.png'));
const b64 = (await readFile(join(mediaDir, files[files.length - 1]))).toString('base64');
console.log('2. 参考图:', files[files.length - 1], `(${(b64.length / 1024).toFixed(0)}KB)`);

// 3. 生图（Qwen-Image-Edit-2509 图生图）
console.log('3. 提交 Qwen-Image-Edit-2509 图生图任务...');
const start = Date.now();
const res = await fetch(BASE + '/api/tasks/image', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', cookie },
  body: JSON.stringify({
    prompt: '把背景改成阳光明媚的海滩',
    ratio: '1:1',
    model: 'Qwen-Image-Edit-2509',
    refAssets: [`data:image/png;base64,${b64}`],
  }),
});
const task: any = await res.json().catch(() => ({}));
const dur = ((Date.now() - start) / 1000).toFixed(1);
console.log(`   HTTP ${res.status} (${dur}s) status=${task?.status}`);
if (task?.status === 'done') {
  console.log('   ✅ 图生图成功! 结果:', task.resultUrl);
} else {
  console.log('   ❌ 失败:', (task?.error || '').slice(0, 250));
}
