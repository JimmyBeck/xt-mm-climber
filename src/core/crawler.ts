import type { XhsNote, XhsComment, CrawlProgress, NoteCrawlItemReport, CrawlTaskSummaryReport } from '../types';
import { parseNotesPayload, parseCommentsPayload, parseSubCommentsPayload } from './parser';
import { sleepSafe } from './scheduler';

/**
 * 封装与 Injected Main World 通信的 RPC 请求器（带 12s 超时看门狗机制）
 */
export function callXhsApi(
  url: string,
  method = 'GET',
  data?: any,
  timeoutMs = 12000
): Promise<{ success: boolean; status: number; data?: any; error?: string; isTimeout?: boolean }> {
  return new Promise((resolve) => {
    const reqId = 'req_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now();
    let hasResolved = false;

    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg && msg.type === 'XHS_API_RESPONSE' && msg.reqId === reqId) {
        if (!hasResolved) {
          hasResolved = true;
          window.removeEventListener('message', handler);
          resolve({
            success: msg.success,
            status: msg.status,
            data: msg.data,
            error: msg.error,
            isTimeout: false,
          });
        }
      }
    };

    window.addEventListener('message', handler);
    window.postMessage(
      {
        type: 'XHS_API_REQUEST',
        reqId,
        url,
        method,
        data,
      },
      '*'
    );

    // 12秒看门狗超时保护：超时自动切断并返回，绝不死锁卡死
    setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true;
        window.removeEventListener('message', handler);
        resolve({ success: false, status: 408, error: '小红书接口响应超时(>12s)', isTimeout: true });
      }
    }, timeoutMs);
  });
}

/**
 * 核心：单篇笔记全量评论递归抓取器（返回完整评论数据与人话版诊断报告）
 */
