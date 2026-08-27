import Database from 'better-sqlite3';
import { decrypt } from '../src/crypto.js';

const db = new Database('/home/ctyun/demo/aigc-studio/data/aigc.db');
const row = db.prepare(
  "SELECT value FROM user_settings WHERE user_id='admin' AND key='apiKey'"
).get() as any;
const key = decrypt(row.value, 'b5085aec3956d0067d09ab199e18ef81f10dc3f16d9fe254ffb931d60b52f172') || '';
const BASE = 'http://192.168.0.80:8080';

const MODELS = [
  'gpt-image-2',
  'gpt-image-2-4k',
  'Qwen-Image',
  'Qwen-Image-Edit-2509',
  'gemini-3.1-flash-image',
  'grok-imagine-image',
];

async function testModel(model: string): Promise<void> {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE}/v1/images/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: 'a cute orange cat sitting on grass, high quality', size: '1024x1024', n: 1 }),
    });
    const dur = ((Date.now() - start) / 1000).toFixed(1);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.log(`❌ ${model}  HTTP ${res.status} (${dur}s)  ${text.slice(0, 120)}`);
      return;
    }
    const json: any = await res.json().catch(() => ({}));
    const item = json?.data?.[0];
    if (item?.b64_json) {
      console.log(`✅ ${model}  成功 (${dur}s, b64 ${(item.b64_json.length / 1024).toFixed(0)}KB)`);
    } else if (item?.url) {
      console.log(`✅ ${model}  成功 (${dur}s, url: ${String(item.url).slice(0, 60)})`);
    } else {
      console.log(`⚠️ ${model}  HTTP 200 但无图片数据 (${dur}s)  ${JSON.stringify(json).slice(0, 120)}`);
    }
  } catch (e: any) {
    const dur = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`❌ ${model}  请求异常 (${dur}s)  ${e?.message}`);
  }
}

async function main() {
  console.log(`开始逐个测试 ${MODELS.length} 个生图模型 @ ${BASE}\n`);
  for (const m of MODELS) {
    await testModel(m);
  }
  console.log('\n全部测试完成');
}

main();
