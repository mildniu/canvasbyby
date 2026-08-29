/**
 * Android 原生能力桥接层
 * 网页端优雅降级为 Web 行为；原生 App 中调用 Capacitor 插件。
 * 插件使用静态导入（动态 import 的模板字符串无法被 Vite 打包进产物）。
 */
import { Capacitor } from '@capacitor/core';
import { IS_NATIVE_APP } from './config';

// 静态导入所有原生插件
import { Camera, CameraResultType } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import { Dialog } from '@capacitor/dialog';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export const isNative = (): boolean => IS_NATIVE_APP;

export interface NativeImageResult {
  dataUrl: string | null;
  canceled: boolean;
}

/** 读取 webPath 为 dataUrl */
async function webPathToDataUrl(webPath: string): Promise<string> {
  const blob = await fetch(webPath).then((r) => r.blob());
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** 从系统相册选择一张图片 */
export async function pickFromGallery(): Promise<NativeImageResult> {
  if (!isNative()) return { dataUrl: null, canceled: true };
  try {
    const photo = await Camera.pickImages({ limit: 1, quality: 90 });
    const img = photo?.photos?.[0];
    if (!img?.webPath) return { dataUrl: null, canceled: true };
    const dataUrl = await webPathToDataUrl(img.webPath);
    return { dataUrl, canceled: false };
  } catch {
    return { dataUrl: null, canceled: true };
  }
}

/** 多选相册图片（最多 max 张） */
export async function pickMultipleFromGallery(max: number): Promise<string[]> {
  if (!isNative()) return [];
  try {
    const result = await Camera.pickImages({ limit: max, quality: 90 });
    const list = result?.photos ?? [];
    const urls: string[] = [];
    for (const img of list) {
      if (img?.webPath) {
        urls.push(await webPathToDataUrl(img.webPath));
      }
    }
    return urls;
  } catch {
    return [];
  }
}

/** 调用摄像头拍照 */
export async function takePhoto(): Promise<NativeImageResult> {
  if (!isNative()) return { dataUrl: null, canceled: true };
  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      quality: 90,
      width: 1600,
      correctOrientation: true,
    });
    if (!photo?.dataUrl) return { dataUrl: null, canceled: true };
    return { dataUrl: photo.dataUrl, canceled: false };
  } catch {
    return { dataUrl: null, canceled: true };
  }
}

/** blob 转 base64 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** 保存图片到设备存储（原生）；网页端返回 false 走浏览器下载 */
export async function saveImageToGallery(url: string, filename: string): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const res = await fetch(url, { credentials: 'include' });
    const blob = await res.blob();
    const base64 = await blobToBase64(blob);
    const saved = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    });
    return !!saved?.uri;
  } catch {
    return false;
  }
}

/** 分享文本到其他 App */
export async function shareText(text: string, title: string): Promise<boolean> {
  if (!isNative()) {
    if (navigator.share) {
      try {
        await navigator.share({ text, title });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
  try {
    await Share.share({ title, text, dialogTitle: title });
    return true;
  } catch {
    return false;
  }
}

/** 复制文本到剪贴板（原生优先，Web 降级） */
export async function copyText(text: string): Promise<boolean> {
  if (isNative()) {
    try {
      await Clipboard.write({ string: text });
      return true;
    } catch {
      /* 降级 */
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** 触感反馈（轻） */
export async function hapticLight(): Promise<void> {
  if (!isNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* 忽略 */
  }
}

/** App 风格确认框；网页端降级 window.confirm */
export async function confirmDialog(message: string, title = '确认'): Promise<boolean> {
  if (isNative()) {
    try {
      const r = await Dialog.confirm({ title, message, okButtonTitle: '确定', cancelButtonTitle: '取消' });
      return r?.value === true;
    } catch {
      return false;
    }
  }
  return window.confirm(message);
}

/** App 风格提示框；网页端降级 alert */
export async function alertDialog(message: string, title = '提示'): Promise<void> {
  if (isNative()) {
    try {
      await Dialog.alert({ title, message, buttonTitle: '好的' });
      return;
    } catch {
      /* 降级 */
    }
  }
  window.alert(message);
}
