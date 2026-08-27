import Database from 'better-sqlite3';
import { decrypt } from '../src/crypto.js';
import { readFile } from 'node:fs/promises';

const db = new Database('/home/ctyun/demo/aigc-studio/data/aigc.db');
const row = db.prepare("SELECT value FROM user_settings WHERE user_id='admin' AND key='apiKey'").get() as any;
const key = decrypt(row.value, 'b5085aec3956d0067d09ab199e18ef81f10dc3f16d9fe254ffb931d60b52f172') || '';
const BASE = 'http://192.168.0.80:8080';

// 找一张已生成的图做参考图
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
const mediaDir = '/home/ctyun/demo/aigc-studio/data/media';
const png = readdirSync(mediaDir).find((f) => f.endsWith('.png'));
const buf = await readFile(join(mediaDir, png!));
console.log(`参考图: ${png} (${(buf.length / 1024).toFixed(0)}KB)\n`);

async function testEdits(model: string) {
  const start = Date.now();
  const fd = new FormData();
  fd.append('model', model);
  fd.append('prompt', 'change the background to a sunny beach');
  fd.append('size', '1024x1024');
  fd.append('image', new Blob([new Uint8Array(buf)], { type: 'image/png' }), 'ref-0.png');
  const res = await fetch(`${BASE}/v1/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: fd,
  });
  const dur = ((Date.now() - start) / 1000).toFixed(1);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.log(`❌ [edits] ${model}  HTTP ${res.status} (${dur}s)  ${text.slice(0, 150)}`);
    return;
  }
  const json: any = await res.json().catch(() => ({}));
  const item = json?.data?.[0];
  if (item?.b64_json) console.log(`✅ [edits] ${model}  成功 (${dur}s, b64 ${(item.b64_json.length / 1024).toFixed(0)}KB)`);
  else if (item?.url) console.log(`✅ [edits] ${model}  成功 (${dur}s, url)`);
  else console.log(`⚠️ [edits] ${model}  200 但无图片 ${JSON.stringify(json).slice(0, 120)}`);
}

async function testGen(model: string, size = '1024x1024') {
  const start = Date.now();
  const res = await fetch(`${BASE}/v1/images/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: 'a red apple on a table', size, n: 1 }),
  });
  const dur = ((Date.now() - start) / 1000).toFixed(1);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.log(`❌ [gen] ${model} (${size})  HTTP ${res.status} (${dur}s)  ${text.slice(0, 150)}`);
    return;
  }
  const json: any = await res.json().catch(() => ({}));
  const item = json?.data?.[0];
  if (item?.b64_json || item?.url) console.log(`✅ [gen] ${model} (${size})  成功 (${dur}s)`);
  else console.log(`⚠️ [gen] ${model} (${size})  200 但无图片 ${JSON.stringify(json).slice(0, 120)}`);
}

console.log('--- 1. Qwen-Image-Edit-2509 走正确的 edits 接口（带参考图）---');
await testEdits('Qwen-Image-Edit-2509');

console.log('\n--- 2. gemini-3.1-flash-image 重试 3 次（判断是否瞬时故障）---');
for (let i = 1; i <= 3; i++) {
  await testGen('gemini-3.1-flash-image');
}
