import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

// ============ 老牛创意生成 Logo 设计 ============
// 设计理念：
// 1. 主图形：极简几何牛头 —— 两只对称的牛角 + 鼻环，一眼可辨识
// 2. 配色：中性黑 #0A0A0A（与站点主按钮/品牌一致的克制黑），白底适配
// 3. 风格：与站点"极简白底 + 克莱因蓝点缀"的设计系统一致，圆润现代
// 4. 应用：favicon.ico/png + 品牌方块（登录页/侧栏）+ apple-touch-icon

const BLACK = '#0A0A0A';

mkdirSync('/home/ctyun/demo/aigc-studio/web/public', { recursive: true });

// ---- 牛头 SVG（圆形底 + 几何牛头）----
// 牛头构成：两只大弧形牛角（对称）、圆润头颅、鼻环
function oxSVG(size: number, withBg: boolean): string {
  const s = size;
  return `<svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  ${withBg ? `<rect width="100" height="100" rx="22" fill="${BLACK}"/>` : ''}
  <!-- 牛角：两条对称上扬的弧 -->
  <path d="M 25 38
           C 20 22, 28 12, 40 10
           C 33 18, 31 26, 34 34
           C 30 33, 27 34, 25 38 Z"
        fill="${withBg ? '#ffffff' : BLACK}"/>
  <path d="M 75 38
           C 80 22, 72 12, 60 10
           C 67 18, 69 26, 66 34
           C 70 33, 73 34, 75 38 Z"
        fill="${withBg ? '#ffffff' : BLACK}"/>
  <!-- 头颅：圆润上宽下窄 -->
  <path d="M 30 34
           C 30 24, 40 18, 50 18
           C 60 18, 70 24, 70 34
           L 70 52
           C 70 62, 62 70, 50 70
           C 38 70, 30 62, 30 52 Z"
        fill="${withBg ? '#ffffff' : BLACK}"/>
  <!-- 眼睛：黑底时用透明孔，白底时用黑点 -->
  <circle cx="41" cy="40" r="3.2" fill="${withBg ? BLACK : '#ffffff'}"/>
  <circle cx="59" cy="40" r="3.2" fill="${withBg ? BLACK : '#ffffff'}"/>
  <!-- 鼻子区 -->
  <ellipse cx="50" cy="60" rx="14" ry="10" fill="${withBg ? BLACK : '#ffffff'}"/>
  <circle cx="44" cy="60" r="2.6" fill="${withBg ? '#ffffff' : BLACK}"/>
  <circle cx="56" cy="60" r="2.6" fill="${withBg ? '#ffffff' : BLACK}"/>
  <!-- 鼻环：品牌点睛 -->
  <path d="M 46 70 A 4 4 0 1 0 54 70" stroke="${withBg ? '#ffffff' : BLACK}" stroke-width="2.4" fill="none"/>
</svg>`;
}

async function main() {
  // 1. favicon.png（黑底白牛，32px 适合浏览器标签）
  const fav32 = await sharp(Buffer.from(oxSVG(100, true))).resize(32, 32).png().toBuffer();
  writeFileSync('/home/ctyun/demo/aigc-studio/web/public/favicon.png', fav32);

  // 2. favicon-64
  const fav64 = await sharp(Buffer.from(oxSVG(100, true))).resize(64, 64).png().toBuffer();
  writeFileSync('/home/ctyun/demo/aigc-studio/web/public/favicon-64.png', fav64);

  // 3. apple-touch-icon 180px
  const apple = await sharp(Buffer.from(oxSVG(100, true))).resize(180, 180).png().toBuffer();
  writeFileSync('/home/ctyun/demo/aigc-studio/web/public/apple-touch-icon.png', apple);

  // 4. 品牌方块 logo（登录页/侧栏使用，黑底白牛 512px）
  const brand = await sharp(Buffer.from(oxSVG(100, true))).resize(512, 512).png().toBuffer();
  writeFileSync('/home/ctyun/demo/aigc-studio/web/public/logo.png', brand);

  // 5. 白牛无底版（透明背景，备用）
  const oxOnly = await sharp(Buffer.from(oxSVG(100, false))).resize(512, 512).png().toBuffer();
  writeFileSync('/home/ctyun/demo/aigc-studio/web/public/ox-mark.png', oxOnly);

  // 6. favicon.ico（多尺寸合成）—— sharp 不直接出 ico，用 png 代替（现代浏览器全部支持 png favicon）
  console.log('✅ Logo 已生成: favicon.png / favicon-64.png / apple-touch-icon.png / logo.png / ox-mark.png');
}

main().catch(console.error);
