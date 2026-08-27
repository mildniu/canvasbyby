import Database from 'better-sqlite3';
import { decrypt } from '../src/crypto.js';
import { readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const db = new Database('/home/ctyun/demo/aigc-studio/data/aigc.db');
const row = db.prepare("SELECT value FROM user_settings WHERE user_id='admin' AND key='apiKey'").get() as any;
const key = decrypt(row.value, 'b5085aec3956d0067d09ab199e18ef81f10dc3f16d9fe254ffb931d60b52f172') || '';
const BASE = 'http://192.168.0.80:8080';

// 参考图
const mediaDir = '/home/ctyun/demo/aigc-studio/data/media';
const png = readdirSync(mediaDir).find((f) => f.endsWith('.png'))!;
const buf = await readFile(join(mediaDir, png));
const b64 = buf.toString('base64');
console.log(`参考图: ${png} (${(b64.length / 1024).toFixed(0)}KB b64)\n`);

async function tryJson(name: string, path: string, body: any) {
  const start = Date.now();
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const dur = ((Date.now() - start) / 1000).toFixed(1);
  const text = await res.text().catch(() => '');
  const okImg = res.ok && (/"b64_json"|image_url|"url"/.test(text) || text.length > 100000);
  console.log(`${okImg ? '✅' : '❌'} [${name}] HTTP ${res.status} (${dur}s) ${okImg ? '含图片数据!' : text.slice(0, 180)}`);
}

// 1. SiliconFlow 风格: images/edits + JSON body 带 image 字段
await tryJson('SF风格 edits+JSON', '/v1/images/edits', {
  model: 'Qwen-Image-Edit-2509',
  prompt: 'change the background to a sunny beach',
  image: `data:image/png;base64,${b64}`,
  image_size: '1024x1024',
});

// 2. 同上但 image 用纯 base64
await tryJson('SF风格 edits+纯b64', '/v1/images/edits', {
  model: 'Qwen-Image-Edit-2509',
  prompt: 'change the background to a sunny beach',
  image: b64,
  image_size: '1024x1024',
});

// 3. chat completions 多模态（image_url 格式，openai 标准）
await tryJson('chat多模态 image_url', '/v1/chat/completions', {
  model: 'Qwen-Image-Edit-2509',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'change the background to a sunny beach' },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
    ],
  }],
});
