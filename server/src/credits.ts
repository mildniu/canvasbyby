/**
 * AI 生图模型积分定价体系
 * 按照用户指定规则计费：
 *  - Qwen 系列全部 1 积分 / 次（如 Qwen-Image、Qwen-Image-Edit-2509、Qwen2.5 等）
 *  - GPT 系列标准档 2 积分 / 次（如 gpt-image-2、gpt-image-1.5、dall-e-3 等）
 *  - GPT 特殊档：gpt-image-2.5-flare 4 积分、gpt-image-2.5-sunburst / gpt-image-2-s 6/8 积分、
 *    gpt-image-2.5-fs 16 积分、gpt-image-2.5-ss 20 积分
 *  - Gemini 系列全部 2 积分 / 次（如 gemini-3.1-flash-image、gemini-2.5-flash 等）
 *  - Grok 系列全部 6 积分 / 次（如 grok-imagine-image、grok-imagine-image-quality 等）
 *  - 默认其他模型：2 积分 / 次
 */

export interface ModelCreditRule {
  pattern: RegExp;
  cost: number;
  desc: string;
}

export const MODEL_PRICING_RULES: ModelCreditRule[] = [
  // 20 积分档位：GPT Image 2.5 SS
  {
    pattern: /gpt-image-2\.5-ss/i,
    cost: 20,
    desc: 'GPT Image 2.5 SS 生图 (20积分)',
  },
  // 16 积分档位：GPT Image 2.5 FS
  {
    pattern: /gpt-image-2\.5-fs/i,
    cost: 16,
    desc: 'GPT Image 2.5 FS 生图 (16积分)',
  },
  // 8 积分档位：GPT Image 2 S
  {
    pattern: /gpt-image-2-s/i,
    cost: 8,
    desc: 'GPT Image 2 S 生图 (8积分)',
  },
  // 6 积分档位：GPT Image 2.5 Sunburst 旗舰
  {
    pattern: /gpt-image-2\.5-sunburst/i,
    cost: 6,
    desc: 'GPT Image 2.5 Sunburst 旗舰生图 (6积分)',
  },
  // 4 积分档位：GPT Image 2.5 Flare
  {
    pattern: /gpt-image-2\.5-flare/i,
    cost: 4,
    desc: 'GPT Image 2.5 Flare 生图 (4积分)',
  },
  // 1 积分档位：Qwen 系列
  {
    pattern: /qwen/i,
    cost: 1,
    desc: 'Qwen 系列生图/编辑 (1积分)',
  },
  // 2 积分档位：GPT 系列（标准档）
  {
    pattern: /gpt|dall/i,
    cost: 2,
    desc: 'GPT 系列生图 (2积分)',
  },
  // 2 积分档位：Gemini 系列
  {
    pattern: /gemini|imagen/i,
    cost: 2,
    desc: 'Gemini 系列生图 (2积分)',
  },
  // 6 积分档位：Grok 系列
  {
    pattern: /grok/i,
    cost: 6,
    desc: 'Grok 系列生图 (6积分)',
  },
];

/**
 * 获取指定生图模型单次调用的积分消耗
 */
export function getModelCreditCost(model: string): number {
  if (!model) return 2;
  for (const rule of MODEL_PRICING_RULES) {
    if (rule.pattern.test(model)) {
      return rule.cost;
    }
  }
  return 2; // 默认 2 积分
}

/**
 * 批量计算模型积分字典
 */
export function getModelsPricingMap(models: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const m of models) {
    map[m] = getModelCreditCost(m);
  }
  return map;
}
