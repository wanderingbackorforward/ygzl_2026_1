import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.settlement.digitaltwin',
  appName: '沉降监测',
  webDir: 'www',
  server: {
    // 允许跨域请求到 Vercel 后端
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
