import Database from 'better-sqlite3';
import { decrypt } from '../src/crypto.js';

const db = new Database('/home/ctyun/demo/aigc-studio/data/aigc.db');
const row = db.prepare("SELECT value FROM user_settings WHERE user_id='admin' AND key='apiKey'").get() as any;
const key = decrypt(row.value, 'b5085aec3956d0067d09ab199e18ef81f10dc3f16d9fe254ffb931d60b52f172') || '';
const BASE = 'http://192.168.0.80:8080';

// 打印完整错误体
const res = await fetch(`${BASE}/v1/chat/completions`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gemini-3.1-flash-image',
    messages: [{ role: 'user', content: 'Generate an image: a cute orange cat sitting on grass' }],
  }),
});
console.log('HTTP', res.status);
const text = await res.text().catch(() => '');
console.log('完整响应:', text.slice(0, 600));
