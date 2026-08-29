import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mildniu.canvasbyby',
  appName: 'CanvasByBy',
  webDir: 'web/dist',
  android: {
    // 允许 WebView 访问生产后端域名（API 与媒体资源）
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
    // 生产 API 地址（前端通过 VITE_API_BASE_URL 编译注入，此处仅作兜底提示，不劫持页面加载）
  },
};

export default config;
