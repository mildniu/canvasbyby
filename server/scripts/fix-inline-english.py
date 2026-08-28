#!/usr/bin/env python3
"""
阶段3：中文提示词中行内英文片段的甄别翻译
找出 [中文] 部分中 3+ 连续英文单词的片段，由 LLM 判断：
  - 画面文字（海报标语、App 名、品牌等要画出来的）→ 保留
  - 描述性英文（翻译残留）→ 译为中文
只替换被判定为"描述性"的片段。断点续传：/tmp/inline_progress.json
"""
import json
import re
import sqlite3
import time
import requests

DB_PATH = "/home/ctyun/demo/aigc-studio/data/aigc.db"
GW_URL = "http://192.168.0.80:8080/v1/chat/completions"
MODEL = "gemini-3.7-flash"
PROGRESS_FILE = "/tmp/inline_progress.json"

with open("/tmp/gw_key.txt") as f:
    API_KEY = f.read().strip()

# 专有名词白名单（品牌/产品名，永不翻译）
BRAND_WHITELIST = {
    'iPhone', 'iPad', 'MacBook', 'macOS', 'iOS', 'App Store', 'Windows', 'Android',
    'Photoshop', 'Illustrator', 'Blender', 'Unreal Engine', 'ChatGPT', 'DALL-E',
    'GTA', 'Netflix', 'YouTube', 'TikTok', 'Instagram', 'Twitter', 'Facebook',
    'Nike', 'Adidas', 'Starbucks', 'Pokemon', 'Nintendo', 'PlayStation', 'Xbox',
    'QR', 'AR', 'VR', 'AI', 'PS', 'UI', 'UX', 'PNG', 'JPG', 'PDF', 'CSV',
}


def find_english_fragments(zh: str) -> list[str]:
    """找出行内 3+ 连续英文单词片段（排除符号内内容、白名单）"""
    # 移除符号内内容（占位符、JSON、argument 等已处理或保留的部分）
    cleaned = re.sub(r'【[^】]*】|\[[^\]\n]*\]|\{[^}]*\}', ' ', zh)
    frags = []
    for mm in re.finditer(r'[A-Za-z][A-Za-z\'\-]*(?:\s+[A-Za-z][A-Za-z\'\-]*){2,}', cleaned):
        frag = mm.group(0).strip()
        # 跳过白名单
        if any(b.lower() in frag.lower() for b in BRAND_WHITELIST if len(b) > 2):
            continue
        # 跳过全大写缩写组合
        if re.fullmatch(r'[A-Z\s\-]{3,}', frag):
            continue
        frags.append(frag)
    return frags


def translate_fragments(frags: list[str]) -> dict | None:
    """LLM 判断每个片段：画面文字保留（值=null）或翻译（值=中文）"""
    for attempt in range(3):
        try:
            r = requests.post(
                GW_URL,
                headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": MODEL,
                    "messages": [
                        {
                            "role": "system",
                            "content": """你是一名 AI 绘画提示词的中文校对专家。我会给你一些出现在中文提示词里的英文片段。
请判断每个片段的性质：
- 如果它是「画面上要出现的文字」（海报标语、Logo 文字、App 名称、书名、对话气泡内容等，通常模型需要把它画进图里）→ 输出 null（保留原样）
- 如果它是「描述性英文」（本应翻译成中文的画面描述，属于翻译残留）→ 输出对应的中文翻译

输出 JSON 对象：{"片段": "中文翻译" 或 null, ...}。不要其它内容。""",
                        },
                        {"role": "user", "content": json.dumps(frags, ensure_ascii=False)},
                    ],
                    "max_tokens": 4000,
                    "temperature": 0.2,
                },
                timeout=120,
            )
            if r.status_code == 200:
                out = r.json()["choices"][0]["message"]["content"].strip()
                out = re.sub(r"^```[a-z]*\n?|\n?```$", "", out).strip()
                return json.loads(out)
            time.sleep(2 * (attempt + 1))
        except Exception:
            time.sleep(2 * (attempt + 1))
    return None


def main():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, prompt FROM inspirations ORDER BY id")
    rows = c.fetchall()

    # 收集全部待判定片段（去重）
    all_frags = {}
    for rid, p in rows:
        m = re.match(r"\[中文\]\n([\s\S]*?)\n\n\[English\]", p)
        if not m:
            continue
        for frag in find_english_fragments(m.group(1)):
            all_frags.setdefault(frag, set()).add(rid)

    print(f"发现 {len(all_frags)} 个不同英文片段")

    progress = {}
    try:
        with open(PROGRESS_FILE) as f:
            progress = json.load(f)
    except FileNotFoundError:
        pass

    pending = [f for f in all_frags if f not in progress]
    print(f"待判定: {len(pending)}")

    # 分批（每批 30 个）
    BATCH = 30
    for i in range(0, len(pending), BATCH):
        batch = pending[i : i + BATCH]
        result = translate_fragments(batch)
        if result is None:
            print(f"  批次 {i//BATCH + 1} 失败，跳过")
            continue
        for frag, trans in result.items():
            progress[frag] = trans
        print(f"  批次 {i//BATCH + 1}: {len(result)} 项")
        with open(PROGRESS_FILE, "w") as f:
            json.dump(progress, f, ensure_ascii=False)

    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f, ensure_ascii=False)

    # 应用替换：只替换值为中文的片段（null 保留）
    updated = 0
    replaced = 0
    for rid, p in rows:
        m = re.match(r"\[中文\]\n([\s\S]*?)\n\n\[English\]\n([\s\S]*)", p)
        if not m:
            continue
        zh, en = m.group(1), m.group(2)
        new_zh = zh
        for frag, trans in progress.items():
            if trans and re.search(r"[\u4e00-\u9fff]", str(trans)) and frag in new_zh:
                # 词边界替换（避免部分匹配）
                new_zh = re.sub(
                    r"(?<![A-Za-z\-])" + re.escape(frag) + r"(?![A-Za-z\-])",
                    str(trans),
                    new_zh,
                )
                replaced += 1
        if new_zh != zh:
            conn.execute(
                "UPDATE inspirations SET prompt=? WHERE id=?",
                (f"[中文]\n{new_zh}\n\n[English]\n{en.strip()}", rid),
            )
            updated += 1

    conn.commit()
    conn.close()
    print(f"\n阶段3完成：更新 {updated} 条，替换 {replaced} 处")


if __name__ == "__main__":
    main()
