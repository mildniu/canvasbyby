import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { log } from './logger.js';

/** 缩略图规格（借鉴 iLab thumbnails.py）：
 * - 列表缩略图：768px 长边 JPEG q88（瀑布流加载）
 * - 侧栏/参考缩略图：256px 长边 WebP q82
 */
const LIST_MAX_EDGE = 768;
const LIST_QUALITY = 88;

/** 生成列表缩略图（JPEG），返回 buffer；失败返回 null（降级用原图） */
export async function createListThumbnail(sourceBuffer: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(sourceBuffer)
      .rotate() // EXIF 方向校正（iLab exif_transpose）
      .resize(LIST_MAX_EDGE, LIST_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: LIST_QUALITY, mozjpeg: true })
      .toBuffer();
  } catch (e: any) {
    log('THUMB', `缩略图生成失败（降级用原图）: ${e?.message}`);
    return null;
  }
}

/** 生成图片元信息（宽高，用于卡片显示） */
export async function imageDimensions(sourceBuffer: Buffer): Promise<{ width: number; height: number } | null> {
  try {
    const meta = await sharp(sourceBuffer).metadata();
    if (meta.width && meta.height) return { width: meta.width, height: meta.height };
    return null;
  } catch {
    return null;
  }
}

/** 检测图片真实 mime 类型（防止扩展名伪装） */
export async function detectImageMime(sourceBuffer: Buffer): Promise<string | null> {
  try {
    const meta = await sharp(sourceBuffer).metadata();
    return meta.format ? `image/${meta.format}` : null;
  } catch {
    return null;
  }
}

export { readFile };
