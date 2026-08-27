import Database from 'better-sqlite3';
import { decrypt } from '../src/crypto.js';
import { readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const db = new Database('/home/ctyun/demo/aigc-studio/data/aigc.db');
const row = db.prepare("SELECT value FROM user_settings WHERE user_id='admin' AND key='apiKey'").get() as any;
const key = decrypt(row.value, 'b5085aec3956d0067d09ab199e18ef81f10dc3f16d9fe254ffb931d60b52f172') || '';
const BASE = 'http://192.168.0.80:8080';

const mediaDir = '/home/ctyun/demo/aigc-studio/data/media';
const png = readdirSync(mediaDir).find((f) => f.endsWith('.png'))!;
const b64 = (await readFile(join(mediaDir, png))).toString('base64');

async function tryModel(model: string) {
  // 硅基风格 JSON edits
  const start = Date.now();
  const res = await fetch(BASE + '/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: 'change the background to a sunny beach',
      image: `data:image/png;base64,${b64}`,
      image_size: '1024x1024',
    }),
  });
  const dur = ((Date.now() - start) / 1000).toFixed(1);
  const text = await res.text().catch(() => '');
  const ok = res.ok && (text.includes('b64_json') || text.includes('"url"') || text.length > 50000);
  console.log(`${ok ? '✅' : '❌'} [${model}] HTTP ${res.status} (${dur}s) ${ok ? '返回图片!' : text.slice(0, 160)}`);
}

// 模型名变体
for (const m of ['Qwen-Image-Edit-2509', 'Qwen-Image-Edit', 'Qwen/Qwen-Image-Edit', 'Qwen/Qwen-Image-Edit-2509']) {
  await tryModel(m);
}