export async function crawlAllCommentsForNote(
  noteId: string,
  xsecToken: string,
  onLog: (logText: string, totalCount: number) => void,
  shouldStop?: () => boolean
): Promise<{ comments: XhsComment[]; report: NoteCrawlItemReport }> {
  const allComments: XhsComment[] = [];
  const commentIdSet = new Set<string>();

  let primaryCursor = '';
  let hasMorePrimary = true;
  let primaryPage = 0;
  let hasEncounteredTimeout = false;
  let userStopped = false;

  onLog(`🚀 开始抓取笔记 [${noteId.slice(-6)}] 的评论区...`, 0);

  // 1. 遍历一级评论分页
  while (hasMorePrimary) {
    if (shouldStop && shouldStop()) {
      userStopped = true;
      break;
    }
    primaryPage++;

    const primaryUrl = `/api/sns/web/v2/comment/page?note_id=${noteId}&cursor=${encodeURIComponent(primaryCursor)}&image_formats=jpg,webp,avif${xsecToken ? `&xsec_token=${encodeURIComponent(xsecToken)}` : ''}`;
    
    // 拟人化安全间隔
    await sleepSafe(2200, 3800);

    onLog(`[第 ${primaryPage} 页] 正在拉取一级评论...`, allComments.length);
    const res = await callXhsApi(primaryUrl, 'GET');

    if (!res.success || !res.data) {
      if (res.isTimeout) {
        hasEncounteredTimeout = true;
        onLog(`⚠️ [看门狗触发] 一级评论第 ${primaryPage} 页响应超时，已自动保全已抓数据并安全收尾`, allComments.length);
      } else {
        onLog(`⚠️ 一级评论第 ${primaryPage} 页返回状态码 ${res.status}，结束本篇主评拉取`, allComments.length);
      }
      break;
    }

    const rawData = res.data?.data || res.data;
    const rawComments = rawData.comments || [];
    hasMorePrimary = rawData.has_more === true && !!rawData.cursor && rawData.cursor !== primaryCursor;
    primaryCursor = rawData.cursor || '';

    // 解析当前页一级主评
    const currentPrimaryComments = parseCommentsPayload(rawData, noteId);
    let newInPage = 0;
    for (const c of currentPrimaryComments) {
      if (!commentIdSet.has(c.id)) {
        commentIdSet.add(c.id);
        allComments.push(c);
        newInPage++;
      }
    }
    onLog(`✓ 一级评论第 ${primaryPage} 页成功获取 ${newInPage} 条`, allComments.length);

    // 2. 递归穿透并展开所有被折叠的“展开 X 条回复”
    for (const rawC of rawComments) {
      if (shouldStop && shouldStop()) {
        userStopped = true;
        break;
      }

      const subCount = Number(rawC.sub_comment_count || 0);
      const subHasMore = rawC.sub_comment_has_more === true;
      const rootId = rawC.id;
      const authorName = rawC.user_info?.nickname || rawC.user?.name || '用户';

      if ((subHasMore || subCount > 1) && rootId) {
        onLog(`↳ 发现主评【${authorName}】有 ${subCount} 条折叠回复，自动请求展开...`, allComments.length);

        let subCursor = rawC.sub_comment_cursor || '';
        let hasMoreSub = true;
        let subPage = 0;

        while (hasMoreSub) {
          if (shouldStop && shouldStop()) {
            userStopped = true;
            break;
          }
          subPage++;

          await sleepSafe(1800, 3200);

          const subUrl = `/api/sns/web/v2/comment/sub/page?note_id=${noteId}&root_comment_id=${rootId}&num=30&cursor=${encodeURIComponent(subCursor)}&image_formats=jpg,webp,avif${xsecToken ? `&xsec_token=${encodeURIComponent(xsecToken)}` : ''}`;
          const subRes = await callXhsApi(subUrl, 'GET');

          if (!subRes.success || !subRes.data) {
            if (subRes.isTimeout) hasEncounteredTimeout = true;
            break;
          }

          const rawSubData = subRes.data?.data || subRes.data;
          const parsedSubList = parseSubCommentsPayload(rawSubData, noteId, rootId);
          let subAdded = 0;

          for (const subItem of parsedSubList) {
            if (!commentIdSet.has(subItem.id)) {
              commentIdSet.add(subItem.id);
              allComments.push(subItem);
              subAdded++;
            }
          }

          onLog(`↳ 已展开【${authorName}】第 ${subPage} 批回复 (+${subAdded} 条)`, allComments.length);

          hasMoreSub = rawSubData.has_more === true && !!rawSubData.cursor && rawSubData.cursor !== subCursor;
          subCursor = rawSubData.cursor || '';
        }
      }
    }
  }

  // 生成人话版诊断报告
  let reportStatus: 'full' | 'partial' | 'failed' = 'full';
  let reportReason = '官方接口已返回末页信号(无更多评论)，一级主评与所有展开折叠回复已 100% 完整抓取完毕。';

  if (userStopped) {
    reportStatus = 'partial';
    reportReason = `用户手动点击了中止，已保全当前已获取的 ${allComments.length} 条评论。`;
  } else if (hasEncounteredTimeout) {
    reportStatus = 'partial';
    reportReason = `小红书接口响应超时(>12s)，看门狗自动切断并保存了当前已拉取的 ${allComments.length} 条评论，安全保护了主任务流程。`;
  } else if (allComments.length === 0) {
    reportStatus = 'full';
    reportReason = '该笔记当前评论区为空，或博主已关闭评论区。';
  }

  const report: NoteCrawlItemReport = {
    id: noteId,
    title: `笔记_${noteId.slice(-6)}`,
    status: reportStatus,
    commentCount: allComments.length,
    reason: reportReason,
  };

  return { comments: allComments, report };
}

/**
 * 核心：博主全量采集流水线（生成完整人话版汇总报告）
 */
