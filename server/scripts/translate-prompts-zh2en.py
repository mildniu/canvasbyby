#!/usr/bin/env python3
"""
灵感提示词双语化（第二阶段：中文 → 英文）
将纯中文提示词翻译为英文，重组为：
  [中文]
  <原文>

  [English]
  <英文译文>
断点续传：/tmp/bilingual_zh2en_progress.json
"""
import json
import re
import sqlite3
import time
import requests

DB_PATH = "/home/ctyun/demo/aigc-studio/data/aigc.db"
GW_URL = "http://192.168.0.80:8080/v1/chat/completions"
MODEL = "gemini-3.7-flash"
PROGRESS_FILE = "/tmp/bilingual_zh2en_progress.json"

with open("/tmp/gw_key.txt") as f:
    API_KEY = f.read().strip()

HAS_ZH = re.compile(r"[\u4e00-\u9fff]")
BILINGUAL_MARK = re.compile(r"\[中文\]|\[English\]|\[EN\]", re.I)

SYSTEM_PROMPT = """You are a professional AI image-prompt translator. Translate the user's Chinese image-generation prompt into natural, fluent English.
Requirements:
1. Faithful and complete — never omit, add, or alter any detail (aspect ratio, style, lighting, camera, etc.);
2. Use standard AI-art terminology (e.g. 画面比例→aspect ratio, 景深→depth of field, 电影感布光→cinematic lighting);
3. Preserve the original structure (JSON blocks, paragraphs, lists, headings translated in place);
4. Output ONLY the English translation itself — no explanations, no prefixes, no code fences."""


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
                out = re.sub(r"^```[a-z]*\n?|\n?```$", "", out).strip()
                if out:
                    return out
            time.sleep(2 * (attempt + 1))
        except Exception:
            time.sleep(2 * (attempt + 1))
    return None


def main():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, prompt FROM inspirations ORDER BY id")
    rows = c.fetchall()

    progress = {}
    try:
        with open(PROGRESS_FILE) as f:
            progress = json.load(f)
    except FileNotFoundError:
        pass

    todo = []
    for rid, prompt in rows:
        if BILINGUAL_MARK.search(prompt):
            continue
        if not HAS_ZH.search(prompt):
            continue  # 非中文（第一阶段已处理）
        if str(rid) in progress:
            continue
        todo.append((rid, prompt))

    print(f"待翻译(中→英): {len(todo)} 条（已有进度 {len(progress)} 条）")

    done = 0
    failed = []
    for rid, prompt in todo:
        en = translate(prompt)
        if en is None:
            failed.append(rid)
            print(f"  [{rid}] 翻译失败，跳过")
            continue
        progress[str(rid)] = en
        done += 1
        if done % 10 == 0:
            print(f"  进度: {done}/{len(todo)}")
            with open(PROGRESS_FILE, "w") as f:
                json.dump(progress, f, ensure_ascii=False)

    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f, ensure_ascii=False)

    updated = 0
    for rid_str, en in progress.items():
        rid = int(rid_str)
        row = c.execute("SELECT prompt FROM inspirations WHERE id=?", (rid,)).fetchone()
        if not row:
            continue
        old = row[0]
        if BILINGUAL_MARK.search(old):
            continue
        new_prompt = f"[中文]\n{old}\n\n[English]\n{en}"
        c.execute("UPDATE inspirations SET prompt=? WHERE id=?", (new_prompt, rid))
        updated += 1

    conn.commit()
    conn.close()
    print(f"\n完成：翻译 {done} 条（失败 {len(failed)} 条），数据库更新 {updated} 条")
    if failed:
        print("失败 ID:", failed[:20])


if __name__ == "__main__":
    main()
