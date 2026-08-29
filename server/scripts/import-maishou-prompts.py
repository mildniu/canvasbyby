#!/usr/bin/env python3
"""
从 maishouai（yukkcat/image-prompts）导入新增提示词
流程：下载 7 个源 JSON → 与现有库去重 → LLM 翻译双语 → 导入 → 封面 WebP 本地化
依赖 /tmp/gw_key.txt（网关 Key）、/tmp/new_items.json（去重后条目）
本脚本为一次性导入的存档，重跑会按 prompt 指纹幂等去重。
"""
# 详见 /tmp/translate_new_zh2en.py、/tmp/download_new_covers.py 的执行历史
# 已于 2026-08-30 执行：新增 671 条（过滤 29 条 NSFW），总库 1382 条
