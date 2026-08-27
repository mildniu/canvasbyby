#!/usr/bin/env python3
"""
灵感封面图并发高速下载与 WebP 缩略图生成脚本
- 多线程并发从 GitHub 下载封面原图
- 自动等比缩放至最大宽度 480px，并高质量转换为 WebP 格式
- 更新 SQLite 数据库中 cover_path 为本地相对文件名
"""

import sqlite3
import os
import io
import time
import requests
from PIL import Image
from concurrent.futures import ThreadPoolExecutor, as_completed

DB_PATH = "/home/ctyun/demo/aigc-studio/data/aigc.db"
MEDIA_DIR = "/home/ctyun/demo/aigc-studio/data/media"

os.makedirs(MEDIA_DIR, exist_ok=True)

def process_image(item):
    rid, title, url = item
    if not url or not url.startswith("http"):
        return rid, False, "Not a remote url"
    
    target_filename = f"insp_{rid}.webp"
    target_path = os.path.join(MEDIA_DIR, target_filename)
    
    # 如果本地已经存在且大于 1KB，直接复用
    if os.path.exists(target_path) and os.path.getsize(target_path) > 1024:
        return rid, True, target_filename
    
    # 允许最多 3 次重试
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    })
    
    for attempt in range(3):
        try:
            resp = session.get(url, timeout=15)
            if resp.status_code == 200 and len(resp.content) > 100:
                img = Image.open(io.BytesIO(resp.content))
                # 处理透明通道或调色板
                if img.mode in ("RGBA", "LA", "P"):
                    # 转为 RGB（纯白底色）或保持 RGBA
                    if img.mode == "P":
                        img = img.convert("RGBA")
                    bg = Image.new("RGB", img.size, (255, 255, 255))
                    if img.mode == "RGBA":
                        bg.paste(img, mask=img.split()[3])
                    else:
                        bg.paste(img)
                    img = bg
                elif img.mode != "RGB":
                    img = img.convert("RGB")
                
                w, h = img.size
                if w > 480:
                    target_h = max(1, int(h * (480 / w)))
                    img = img.resize((480, target_h), Image.Resampling.LANCZOS)
                
                img.save(target_path, format="WEBP", quality=82, method=6)
                return rid, True, target_filename
            elif resp.status_code == 404:
                return rid, False, f"HTTP 404 Not Found: {url}"
        except Exception as e:
            if attempt == 2:
                return rid, False, f"Failed after 3 attempts: {e}"
            time.sleep(0.5 * (attempt + 1))
            
    return rid, False, "Unknown error"

def main():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, title, cover_path FROM inspirations WHERE cover_path LIKE 'http%'")
    rows = c.fetchall()
    
    print(f"找到 {len(rows)} 张待处理的远程封面图片...")
    if not rows:
        print("所有图片已完成本地化！")
        return

    success_count = 0
    fail_count = 0
    updates = []
    
    start_time = time.time()
    with ThreadPoolExecutor(max_workers=24) as executor:
        futures = {executor.submit(process_image, r): r for r in rows}
        done_count = 0
        for future in as_completed(futures):
            rid, success, result = future.result()
            done_count += 1
            if success:
                success_count += 1
                updates.append((result, rid))
            else:
                fail_count += 1
                # print(f"  [跳过/失败] ID {rid}: {result}")
            
            if done_count % 50 == 0 or done_count == len(rows):
                print(f"进度: {done_count}/{len(rows)} (成功: {success_count}, 失败: {fail_count})")
    
    # 批量更新数据库
    if updates:
        print(f"正在更新数据库中的 {len(updates)} 条记录...")
        c.executemany("UPDATE inspirations SET cover_path = ? WHERE id = ?", updates)
        conn.commit()
    
    conn.close()
    elapsed = time.time() - start_time
    print(f"\n全部处理完毕！耗时: {elapsed:.2f}s | 成功本地化: {success_count} | 失败/失效: {fail_count}")

if __name__ == "__main__":
    main()
