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

// 方案A：chat 多模态（Gemini 官方推荐路线）
const start = Date.now();
const res = await fetch(BASE + '/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gemini-3.1-flash-image',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'change the background to a sunny beach' },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
      ],
    }],
  }),
});
const dur = ((Date.now() - start) / 1000).toFixed(1);
const text = await res.text().catch(() => '');
console.log(`[gemini chat多模态图生图] HTTP ${res.status} (${dur}s)`);
console.log(text.slice(0, 300));
