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
const files = readdirSync(mediaDir).filter((f) => f.endsWith('.png'));
const b64 = (await readFile(join(mediaDir, files[files.length - 1]))).toString('base64');
console.log(`参考图: ${files[files.length - 1]}\n`);

// Gemini 图生图：OpenAI 标准 edits multipart
const fd = new FormData();
fd.append('model', 'gemini-3.1-flash-image');
fd.append('prompt', 'change the background to a sunny beach');
fd.append('size', '1024x1024');
fd.append('image', new Blob([new Uint8Array(Buffer.from(b64, 'base64'))], { type: 'image/png' }), 'ref.png');

const start = Date.now();
const res = await fetch(BASE + '/v1/images/edits', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}` },
  body: fd,
});
const dur = ((Date.now() - start) / 1000).toFixed(1);
const text = await res.text().catch(() => '');
console.log(`[gemini edits multipart] HTTP ${res.status} (${dur}s)`);
console.log(text.slice(0, 250));
