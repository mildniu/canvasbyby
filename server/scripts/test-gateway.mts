import Database from 'better-sqlite3';
import { decrypt } from '../src/crypto.js';

const db = new Database('/home/ctyun/demo/aigc-studio/data/aigc.db');
const row = db.prepare(
  "SELECT value FROM user_settings WHERE user_id='5ef7e05e-3814-425e-a99b-afd02e7b62ae' AND key='apiKey'"
).get() as any;
const key = decrypt(row.value, 'b5085aec3956d0067d09ab199e18ef81f10dc3f16d9fe254ffb931d60b52f172') || '';

const BASE = 'http://192.168.0.80:8080';

async function main() {
  // 1. models
  const res = await fetch(`${BASE}/v1/models`, { headers: { Authorization: `Bearer ${key}` } });
  console.log('models 状态:', res.status);
  const json: any = await res.json().catch(() => ({}));
  const models: string[] = (json.data || []).map((m: any) => m.id);
  console.log('生图相关模型:', models.filter((m) => /image|dall|flux|seedream|banana|qwen|grok|imagen/i.test(m)).slice(0, 25));

  // 2. 生图（gpt-image-2）
  const gen = await fetch(`${BASE}/v1/images/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-2', prompt: 'a cute cat', size: '1024x1024', n: 1 }),
  });
  console.log('gpt-image-2 生图状态:', gen.status);
  const genJson: any = await gen.json().catch(() => ({}));
  console.log('响应:', JSON.stringify(genJson).slice(0, 500));
}

main().catch(console.error);
