#!/usr/bin/env python3
"""
灵感提示词双语化脚本
将纯英文提示词翻译为中文，并统一重组为：
  [中文]
  <中文译文>

  [English]
  <原文>
已含 [中文]/[English] 标记或本身就是中文的记录跳过。
断点续传：处理结果逐条落盘到 /tmp/bilingual_progress.json，中断后重跑自动跳过已完成的。
"""
import json
import re
import sqlite3
import time
import requests

DB_PATH = "/home/ctyun/demo/aigc-studio/data/aigc.db"
GW_URL = "http://192.168.0.80:8080/v1/chat/completions"
MODEL = "gemini-3.7-flash"
PROGRESS_FILE = "/tmp/bilingual_progress.json"

with open("/tmp/gw_key.txt") as f:
    API_KEY = f.read().strip()

HAS_ZH = re.compile(r"[\u4e00-\u9fff]")
BILINGUAL_MARK = re.compile(r"\[中文\]|\[English\]|\[EN\]", re.I)

SYSTEM_PROMPT = """你是一名专业的 AI 绘画提示词翻译专家。请把用户提供的英文图像生成提示词完整翻译为中文。
要求：
1. 忠实原文，不遗漏、不增删任何细节（包括比例、风格、光影、镜头等技术要求）；
2. 专业术语准确（如 aspect ratio→画面比例, depth of field→景深, cinematic lighting→电影感布光）；
3. 保留原格式结构（如 JSON 结构、分段、列表、标题等照原样翻译）；
4. 只输出中文译文本身，不要任何解释、前后缀或代码块标记。"""


def translate(text: str) -> str | None:
    for attempt in range(3):
        try:
            r = requests.post(
                GW_URL,
                headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": MODEL,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": text},
                    ],
                    "max_tokens": 8000,
                    "temperature": 0.3,
                },
                timeout=120,
            )
            if r.status_code == 200:
                out = r.json()["choices"][0]["message"]["content"].strip()
                # 去掉可能的代码块包裹
                out = re.sub(r"^```[a-z]*\n?|\n?```$", "", out).strip()
                if out:
                    return out
            # 429/5xx 退避重试
            time.sleep(2 * (attempt + 1))
        except Exception:
            time.sleep(2 * (attempt + 1))
    return None


def main():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, prompt FROM inspirations ORDER BY id")
    rows = c.fetchall()

    # 加载进度（id -> 中文译文）
    progress = {}
    try:
        with open(PROGRESS_FILE) as f:
            progress = json.load(f)
    except FileNotFoundError:
        pass

    todo = []
    for rid, prompt in rows:
        if BILINGUAL_MARK.search(prompt):
            continue  # 已是双语格式
        if HAS_ZH.search(prompt):
            continue  # 本身含中文（源即中文）
        if str(rid) in progress:
            continue  # 已翻译过（断点续传）
        todo.append((rid, prompt))

    print(f"待翻译: {len(todo)} 条（已有进度 {len(progress)} 条）")

    done = 0
    failed = []
    for rid, prompt in todo:
        zh = translate(prompt)
        if zh is None:
            failed.append(rid)
            print(f"  [{rid}] 翻译失败，跳过")
            continue
        progress[str(rid)] = zh
        done += 1
        if done % 10 == 0:
            print(f"  进度: {done}/{len(todo)}")
            with open(PROGRESS_FILE, "w") as f:
                json.dump(progress, f, ensure_ascii=False)

    # 最终落盘进度
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f, ensure_ascii=False)

    # 写库：重组为 [中文] / [English] 格式
    updated = 0
    for rid_str, zh in progress.items():
        rid = int(rid_str)
        row = c.execute("SELECT prompt FROM inspirations WHERE id=?", (rid,)).fetchone()
        if not row:
            continue
        old = row[0]
        if BILINGUAL_MARK.search(old):
            continue  # 已处理过
        new_prompt = f"[中文]\n{zh}\n\n[English]\n{old}"
        c.execute("UPDATE inspirations SET prompt=? WHERE id=?", (new_prompt, rid))
        updated += 1

    conn.commit()
    conn.close()
    print(f"\n完成：翻译 {done} 条（失败 {len(failed)} 条），数据库更新 {updated} 条")
    if failed:
        print("失败 ID:", failed[:20])


if __name__ == "__main__":
    main()
