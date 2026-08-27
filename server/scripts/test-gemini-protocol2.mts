import Database from 'better-sqlite3';
import { decrypt } from '../src/crypto.js';

const db = new Database('/home/ctyun/demo/aigc-studio/data/aigc.db');
const row = db.prepare("SELECT value FROM user_settings WHERE user_id='admin' AND key='apiKey'").get() as any;
const key = decrypt(row.value, 'b5085aec3956d0067d09ab199e18ef81f10dc3f16d9fe254ffb931d60b52f172') || '';
const BASE = 'http://192.168.0.80:8080';

const PROMPT = 'Generate an image of a cute orange cat sitting on grass';

// x-goog-api-key 方式 + 更多路径变体
const attempts: { name: string; path: string; auth?: 'bearer' | 'x-goog'; query?: string }[] = [
  { name: 'v1beta + x-goog-api-key', path: '/v1beta/models/gemini-3.1-flash-image:generateContent', auth: 'x-goog' },
  { name: 'v1beta + query key', path: '/v1beta/models/gemini-3.1-flash-image:generateContent', query: 'key=' + encodeURIComponent(key) },
  { name: 'gemini 路径 (无 v1beta)', path: '/gemini/models/gemini-3.1-flash-image:generateContent', auth: 'x-goog' },
];

for (const a of attempts) {
  const start = Date.now();
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (a.auth === 'bearer') headers.Authorization = `Bearer ${key}`;
    if (a.auth === 'x-goog') headers['x-goog-api-key'] = key;

    let url = BASE + a.path;
    if (a.query) url += '?' + a.query;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT }] }] }),
    });
    const dur = ((Date.now() - start) / 1000).toFixed(1);
    const text = await res.text().catch(() => '');
    console.log(`\n[${a.name}] HTTP ${res.status} (${dur}s)`);
    if (res.ok && /inline_data|inlineData/.test(text)) {
      console.log('  ✅ 响应包含图片 inline_data, 长度', (text.length / 1024).toFixed(0), 'KB');
    } else {
      console.log('  响应:', text.slice(0, 250));
    }
  } catch (e: any) {
    console.log(`\n[${a.name}] 异常: ${e?.message}`);
  }
}

// 另外再试一次 chat/completions（上次 503 可能是瞬时）
console.log('\n--- chat/completions 重试 ---');
for (let i = 1; i <= 2; i++) {
  const start = Date.now();
  const res = await fetch(BASE + '/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemini-3.1-flash-image',
      messages: [{ role: 'user', content: PROMPT }],
    }),
  });
  const dur = ((Date.now() - start) / 1000).toFixed(1);
  const text = await res.text().catch(() => '');
  if (res.ok) {
    console.log(`第${i}次 HTTP ${res.status} (${dur}s) ✅ 响应长 ${(text.length / 1024).toFixed(0)}KB`);
    console.log('  含图片数据:', /b64|image|inline/i.test(text));
    console.log('  预览:', text.slice(0, 200));
  } else {
    console.log(`第${i}次 HTTP ${res.status} (${dur}s)  ${text.slice(0, 150)}`);
  }
}
