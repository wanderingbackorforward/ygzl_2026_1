import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.settlement.digitaltwin',
  appName: '杨高中路隧道监测数字孪生系统',
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