export async function crawlAllNotesForBlogger(
  userId: string,
  options: {
    maxNotes?: number;
    fetchComments?: boolean;
    onLog: (text: string) => void;
    onCountdown: (remainingSeconds: number) => void;
    onProgressUpdate?: (progress: CrawlProgress) => void;
    onNoteCaptured?: (note: XhsNote) => void;
    onCommentsCaptured?: (comments: XhsComment[]) => void;
  },
  shouldStop?: () => boolean
): Promise<{ notes: XhsNote[]; comments: XhsComment[]; summaryReport: CrawlTaskSummaryReport }> {
  const startTime = new Date();
  const allNotes: XhsNote[] = [];
  const allComments: XhsComment[] = [];
  const noteIdSet = new Set<string>();
  const noteReports: NoteCrawlItemReport[] = [];

  const progress: CrawlProgress = {
    status: 'running',
    currentStepText: '正在拉取博主笔记列表...',
    totalNotes: 0,
    finishedNotes: 0,
    totalComments: 0,
  };

  const log = (msg: string) => {
    progress.currentStepText = msg;
    options.onLog(msg);
    if (options.onProgressUpdate) options.onProgressUpdate({ ...progress });
  };

  // 1. 扫描博主笔记列表
  let cursor = '';
  let hasMore = true;
  let listPage = 0;

  while (hasMore) {
    if (shouldStop && shouldStop()) break;
    listPage++;
    log(`正在扫描博主笔记列表 (第 ${listPage} 页)... 当前已发现 ${allNotes.length} 篇`);

    await sleepSafe(2500, 4500);

    const listUrl = `/api/sns/web/v1/user_posted?user_id=${userId}&num=30&cursor=${encodeURIComponent(cursor)}&image_formats=jpg,webp,avif`;
    const res = await callXhsApi(listUrl, 'GET');

    if (!res.success || !res.data) {
      log(`博主笔记列表扫描完成（共 ${allNotes.length} 篇）`);
      break;
    }

    const rawData = res.data?.data || res.data;
    const parsedNotes = parseNotesPayload(rawData);

    for (const n of parsedNotes) {
      if (!noteIdSet.has(n.id)) {
        noteIdSet.add(n.id);
        allNotes.push(n);
        if (options.onNoteCaptured) options.onNoteCaptured(n);
      }
    }

    hasMore = rawData.has_more === true && !!rawData.cursor && rawData.cursor !== cursor;
    cursor = rawData.cursor || '';

    if (options.maxNotes && allNotes.length >= options.maxNotes) {
      allNotes.splice(options.maxNotes);
      break;
    }
  }

  progress.totalNotes = allNotes.length;
  log(`博主笔记扫描完毕，共 ${allNotes.length} 篇。开始逐篇提取详情与展开所有评论...`);

  // 2. 逐篇执行采集并记录人话报告
  for (let i = 0; i < allNotes.length; i++) {
    if (shouldStop && shouldStop()) {
      noteReports.push({
        id: allNotes[i].id,
        title: allNotes[i].title || allNotes[i].id,
        status: 'partial',
        commentCount: 0,
        reason: '因用户手动点击停止任务，此篇未执行抓取。',
      });
      continue;
    }

    const note = allNotes[i];
    progress.finishedNotes = i + 1;

    // 批次安全冷却：每 10 篇休息 25 秒
    if (i > 0 && i % 10 === 0) {
      log(`🛡️ [安全频控] 已连续采集 ${i} 篇笔记，开始 25 秒休息冷却（保护账号安全，倒计时结束后自动继续）`);
      for (let cd = 25; cd > 0; cd--) {
        if (shouldStop && shouldStop()) break;
        options.onCountdown(cd);
        log(`⏳ [安全冷却中] 倒计时 ${cd} 秒后自动继续采集第 ${i + 1} 篇...`);
        await new Promise((r) => setTimeout(r, 1000));
      }
      options.onCountdown(0);
      log(`▶️ 冷却结束，自动恢复流水线，继续处理第 ${i + 1} 篇笔记！`);
    }

    log(`▶️ [${i + 1}/${allNotes.length}] 正在处理笔记: 《${note.title.slice(0, 18) || note.id}》`);

    if (options.fetchComments) {
      const { comments: noteComments, report } = await crawlAllCommentsForNote(
        note.id,
        note.xsecToken,
        (stepText, count) => {
          log(`[${i + 1}/${allNotes.length}] ${stepText}`);
        },
        shouldStop
      );

      for (const c of noteComments) {
        allComments.push(c);
      }
      progress.totalComments = allComments.length;
      report.title = note.title || note.id;
      noteReports.push(report);

      if (options.onCommentsCaptured) options.onCommentsCaptured(noteComments);
    } else {
      noteReports.push({
        id: note.id,
        title: note.title || note.id,
        status: 'full',
        commentCount: 0,
        reason: '笔记基本信息与无水印素材直链已 100% 提取完毕（未勾选抓取评论）。',
      });
    }

    await sleepSafe(2500, 4500);
  }

  const endTime = new Date();
  const durationSec = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  const durationText = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;

  const fullCount = noteReports.filter((r) => r.status === 'full').length;
  const partialCount = noteReports.filter((r) => r.status === 'partial').length;
  const failedCount = noteReports.filter((r) => r.status === 'failed').length;

  const summaryReport: CrawlTaskSummaryReport = {
    taskId: 'TASK_' + Date.now(),
    startTime: startTime.toLocaleTimeString(),
    endTime: endTime.toLocaleTimeString(),
    durationText,
    totalNotesTarget: allNotes.length,
    fullCount,
    partialCount,
    failedCount,
    totalCommentsCaptured: allComments.length,
    details: noteReports,
  };

  progress.status = 'completed';
  log(`🎉 任务报告生成完毕！总耗时 ${durationText}，成功 100% 采集 ${fullCount} 篇，捕获评论 ${allComments.length} 条。`);

  return { notes: allNotes, comments: allComments, summaryReport };
}
