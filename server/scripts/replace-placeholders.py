#!/usr/bin/env python3
"""
阶段2：占位符精准替换
对 [中文] 部分中残留的英文占位符做查表替换：
  - 【English】 → 【中文】
  - [ENGLISH] → [中文]
  - {argument name="english" ...} → {argument name="中文" ...}
  - 【可自定义：english，默认...】 → 【可自定义：中文，默认...】
default 值一律不动；含中文的不动；映射表没有的不动。
"""
import json
import re
import sqlite3

DB_PATH = "/home/ctyun/demo/aigc-studio/data/aigc.db"
MAPPING = json.load(open("/tmp/ph_mapping.json"))

# 白名单：这些是画面文字/品牌，不译
WHITELIST = {"PROMPT"}  # 已在映射表中处理

HAS_ZH = re.compile(r"[\u4e00-\u9fff]")
HAS_EN = re.compile(r"[a-zA-Z]")


def lookup(phrase: str) -> str | None:
    """查映射表：精确 → 小写 → 去下划线空格变体"""
    phrase = phrase.strip()
    if not phrase or not HAS_EN.search(phrase) or HAS_ZH.search(phrase):
        return None
    if phrase in MAPPING:
        v = MAPPING[phrase]
        return v if v and not re.fullmatch(r'["\s]*', v) else None
    lower = phrase.lower()
    for k, v in MAPPING.items():
        if k.lower() == lower:
            return v
    # 下划线变体：CITY_NAME == city name
    normalized = lower.replace("_", " ")
    for k, v in MAPPING.items():
        if k.lower().replace("_", " ") == normalized:
            return v
    return None


def replace_placeholders(zh: str):
    """返回 (新文本, 替换数)"""
    count = 0

    # 1. 【English】
    def brack_repl(m):
        nonlocal count
        trans = lookup(m.group(1))
        if trans:
            count += 1
            return f"【{trans}】"
        return m.group(0)

    zh = re.sub(r"【([^】]+)】", brack_repl, zh)

    # 2. [ENGLISH]（单行内、非嵌套）
    def square_repl(m):
        nonlocal count
        trans = lookup(m.group(1))
        if trans:
            count += 1
            return f"[{trans}]"
        return m.group(0)

    zh = re.sub(r"\[([^\]\n]{1,60})\]", square_repl, zh)

    # 3. {argument name="english" default="..."}：只替换 name
    def argname_repl(m):
        nonlocal count
        trans = lookup(m.group(1))
        if trans:
            count += 1
            return f'{{argument name="{trans}"'
        return m.group(0)

    zh = re.sub(r'\{argument\s+name="([^"]*)"', argname_repl, zh)

    # 4. 【可自定义：english，默认...】
    def custom_repl(m):
        nonlocal count
        trans = lookup(m.group(1))
        if trans:
            count += 1
            return f"【可自定义：{trans}，"
        return m.group(0)

    zh = re.sub(r"【可自定义：([^，,]+)，", custom_repl, zh)

    return zh, count


def main():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, prompt FROM inspirations ORDER BY id")
    rows = c.fetchall()

    updated = 0
    total_repl = 0
    samples = []
    for rid, p in rows:
        m = re.match(r"\[中文\]\n([\s\S]*?)\n\n\[English\]\n([\s\S]*)", p)
        if not m:
            continue
        zh, en = m.group(1), m.group(2)
        new_zh, n = replace_placeholders(zh)
        if n == 0:
            continue
        new_prompt = f"[中文]\n{new_zh}\n\n[English]\n{en.strip()}"
        c.execute("UPDATE inspirations SET prompt=? WHERE id=?", (new_prompt, rid))
        updated += 1
        total_repl += n
        if len(samples) < 8:
            samples.append((rid, n))

    conn.commit()
    conn.close()
    print(f"阶段2完成：更新 {updated} 条记录，共替换 {total_repl} 处占位符")
    print("样例:", samples)


if __name__ == "__main__":
    main()
