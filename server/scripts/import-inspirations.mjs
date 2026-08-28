#!/usr/bin/env node
/**
 * 灵感模板多源导入与去重脚本
 * 用法：node scripts/import-inspirations.mjs [sqlite文件路径]
 * 数据源：
 *   1. freestylefly/awesome-gpt-image-2 (data/cases.json) - 包含中文标题、分类、风格、场景与参考图
 *   2. davidwuw0811-boop/awesome-gpt-image2-prompts (prompts.json)
 *   3. ZeroLu/awesome-gpt-image (README.zh-CN.md)
 * 特性：
 *   - 自动去重（根据 Prompt 前缀特征码智能排重）
 *   - 优先保留 freestylefly 的高质量中文标题、标签与图片
 *   - 保留用户自定义创作（is_own = 1）
 */
import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.argv[2] ?? join(HERE, '..', '..', 'data', 'aigc.db');

const SOURCES_DIR = join(HERE, '..', '..', 'data', 'sources');
const FF_SRC = existsSync(join(SOURCES_DIR, 'freestylefly_cases.json'))
  ? join(SOURCES_DIR, 'freestylefly_cases.json')
  : '/tmp/freestylefly_cases.json';
const JSON_SRC = existsSync(join(SOURCES_DIR, 'prompts2.json'))
  ? join(SOURCES_DIR, 'prompts2.json')
  : '/tmp/prompts2.json';
const MD_SRC = existsSync(join(SOURCES_DIR, 'zerolu-cn.md'))
  ? join(SOURCES_DIR, 'zerolu-cn.md')
  : '/tmp/zerolu-cn.md';

const GH_RAW_DAVID = 'https://raw.githubusercontent.com/davidwuw0811-boop/awesome-gpt-image2-prompts/main/';
const GH_RAW_FF = 'https://raw.githubusercontent.com/freestylefly/awesome-gpt-image-2/main/data';
const GH_RAW_ZERO = 'https://raw.githubusercontent.com/ZeroLu/awesome-gpt-image/main';

if (!existsSync(DB_PATH)) {
  console.error(`数据库不存在: ${DB_PATH}（请先启动一次服务生成表结构）`);
  process.exit(1);
}
const db = new Database(DB_PATH);

function normPrompt(p) {
  if (!p) return '';
  return p.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 120);
}

function normalizeCategory(raw) {
  const c = (raw || '').trim();
  if (/3D|手办|潮玩|材质|渲染|Products|Product|电商/i.test(c)) return '3D与潮玩';
  if (/UI|界面|社交媒体|前端|Interfaces|Interface/i.test(c)) return 'UI与界面';
  if (/海报|广告|排版|Posters|Poster|Typography/i.test(c)) return '海报设计';
  if (/信息图|图表|教育|文档|Charts|Chart|Infographics|Infographic|Documents|Publishing/i.test(c)) return '信息图表';
  if (/人像|角色|肖像|头像|一致性|Characters|Character|People/i.test(c)) return '人像与角色';
  if (/动漫|插画|漫画|Illustration|Art/i.test(c)) return '动漫与插画';
  if (/摄影|照片|写实|食物|Photography|Realism|Realistic/i.test(c)) return '摄影写真';
  if (/风景|场景|建筑|空间|叙事|地图|Scenes|Storytelling|Architecture|Spaces/i.test(c)) return '场景与空间';
  if (/Logo|文字|字效|字体|Brand|Logos/i.test(c)) return 'Logo与文字';
  if (/游戏|卡牌|娱乐|Game/i.test(c)) return '游戏与娱乐';
  if (/古风|历史|Classical|History/i.test(c)) return '古风与艺术';
  return '其他创意';
}

const seenPrompts = new Set();
const rows = [];

// ---- 源1：freestylefly/awesome-gpt-image-2 (最高优先级) ----
if (existsSync(FF_SRC)) {
  try {
    const ffData = JSON.parse(readFileSync(FF_SRC, 'utf8'));
    const cases = ffData.cases || [];
    let added = 0;
    for (const item of cases) {
      const prompt = (item.prompt || '').trim();
      if (!prompt || prompt.length < 10) continue;
      const key = normPrompt(prompt);
      if (seenPrompts.has(key)) continue;
      seenPrompts.add(key);

      const cat = normalizeCategory(item.category || '');
      const tagsList = [];
      if (item.category) tagsList.push(item.category);
      if (item.sourceLabel) tagsList.push(item.sourceLabel);
      if (item.styles) {
        if (Array.isArray(item.styles)) tagsList.push(...item.styles);
        else tagsList.push(item.styles);
      }
      if (item.scenes) {
        if (Array.isArray(item.scenes)) tagsList.push(...item.scenes);
        else tagsList.push(item.scenes);
      }
      const uniqueTags = Array.from(new Set(tagsList.filter(Boolean))).join(' / ');
      const cover = item.image ? `${GH_RAW_FF}${item.image}` : null;

      rows.push({
        title: item.title || `灵感模板 #${item.id}`,
        prompt,
        category: cat,
        tags: uniqueTags,
        cover,
        source: 'freestylefly/awesome-gpt-image-2',
      });
      added++;
    }
    console.log(`源1 freestylefly/awesome-gpt-image-2: 成功载入 ${added} 条`);
  } catch (err) {
    console.error(`解析源1失败:`, err);
  }
} else {
  console.warn(`未找到 ${FF_SRC}，跳过源1`);
}

