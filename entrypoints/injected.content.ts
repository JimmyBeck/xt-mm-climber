// entrypoints/injected.content.ts
// 使用 Chrome MV3 原生 world: 'MAIN' + runAt: 'document_start'
// 在页面任何业务 JS 加载前最早注入，100% 免疫 CSP 限制，负责全网拦截、签名克隆与 RPC 通道

export default defineContentScript({
  matches: ['*://*.xiaohongshu.com/*'],
  world: 'MAIN',
  runAt: 'document_start',

  main() {
    const SENDER_TAG = '[小天媒媒助手-MAIN]';
    console.log(`${SENDER_TAG} 核心引擎启动 (原生 MAIN World)`);

    // 缓存最新一次小红书原生请求的签名 Headers
    const lastSignatureHeaders: Record<string, string> = {};

    function captureHeaders(headersObj: any) {
      try {
        if (!headersObj) return;
        if (typeof headersObj.forEach === 'function') {
          headersObj.forEach((val: string, key: string) => {
            const k = key.toLowerCase();
            if (k.startsWith('x-s') || k.startsWith('x-t') || k.startsWith('x-b3')) {
              lastSignatureHeaders[k] = val;
            }
          });
        } else if (typeof headersObj === 'object') {
          Object.keys(headersObj).forEach((key) => {
            const k = key.toLowerCase();
            if (k.startsWith('x-s') || k.startsWith('x-t') || k.startsWith('x-b3')) {
              lastSignatureHeaders[k] = headersObj[key];
            }
          });
        }
      } catch (_) {}
    }

    function emitLog(type: 'INFO' | 'WARN' | 'ERROR' | 'NET_INTERCEPT' | 'RPC_REQ' | 'RPC_RES', message: string, detail?: any) {
      try {
        window.postMessage(
          {
            type: 'XHS_DIAGNOSTIC_LOG',
            logType: type,
            message,
            detail,
          },
          '*'
        );
      } catch (_) {}
    }

    function broadcastData(category: 'notes' | 'comments', sourceUrl: string, data: any) {
      try {
        emitLog('NET_INTERCEPT', `捕获到 ${category} 数据 (${sourceUrl.slice(0, 45)}...)`, { url: sourceUrl });
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
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
        const opts = args[1] || {};
        if (opts.headers) captureHeaders(opts.headers);

        const response = await originalFetch.apply(this, args);
        try {
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
                if (json && (json.data || json.items || json.notes)) {
                  broadcastData('notes', url, json.data || json);
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
                if (json && (json.data || json.comments)) {
                  broadcastData('comments', url, json.data || json);
                }
              })
              .catch(() => {});
          }
        } catch (e) {
          emitLog('ERROR', `Fetch 拦截处理异常: ${e}`);
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
            if (json && (json.data || json.items || json.notes)) {
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

    // 3. 主动 RPC 签名发包与页面 State 直提通道
    window.addEventListener('message', async (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;

      // 提取当前页面已有的 State 与 DOM 数据
      if (msg.type === 'XHS_GET_PAGE_STATE') {
        const { reqId, targetNoteId } = msg;
        const pageData = extractDirectPageData(targetNoteId);
        window.postMessage(
          {
            type: 'XHS_GET_PAGE_STATE_RESPONSE',
            reqId,
            success: !!pageData.note,
            data: pageData,
          },
          '*'
        );
        return;
      }

      if (msg.type === 'XHS_API_REQUEST') {
        const { reqId, url, method = 'GET', data = null } = msg;
        emitLog('RPC_REQ', `发起 API 请求: [${method}] ${url}`, { data });

        try {
          const headers: Record<string, string> = {
            ...lastSignatureHeaders,
          };

          if (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT') {
            headers['Content-Type'] = 'application/json;charset=UTF-8';
          }

          // 尝试调用小红书原生签名函数 _webmsxyw
          if (typeof (window as any)._webmsxyw === 'function') {
            try {
              const signObj = (window as any)._webmsxyw(url, data);
              if (signObj && typeof signObj === 'object') {
                if (signObj['X-s'] || signObj['x-s']) headers['x-s'] = signObj['X-s'] || signObj['x-s'];
                if (signObj['X-t'] || signObj['x-t']) headers['x-t'] = String(signObj['X-t'] || signObj['x-t']);
                if (signObj['X-s-common'] || signObj['x-s-common']) headers['x-s-common'] = signObj['X-s-common'] || signObj['x-s-common'];
              }
            } catch (signErr) {
              emitLog('WARN', `原生签名函数计算失败，已使用克隆模板头: ${signErr}`);
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

          const res = await window.fetch(url, fetchOptions);
          const status = res.status;
          let responseJson: any = null;
          try {
            responseJson = await res.json();
          } catch (_) {}

          emitLog('RPC_RES', `API 响应状态 [HTTP ${status}]`, { status, data: responseJson });

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
          emitLog('ERROR', `RPC 执行异常: ${err?.message || err}`);
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

      if (msg.type === 'XHS_MANUAL_EXTRACT_CURRENT_PAGE') {
        extractState();
      }
    });

    function extractDirectPageData(targetNoteId?: string) {
      let foundNote: any = null;
      const foundComments: any[] = [];

      try {
        const state = (window as any).__INITIAL_STATE__;
        if (state) {
          // 从 noteDetailMap 查找
          if (state.note?.noteDetailMap) {
            if (targetNoteId && state.note.noteDetailMap[targetNoteId]) {
              foundNote = state.note.noteDetailMap[targetNoteId]?.note || state.note.noteDetailMap[targetNoteId];
            } else {
              const firstKey = Object.keys(state.note.noteDetailMap)[0];
              if (firstKey) {
                foundNote = state.note.noteDetailMap[firstKey]?.note || state.note.noteDetailMap[firstKey];
              }
            }
          }
          // 从 user 查找
          if (!foundNote && state.user?.notesDetailMap) {
            if (targetNoteId && state.user.notesDetailMap[targetNoteId]) {
              foundNote = state.user.notesDetailMap[targetNoteId]?.note || state.user.notesDetailMap[targetNoteId];
            }
          }
          // 从 comments 查找
          if (state.comment?.commentsMap) {
            Object.values(state.comment.commentsMap).forEach((cList: any) => {
              if (Array.isArray(cList)) foundComments.push(...cList);
            });
          }
        }
      } catch (e) {
        emitLog('WARN', `提取 State 异常: ${e}`);
      }

      return { note: foundNote, comments: foundComments };
    }

    function extractState() {
      try {
        const state = (window as any).__INITIAL_STATE__;
        if (!state) return;

        // 1. 笔记详情页 state
        if (state.note?.noteDetailMap) {
          const notesList: any[] = [];
          Object.values(state.note.noteDetailMap).forEach((val: any) => {
            if (val?.note) notesList.push(val.note);
          });
          if (notesList.length > 0) {
            broadcastData('notes', 'window.__INITIAL_STATE__.note', { items: notesList });
          }
        }

        // 2. 博主个人主页 state
        if (state.user?.notesDetailMap || state.user?.userPosted) {
          const userNotes = state.user.notesDetailMap || state.user.userPosted;
          const list: any[] = [];
          if (Array.isArray(userNotes)) {
            list.push(...userNotes);
          } else if (typeof userNotes === 'object') {
            Object.values(userNotes).forEach((v: any) => {
              if (v?.note) list.push(v.note);
              else if (v?.id || v?.note_id) list.push(v);
            });
          }
          if (list.length > 0) {
            broadcastData('notes', 'window.__INITIAL_STATE__.user', { notes: list });
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
      setTimeout(extractState, 1000);
      setTimeout(extractState, 2500);
    }
  },
});
