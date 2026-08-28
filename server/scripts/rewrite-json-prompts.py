#!/usr/bin/env python3
"""
JSON 结构化提示词的中文部分改写脚本
针对 [中文] 与 [English] 内容相同的「伪双语」JSON 提示词：
  - [English] 部分保持原 JSON 不变（结构化提示词直接使用效果最佳）
  - [中文] 部分改写为自然流畅的中文文字描述（保留可替换参数提示）
断点续传：/tmp/json_desc_progress.json
"""
import json
import re
import sqlite3
import time
import requests

DB_PATH = "/home/ctyun/demo/aigc-studio/data/aigc.db"
GW_URL = "http://192.168.0.80:8080/v1/chat/completions"
MODEL = "gemini-3.7-flash"
PROGRESS_FILE = "/tmp/json_desc_progress.json"

with open("/tmp/gw_key.txt") as f:
    API_KEY = f.read().strip()

BILINGUAL_MARK = re.compile(r"\[中文\]|\[English\]", re.I)

SYSTEM_PROMPT = """你是一名 AI 绘画提示词专家。用户提供一份 JSON 结构化的图像生成提示词，请把它改写为一段自然流畅的中文文字描述。

改写要求：
1. 用通顺的中文段落/要点把 JSON 描述的画面完整表达出来，不要出现 JSON 语法、大括号、英文键名；
2. 画面中要出现的文字内容（如 default 里的「清風茶」「新発売」「128円」等日文/中文文案）必须原样保留，并用「画面文字“XXX”」的方式引用；
3. JSON 中的 {argument name="..." default="..."} 可替换参数，改写成：「【可自定义：产品名，默认“清風茶”】」这样的提示；
4. 保留所有设计要素：构图、配色、字体样式、各元素位置、风格氛围等，一条都不能丢；
5. 只输出改写后的中文描述，不要任何解释或代码块。"""


def rewrite(json_prompt: str) -> str | None:
    for attempt in range(3):
        try:
            r = requests.post(
                GW_URL,
                headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": MODEL,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": json_prompt},
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

    # 找出伪双语记录（中文 == 英文）
    todo = []
    for rid, p in rows:
        if str(rid) in progress:
            continue
        m = re.match(r"\[中文\]\n(.*?)\n\n\[English\]\n(.*)", p, re.S)
        if not m:
            continue
        if m.group(1).strip() == m.group(2).strip():
            todo.append((rid, m.group(2).strip()))  # 用英文部分作为改写输入

    print(f"待改写 JSON 描述: {len(todo)} 条（已有进度 {len(progress)} 条）")

    done = 0
    failed = []
    for rid, en_part in todo:
        desc = rewrite(en_part)
        if desc is None:
            failed.append(rid)
            print(f"  [{rid}] 改写失败，跳过")
            continue
        progress[str(rid)] = desc
        done += 1
        if done % 5 == 0:
            print(f"  进度: {done}/{len(todo)}")
            with open(PROGRESS_FILE, "w") as f:
                json.dump(progress, f, ensure_ascii=False)

    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f, ensure_ascii=False)

    # 落库：中文部分替换为自然描述，英文部分保持不变
    updated = 0
    for rid_str, desc in progress.items():
        rid = int(rid_str)
        row = c.execute("SELECT prompt FROM inspirations WHERE id=?", (rid,)).fetchone()
        if not row:
            continue
        p = row[0]
        m = re.match(r"\[中文\]\n(.*?)\n\n\[English\]\n(.*)", p, re.S)
        if not m:
            continue
        en_part = m.group(2).strip()
        # 若已是改写后的（重启幂等）：中文与英文不同则跳过
        if m.group(1).strip() != en_part:
            continue
        new_prompt = f"[中文]\n{desc}\n\n[English]\n{en_part}"
        c.execute("UPDATE inspirations SET prompt=? WHERE id=?", (new_prompt, rid))
        updated += 1

    conn.commit()
    conn.close()
    print(f"\n完成：改写 {done} 条（失败 {len(failed)} 条），数据库更新 {updated} 条")
    if failed:
        print("失败 ID:", failed)


if __name__ == "__main__":
    main()