// ---- 源2：prompts2.json (davidwuw0811) ----
if (existsSync(JSON_SRC)) {
  try {
    const items = JSON.parse(readFileSync(JSON_SRC, 'utf8'));
    let added = 0;
    let dup = 0;
    for (const it of items) {
      if ((it.category_cn ?? '').startsWith('视频模板')) continue;
      const prompt = (it.prompt || '').trim();
      if (!prompt || prompt.length < 10) continue;
      const key = normPrompt(prompt);
      if (seenPrompts.has(key)) {
        dup++;
        continue;
      }
      seenPrompts.add(key);

      const cover = it.image ? `${GH_RAW_DAVID}${it.image}` : null;
      const tags = [it.category_cn, it.author, it.needs_ref ? '需参考图' : ''].filter(Boolean).join(' / ');
      rows.push({
        title: it.title_cn || it.title_en || '未命名灵感',
        prompt,
        category: normalizeCategory(it.category_cn || '其他'),
        tags,
        cover,
        source: 'awesome-gpt-image2-prompts',
      });
      added++;
    }
    console.log(`源2 prompts2.json: 成功载入 ${added} 条（去重跳过 ${dup} 条）`);
  } catch (err) {
    console.error(`解析源2失败:`, err);
  }
} else {
  console.warn(`未找到 ${JSON_SRC}，跳过源2`);
}

// ---- 源3：README.zh-CN.md (ZeroLu) ----
if (existsSync(MD_SRC)) {
  try {
    const md = readFileSync(MD_SRC, 'utf8');
    const lines = md.split('\n');
    let category = '其他创意';
    let current = null;
    let inPrompt = false;
    let promptLines = [];
    const mdRows = [];
    const flush = () => {
      if (current && promptLines.length) {
        mdRows.push({
          ...current,
          prompt: promptLines.join('\n').trim(),
          category: normalizeCategory(category),
          source: 'awesome-gpt-image',
        });
      }
      current = null;
      promptLines = [];
    };
    for (const line of lines) {
      const h2 = line.match(/^## (.+)/);
      if (h2) {
        flush();
        category = h2[1].replace(/\s+/g, '');
        continue;
      }
      const h3 = line.match(/^### (.+)/);
      if (h3) {
        flush();
        current = { title: h3[1].trim(), cover: null, tags: 'awesome-gpt-image' };
        continue;
      }
      if (current) {
        if (line.startsWith('```text')) {
          inPrompt = true;
          continue;
        }
        if (inPrompt && line.startsWith('```')) {
          inPrompt = false;
          continue;
        }
        if (inPrompt) {
          promptLines.push(line);
          continue;
        }
        // 提取封面：兼容三种形式
        //   1. HTML <img src="https://...">（绝对 URL，含 twimg）
        //   2. HTML <img src="assets/...">（仓库相对路径，拼接 GitHub raw）
        //   3. Markdown ![alt](https://...)（表格内嵌图）
        const imgAbs = line.match(/src="(https:\/\/[^"]+)"/) || line.match(/!\[[^\]]*\]\((https:\/\/[^)]+)\)/);
        const imgRel = line.match(/src="(assets\/[^"]+)"/);
        const badge = (u) => /badge|shield/i.test(u);
        if (!current.cover) {
          if (imgAbs && !badge(imgAbs[1])) {
            current.cover = imgAbs[1];
          } else if (imgRel && !badge(imgRel[1])) {
            current.cover = `${GH_RAW_ZERO}/${imgRel[1]}`;
          }
        }
      }
    }
    flush();

    let added = 0;
    let dup = 0;
    for (const r of mdRows) {
      if (/资源|贡献|Contribut|Resource/i.test(r.category) || r.prompt.length < 10) continue;
      const key = normPrompt(r.prompt);
      if (seenPrompts.has(key)) {
        dup++;
        continue;
      }
      seenPrompts.add(key);
      rows.push(r);
      added++;
    }
    console.log(`源3 ZeroLu MD: 成功载入 ${added} 条（去重跳过 ${dup} 条）`);
  } catch (err) {
    console.error(`解析源3失败:`, err);
  }
} else {
  console.warn(`未找到 ${MD_SRC}，跳过源3`);
}

// ---- 写入数据库（事务保证原子性）----
const tx = db.transaction(() => {
  db.prepare('DELETE FROM inspirations WHERE is_own=0').run();
  const ins = db.prepare(
    'INSERT INTO inspirations(title,prompt,category,tags,cover_path,source,is_own,created_at) VALUES(?,?,?,?,?,?,0,?)',
  );
  const now = Date.now();
  for (const r of rows) {
    ins.run(r.title, r.prompt, r.category, r.tags, r.cover, r.source, now);
  }
});

tx();
console.log(`\n导入完成！去重合并后共收录 ${rows.length} 条灵感模板 → ${DB_PATH}`);

// 输出分类统计
const stats = db.prepare('SELECT category, COUNT(*) as count FROM inspirations GROUP BY category ORDER BY count DESC').all();
console.log('分类统计：');
for (const s of stats) {
  console.log(`  ${s.category}: ${s.count}`);
}

db.close();
