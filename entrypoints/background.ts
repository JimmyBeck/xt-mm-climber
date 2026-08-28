export default defineBackground(() => {
  console.log('[XHS-Copilot] 后台服务启动成功');

  chrome.runtime.onInstalled.addListener(() => {
    console.log('[XHS-Copilot] 插件安装就绪');
  });

  // 处理来自 Content Script 的消息
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'PING') {
      sendResponse({ status: 'PONG' });
    }
  });
});
