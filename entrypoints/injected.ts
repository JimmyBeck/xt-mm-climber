// entrypoints/injected.ts
// 运行在页面的 MAIN World 中，负责无感嗅探与主动带签名安全发包 RPC

export default defineUnlistedScript(() => {
  const SENDER_TAG = '[小天媒媒助手-Injected]';
  console.log(`${SENDER_TAG} 核心引擎就绪`);

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

  // 1. 被动 Hook Fetch
  const rawFetch = window.fetch;
  if (rawFetch) {
    window.fetch = async function (...args: Parameters<typeof window.fetch>) {
      const response = await rawFetch.apply(this, args);
      try {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';

        // 匹配笔记类接口
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
              if (json && json.data) {
                broadcastData('notes', url, json.data);
              }
            })
            .catch(() => {});
        }

        // 匹配评论类接口
        if (
          url.includes('/api/sns/web/v2/comment/page') ||
          url.includes('/api/sns/web/v2/comment/sub/page')
        ) {
          const clone = response.clone();
          clone
            .json()
            .then((json) => {
              if (json && json.data) {
                broadcastData('comments', url, json.data);
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

  // 2. 主动 RPC 请求签名与发包调度
  window.addEventListener('message', async (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;

    // 处理来自插件的主动 API 请求
    if (msg.type === 'XHS_API_REQUEST') {
      const { reqId, url, method = 'GET', data = null } = msg;
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json;charset=UTF-8',
        };

        // 如果页面存在小红书全局签名函数 _webmsxyw，调用生成签名
        if (typeof (window as any)._webmsxyw === 'function') {
          try {
            const signObj = (window as any)._webmsxyw(url, data);
            if (signObj && typeof signObj === 'object') {
              if (signObj['X-s'] || signObj['x-s']) headers['x-s'] = signObj['X-s'] || signObj['x-s'];
              if (signObj['X-t'] || signObj['x-t']) headers['x-t'] = String(signObj['X-t'] || signObj['x-t']);
              if (signObj['X-s-common'] || signObj['x-s-common']) headers['x-s-common'] = signObj['X-s-common'] || signObj['x-s-common'];
            }
          } catch (signErr) {
            console.warn(`${SENDER_TAG} 签名生成异常:`, signErr);
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

        const res = await rawFetch(url, fetchOptions);
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
        window.postMessage(
          {
            type: 'XHS_API_RESPONSE',
            reqId,
            status: 500,
            success: false,
            error: err?.message || '网络异常',
          },
          '*'
        );
      }
    }

    // 手动提取当前页已渲染 state
    if (msg.type === 'XHS_MANUAL_EXTRACT_CURRENT_PAGE') {
      extractCurrentPageData();
    }
  });

  // 3. 读取页面已有 __INITIAL_STATE__
  function extractCurrentPageData() {
    try {
      const state = (window as any).__INITIAL_STATE__;
      if (state?.note?.noteDetailMap) {
        const noteMap = state.note.noteDetailMap;
        const notesList: any[] = [];
        Object.values(noteMap).forEach((val: any) => {
          if (val?.note) {
            notesList.push(val.note);
          }
        });
        if (notesList.length > 0) {
          broadcastData('notes', 'window.__INITIAL_STATE__', { items: notesList });
        }
      }
    } catch (e) {
      console.warn(`${SENDER_TAG} 提取当前页 state 失败:`, e);
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'complete') {
      extractCurrentPageData();
    } else {
      window.addEventListener('load', extractCurrentPageData);
    }
    setTimeout(extractCurrentPageData, 1200);
  }
});
