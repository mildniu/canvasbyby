/**
 * Android 原生能力桥接层
 * 网页端优雅降级为 Web 行为；原生 App 中调用 Capacitor 插件。
 */
import { Capacitor } from '@capacitor/core';
import { IS_NATIVE_APP } from './config';

export const isNative = (): boolean => IS_NATIVE_APP;

/** 动态加载插件，避免网页端引入原生模块副作用 */
async function plugin<T>(name: string): Promise<T | null> {
  if (!isNative()) return null;
  try {
    const mod: any = await import(/* @vite-ignore */ `@capacitor/${name}`);
    return (mod.default ?? mod) as T;
  } catch {
    return null;
  }
}

export interface NativeImageResult {
  dataUrl: string | null;
  canceled: boolean;
}

/** 从系统相册选择一张图片（返回压缩后的 dataUrl） */
export async function pickFromGallery(): Promise<NativeImageResult> {
  const Camera = await plugin<any>('camera');
  if (!Camera) return { dataUrl: null, canceled: true };
  try {
    const photo = await Camera.pickImages({ limit: 1, quality: 90 });
    const img = photo?.photos?.[0];
    if (!img?.webPath) return { dataUrl: null, canceled: true };
    const dataUrl = await fetch(img.webPath).then((r) => r.blob()).then(
      (b) => new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(b);
      })
    );
    return { dataUrl, canceled: false };
  } catch {
    return { dataUrl: null, canceled: true };
  }
}

/** 多选相册图片（最多 max 张） */
export async function pickMultipleFromGallery(max: number): Promise<string[]> {
  const Camera = await plugin<any>('camera');
  if (!Camera) return [];
  try {
    const photo = await Camera.pickImages({ limit: max, quality: 90 });
    const list = photo?.photos ?? [];
    const urls: string[] = [];
    for (const img of list) {
      if (img?.webPath) {
        const dataUrl = await fetch(img.webPath).then((r) => r.blob()).then(
          (b) => new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(b);
          })
        );
        urls.push(dataUrl);
      }
    }
    return urls;
  } catch {
    return [];
  }
}

/** 调用摄像头拍照 */
export async function takePhoto(): Promise<NativeImageResult> {
  const Camera = await plugin<any>('camera');
  if (!Camera) return { dataUrl: null, canceled: true };
  try {
    const photo = await Camera.getPhoto({
      resultType: 'DataUrl',
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

/** 保存图片到系统相册（原生）；网页端返回 false 走浏览器下载 */
export async function saveImageToGallery(url: string, filename: string): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const res = await fetch(url, { credentials: 'include' });
    const blob = await res.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] ?? '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const Filesystem = await plugin<any>('filesystem');
    if (!Filesystem) return false;
    const saved = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: 'DOCUMENTS',
      recursive: true,
    });
    return !!saved?.uri;
  } catch {
    return false;
  }
}

/** 分享图片到其他 App */
export async function shareImage(url: string, title: string): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const res = await fetch(url, { credentials: 'include' });
    const blob = await res.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] ?? '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const Share = await plugin<any>('share');
    if (!Share) return false;
    await Share.share({ title, dialogTitle: title });
    return true;
  } catch {
    return false;
  }
}

/** 分享纯文本 */
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
  const Share = await plugin<any>('share');
  if (!Share) return false;
  try {
    await Share.share({ title, text, dialogTitle: title });
    return true;
  } catch {
    return false;
  }
}

/** 复制文本到剪贴板（原生优先，Web 降级） */
export async function copyText(text: string): Promise<boolean> {
  const Clipboard = await plugin<any>('clipboard');
  if (Clipboard) {
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
  const Haptics = await plugin<any>('haptics');
  if (!Haptics) return;
  try {
    await Haptics.impact({ style: 'LIGHT' });
  } catch {
    /* 忽略 */
  }
}

/** App 风格确认框；网页端降级 window.confirm */
export async function confirmDialog(message: string, title = '确认'): Promise<boolean> {
  const Dialog = await plugin<any>('dialog');
  if (Dialog) {
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
  const Dialog = await plugin<any>('dialog');
  if (Dialog) {
    try {
      await Dialog.alert({ title, message, buttonTitle: '好的' });
      return;
    } catch {
      /* 降级 */
    }
  }
  window.alert(message);
}
