import Database from 'better-sqlite3';
import { decrypt } from '../src/crypto.js';

const db = new Database('/home/ctyun/demo/aigc-studio/data/aigc.db');
const row = db.prepare(
  "SELECT value FROM user_settings WHERE user_id='5ef7e05e-3814-425e-a99b-afd02e7b62ae' AND key='apiKey'"
).get() as any;
const key = decrypt(row.value, 'b5085aec3956d0067d09ab199e18ef81f10dc3f16d9fe254ffb931d60b52f172') || '';

async function main() {
  // 用不存在的模型 dall-e-3 测试
  const gen = await fetch('http://192.168.0.80:8080/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'dall-e-3', prompt: 'x', size: '1024x1024', n: 1 }),
  });
  console.log('dall-e-3 状态:', gen.status);
  const text = await gen.text().catch(() => '');
  console.log('响应:', text.slice(0, 300));
}

main().catch(console.error);
