import Database from 'better-sqlite3';
import { decrypt } from '../src/crypto.js';

const db = new Database('/home/ctyun/demo/aigc-studio/data/aigc.db');
const row = db.prepare("SELECT value FROM user_settings WHERE user_id='admin' AND key='apiKey'").get() as any;
const key = decrypt(row.value, 'b5085aec3956d0067d09ab199e18ef81f10dc3f16d9fe254ffb931d60b52f172') || '';
const BASE = 'http://192.168.0.80:8080';

const PROMPT = 'Generate an image of a cute orange cat sitting on grass';

// 常见中转站对 Gemini 生图协议的透传路径
const attempts: { name: string; path: string; body: any }[] = [
  {
    name: 'Gemini 原生 generateContent',
    path: '/v1beta/models/gemini-3.1-flash-image:generateContent',
    body: { contents: [{ parts: [{ text: PROMPT }] }] },
  },
  {
    name: 'Gemini 原生 v1',
    path: '/v1/models/gemini-3.1-flash-image:generateContent',
    body: { contents: [{ parts: [{ text: PROMPT }] }] },
  },
];

for (const a of attempts) {
  const start = Date.now();
  try {
    const res = await fetch(BASE + a.path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(a.body),
    });
    const dur = ((Date.now() - start) / 1000).toFixed(1);
    const text = await res.text().catch(() => '');
    console.log(`\n[${a.name}] HTTP ${res.status} (${dur}s)`);
    // 找 inline_data 图片
    if (res.ok && /inline_data|inlineData/.test(text)) {
      console.log('  ✅ 响应中包含图片数据 (inline_data)');
      const m = text.match(/"mimeType"\s*:\s*"([^"]+)"/);
      if (m) console.log('  mimeType:', m[1]);
      console.log('  响应长度:', (text.length / 1024).toFixed(0), 'KB');
    } else {
      console.log('  响应:', text.slice(0, 250));
    }
  } catch (e: any) {
    console.log(`\n[${a.name}] 异常: ${e?.message}`);
  }
}
