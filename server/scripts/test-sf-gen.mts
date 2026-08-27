import { readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const keys: { channel_key: string; name: string }[] = JSON.parse(await readFile('/tmp/sf-keys.json', 'utf8'));
const key = keys[0].channel_key;
const SF = 'https://api.siliconflow.cn/v1';

const mediaDir = '/home/ctyun/demo/aigc-studio/data/media';
const png = readdirSync(mediaDir).find((f) => f.endsWith('.png'))!;
const buf = await readFile(join(mediaDir, png));
const b64 = buf.toString('base64');

// generations + image 参数（图生图）
const res = await fetch(SF + '/images/generations', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'Qwen/Qwen-Image-Edit-2509',
    prompt: 'change the background to a sunny beach',
    image: `data:image/png;base64,${b64}`,
    image_size: '1024x1024',
  }),
});
const text = await res.text().catch(() => '');
console.log(`[generations+image] HTTP ${res.status}`);
console.log(text.slice(0, 300));

// 同时查一下硅基有哪些 Qwen image 模型可用
const models = await fetch(SF + '/models', { headers: { Authorization: `Bearer ${key}` } });
const mjson: any = await models.json().catch(() => ({}));
const qwenImg = (mjson.data || []).map((m: any) => m.id).filter((id: string) => /image|edit/i.test(id) && /qwen/i.test(id));
console.log('\n硅基可用的 Qwen 图像模型:', qwenImg);
