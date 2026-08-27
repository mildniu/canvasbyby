import { readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// 输出一张已生成图片的 dataURL 作为参考图
const mediaDir = '/home/ctyun/demo/aigc-studio/data/media';
const files = readdirSync(mediaDir).filter((f) => f.endsWith('.png'));
const latest = files[files.length - 1];
const b64 = (await readFile(join(mediaDir, latest))).toString('base64');
process.stdout.write(`data:image/png;base64,${b64}`);
