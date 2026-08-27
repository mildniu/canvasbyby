/**
 * 提示词守卫（借鉴 iLab prompt_guard.py 简化版）：
 * 识别中文提示词中的“硬性约束”关键词；生成请求前注入保真规则，
 * 防止模型扩写/改写时丢失用户明确指定的对象、文字、颜色、构图和限制项。
 */

const TITLE_MARKERS = ['文案标题', '标题', '字体', '字形', '字效', '文字'];
const TITLE_STYLE_MARKERS = ['Q版', '卡通', '圆润', '可爱', '儿童', '泡泡', '手写', '贴纸'];
const COLOR_MARKERS = ['色彩', '颜色', '配色', '色调'];
const LIMIT_MARKERS = ['限制', '要求', '禁止', '不要', '不能', '不得', '必须', '只生成', '避免', '严格按照'];

/** 提取提示词中的硬性约束片段（含关键词的整句） */
export function extractHardConstraints(prompt: string): string[] {
  const sentences = prompt.split(/[。！？!?\n；;]+/).map((s) => s.trim()).filter(Boolean);
  const allMarkers = [...TITLE_MARKERS, ...TITLE_STYLE_MARKERS, ...COLOR_MARKERS, ...LIMIT_MARKERS];
  return sentences.filter((s) => allMarkers.some((m) => s.includes(m)));
}

/** 是否需要注入守卫规则 */
export function needsGuard(prompt: string): boolean {
  return extractHardConstraints(prompt).length > 0;
}

/** 注入提示词保真规则（仅在检测到硬性约束时） */
export function applyPromptGuard(prompt: string): string {
  const constraints = extractHardConstraints(prompt);
  if (constraints.length === 0) return prompt;

  const guardLines = [
    '提示词保真规则：',
    '严格按以下要求生成图像，不得偏离、弱化或省略任何硬性约束：',
    ...constraints.map((c) => `- ${c}`),
  ];
  return `${prompt}\n\n${guardLines.join('\n')}`;
}
