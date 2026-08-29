/**
 * 统一 API / 媒体地址工具
 * - 网页端：VITE_API_BASE_URL 未设置时返回 ''，继续使用同源相对路径
 * - 安卓端：构建时注入 https://canvas.zqyijing.cn:16689，所有请求指向现有后端
 */

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

export const API_BASE_URL = RAW_BASE;

/** 是否运行在原生 App（Capacitor）环境中 */
export const IS_NATIVE_APP =
  typeof window !== 'undefined' &&
  ((window as any).Capacitor?.isNativePlatform?.() ?? false);

/** 将相对路径转为完整 API 地址（绝对地址原样返回） */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path}`;
}

/** 媒体资源地址（/media/...），同样基于 API 基础地址 */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${API_BASE_URL}${path}`;
}
