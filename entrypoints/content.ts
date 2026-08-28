import { createApp } from 'vue';
import App from '../src/ui/App.vue';
import styleText from '../src/ui/style.css?inline';

export default defineContentScript({
  matches: ['*://*.xiaohongshu.com/*'],
  cssInjectionMode: 'ui',
  runAt: 'document_end',

  async main(ctx) {
    console.log('[小天媒媒助手] Content Script 开始注入...');

    // 1. 注入 injected.js 到页面 MAIN World
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('/injected.js');
      script.onload = () => {
        console.log('[小天媒媒助手] injected.js 加载成功');
        script.remove();
      };
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      console.error('[小天媒媒助手] 注入 script 异常:', e);
    }

    // 2. 挂载 Shadow DOM UI
    try {
      const ui = await createShadowRootUi(ctx, {
        name: 'xhs-copilot-ui',
        position: 'inline',
        anchor: 'body',
        append: 'last',
        onMount: (container, shadowRoot) => {
          // 确保 Host 自身有最高层级的 fixed 定位与展示
          const hostStyle = document.createElement('style');
          hostStyle.textContent = `
            :host {
              position: fixed !important;
              right: 0 !important;
              top: 30% !important;
              z-index: 2147483647 !important;
              display: block !important;
              margin: 0 !important;
              padding: 0 !important;
              pointer-events: auto !important;
            }
            ${styleText}
          `;
          shadowRoot.appendChild(hostStyle);

          const app = createApp(App);
          app.mount(container);
          console.log('[小天媒媒助手] UI 挂载成功');
          return app;
        },
        onRemove: (app) => {
          app?.unmount();
        },
      });

      ui.mount();
    } catch (err) {
      console.error('[小天媒媒助手] 挂载 UI 失败:', err);
    }
  },
});
