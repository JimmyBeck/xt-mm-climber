import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: '小天媒媒助手',
    description: '小红书笔记、评论数据被动抓取与高清无水印素材一键导出工具',
    version: '0.1.0',
    permissions: [
      'storage',
      'downloads',
    ],
    host_permissions: [
      '*://*.xiaohongshu.com/*',
      '*://*.xhscdn.com/*',
    ],
    web_accessible_resources: [
      {
        resources: ['injected.js'],
        matches: ['*://*.xiaohongshu.com/*'],
      },
    ],
  },
  vite: () => ({
    build: {
      minify: 'terser',
      terserOptions: {
        format: {
          ascii_only: true, // 强制将非 ASCII 和 Surrogate 字符转义为 \uXXXX，彻底解决 Chrome UTF-8 校验报错
        },
      },
    },
  }),
});
