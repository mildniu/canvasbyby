import Database from 'better-sqlite3';
import { decrypt } from '../src/crypto.js';

const db = new Database('/home/ctyun/demo/aigc-studio/data/aigc.db');
const row = db.prepare("SELECT value FROM user_settings WHERE user_id='admin' AND key='apiKey'").get() as any;
const key = decrypt(row.value, 'b5085aec3956d0067d09ab199e18ef81f10dc3f16d9fe254ffb931d60b52f172') || '';
const BASE = 'http://192.168.0.80:8080';

const PROMPT = 'Generate an image of a cute orange cat sitting on grass';

async function attempt(label: string, body: any) {
  const start = Date.now();
  const res = await fetch(BASE + '/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const dur = ((Date.now() - start) / 1000).toFixed(1);
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    console.log(`❌ [${label}] HTTP ${res.status} (${dur}s) ${text.slice(0, 150)}`);
    return;
  }
  console.log(`✅ [${label}] HTTP ${res.status} (${dur}s) 响应 ${ (text.length/1024).toFixed(0) }KB`);
  // 检查图片的各种可能返回形态
  try {
    const json = JSON.parse(text);
    const msg = json?.choices?.[0]?.message;
    console.log('  message keys:', msg ? Object.keys(msg).join(',') : 'N/A');
    if (msg?.images) console.log('  images[0]:', JSON.stringify(msg.images[0]).slice(0, 150));
    const content = msg?.content;
    if (typeof content === 'string') {
      const b64Match = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]{100,}/);
      const urlMatch = content.match(/https?:\/\/\S+\.(?:png|jpg|jpeg|webp)\S*/);
      console.log('  content 前150字:', content.slice(0, 150));
      if (b64Match) console.log('  🖼️ content 内含 base64 图片!');
      if (urlMatch) console.log('  🖼️ content 内含图片URL:', urlMatch[0]);
    } else if (Array.isArray(content)) {
      for (const part of content) {
        console.log('  part type:', part.type, part.type === 'image_url' ? JSON.stringify(part.image_url).slice(0,120) : '');
      }
    }
    if (msg?.image_url) console.log('  image_url 字段:', JSON.stringify(msg.image_url).slice(0, 150));
  } catch {}
}

// 标准 openai chat 格式
await attempt('标准chat', {
  model: 'gemini-3.1-flash-image',
  messages: [{ role: 'user', content: PROMPT }],
});

// 明确要求生图的 prompt
await attempt('明确生图指令', {
  model: 'gemini-3.1-flash-image',
  messages: [{ role: 'user', content: '请生成一张图片：' + PROMPT }],
});
