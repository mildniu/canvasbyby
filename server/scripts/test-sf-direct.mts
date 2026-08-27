import { readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const keys: { channel_key: string; name: string }[] = JSON.parse(await readFile('/tmp/sf-keys.json', 'utf8'));
const key = keys[0].channel_key;
console.log('使用渠道:', keys[0].name, '\n');

const SF = 'https://api.siliconflow.cn/v1';
const mediaDir = '/home/ctyun/demo/aigc-studio/data/media';
const png = readdirSync(mediaDir).find((f) => f.endsWith('.png'))!;
const buf = await readFile(join(mediaDir, png));
const b64 = buf.toString('base64');

// 1. 硅基官方文档格式：multipart /v1/images/edits
async function testMultipart() {
  const fd = new FormData();
  fd.append('model', 'Qwen/Qwen-Image-Edit-2509');
  fd.append('prompt', 'change the background to a sunny beach');
  fd.append('image', new Blob([new Uint8Array(buf)], { type: 'image/png' }), 'ref.png');
  const res = await fetch(SF + '/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: fd,
  });
  const text = await res.text().catch(() => '');
  console.log(`[multipart edits] HTTP ${res.status}: ${text.slice(0, 200)}`);
}

// 2. JSON body /v1/images/edits
async function testJsonEdits() {
  const res = await fetch(SF + '/images/edits', {
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
  console.log(`[JSON edits] HTTP ${res.status}: ${text.slice(0, 200)}`);
}

// 3. chat 多模态（Qwen3-VL 或 Qwen-Image-Edit 是否支持 chat）
async function testChat() {
  const res = await fetch(SF + '/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'Qwen/Qwen-Image-Edit-2509',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'change the background to a sunny beach' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
        ],
      }],
    }),
  });
  const text = await res.text().catch(() => '');
  console.log(`[chat多模态] HTTP ${res.status}: ${text.slice(0, 200)}`);
}

await testMultipart();
await testJsonEdits();
await testChat();
