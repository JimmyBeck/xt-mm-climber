// entrypoints/injected.content.ts
// 使用 Chrome MV3 原生 world: 'MAIN' + runAt: 'document_start'
// 在页面任何业务 JS 加载前最早注入，100% 免疫 CSP 限制，负责全网拦截与 RPC 签名发包

export default defineContentScript({
  matches: ['*://*.xiaohongshu.com/*'],
  world: 'MAIN',
  runAt: 'document_start',

  main() {
    const SENDER_TAG = '[小天媒媒助手-MAIN]';
    console.log(`${SENDER_TAG} 核心引擎启动 (原生 MAIN World)`);

    function broadcastData(category: 'notes' | 'comments', sourceUrl: string, data: any) {
      try {
        window.postMessage(
          {
            type: 'XHS_DATA_CAPTURED',
            sourceUrl,
            category,
            data,
          },
          '*'
        );
      } catch (e) {
        console.warn(`${SENDER_TAG} 广播数据失败:`, e);
      }
    }

    // 1. 被动拦截 Fetch
    const originalFetch = window.fetch;
    if (originalFetch) {
      window.fetch = async function (...args: Parameters<typeof window.fetch>) {
        const response = await originalFetch.apply(this, args);
        try {
          const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';

          // 匹配笔记类接口 (Feed、搜索列表、博主发布列表、首页推荐)
          if (
            url.includes('/api/sns/web/v1/feed') ||
            url.includes('/api/sns/web/v1/search/notes') ||
            url.includes('/api/sns/web/v1/user_posted') ||
            url.includes('/api/sns/web/v1/user/posted') ||
            url.includes('/api/sns/web/v1/homefeed')
          ) {
            const clone = response.clone();
            clone
              .json()
              .then((json) => {
                if (json && (json.data || json.items)) {
                  broadcastData('notes', url, json.data || json);
                }
              })
              .catch(() => {});
          }

          // 匹配评论类接口 (一级评论与二级子回复)
          if (
            url.includes('/api/sns/web/v2/comment/page') ||
            url.includes('/api/sns/web/v2/comment/sub/page')
          ) {
            const clone = response.clone();
            clone
              .json()
              .then((json) => {
                if (json && (json.data || json.comments)) {
                  broadcastData('comments', url, json.data || json);
                }
              })
              .catch(() => {});
          }
        } catch (e) {
          console.error(`${SENDER_TAG} fetch 拦截异常:`, e);
        }
        return response;
      };
    }

    // 2. 被动拦截 XMLHttpRequest
    const rawOpen = XMLHttpRequest.prototype.open;
    const rawSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...args: any[]) {
      (this as any)._url = args[1] || '';
      return rawOpen.apply(this, args as any);
    };
    XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, ...args: any[]) {
      this.addEventListener('load', () => {
        try {
          const url = (this as any)._url || '';
          if (
            url.includes('/api/sns/web/v1/feed') ||
            url.includes('/api/sns/web/v1/search/notes') ||
            url.includes('/api/sns/web/v1/user_posted') ||
            url.includes('/api/sns/web/v1/homefeed')
          ) {
            const json = JSON.parse(this.responseText);
            if (json && (json.data || json.items)) {
              broadcastData('notes', url, json.data || json);
            }
          }
          if (
            url.includes('/api/sns/web/v2/comment/page') ||
            url.includes('/api/sns/web/v2/comment/sub/page')
          ) {
            const json = JSON.parse(this.responseText);
            if (json && (json.data || json.comments)) {
              broadcastData('comments', url, json.data || json);
            }
          }
        } catch (_) {}
      });
      return rawSend.apply(this, args as any);
    };

    // 3. 主动 RPC 签名发包通道
    window.addEventListener('message', async (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'XHS_API_REQUEST') {
        const { reqId, url, method = 'GET', data = null } = msg;
        try {
          const headers: Record<string, string> = {};

          if (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT') {
            headers['Content-Type'] = 'application/json;charset=UTF-8';
          }

          // 自动调用小红书原生签名函数 _webmsxyw
          if (typeof (window as any)._webmsxyw === 'function') {
            try {
              const signObj = (window as any)._webmsxyw(url, data);
              if (signObj && typeof signObj === 'object') {
                if (signObj['X-s'] || signObj['x-s']) headers['x-s'] = signObj['X-s'] || signObj['x-s'];
                if (signObj['X-t'] || signObj['x-t']) headers['x-t'] = String(signObj['X-t'] || signObj['x-t']);
                if (signObj['X-s-common'] || signObj['x-s-common']) headers['x-s-common'] = signObj['X-s-common'] || signObj['x-s-common'];
              }
            } catch (signErr) {
              console.warn(`${SENDER_TAG} 签名计算异常:`, signErr);
            }
          }

          const fetchOptions: RequestInit = {
            method,
            headers,
            credentials: 'include',
          };
          if (method.toUpperCase() === 'POST' && data) {
            fetchOptions.body = JSON.stringify(data);
          }

          // 必须在 window 上下文中执行 fetch，杜绝 Illegal invocation
          const res = await window.fetch(url, fetchOptions);
          const status = res.status;
          let responseJson: any = null;
          try {
            responseJson = await res.json();
          } catch (_) {}

          window.postMessage(
            {
              type: 'XHS_API_RESPONSE',
              reqId,
              status,
              success: status === 200 && responseJson?.success !== false,
              data: responseJson,
            },
            '*'
          );
        } catch (err: any) {
          console.error(`${SENDER_TAG} RPC 执行异常:`, err);
          window.postMessage(
            {
              type: 'XHS_API_RESPONSE',
              reqId,
              status: 500,
              success: false,
              error: err?.message || '浏览器内部执行异常',
            },
            '*'
          );
        }
      }

      // 提取当前页面已注入的 __INITIAL_STATE__
      if (msg.type === 'XHS_MANUAL_EXTRACT_CURRENT_PAGE') {
        extractState();
      }
    });

    function extractState() {
      try {
        const state = (window as any).__INITIAL_STATE__;
        if (state?.note?.noteDetailMap) {
          const notesList: any[] = [];
          Object.values(state.note.noteDetailMap).forEach((val: any) => {
            if (val?.note) notesList.push(val.note);
          });
          if (notesList.length > 0) {
            broadcastData('notes', 'window.__INITIAL_STATE__', { items: notesList });
          }
        }
      } catch (_) {}
    }

    if (typeof document !== 'undefined') {
      if (document.readyState === 'complete') {
        extractState();
      } else {
        window.addEventListener('load', extractState);
      }
      setTimeout(extractState, 1500);
    }
  },
});
