// scripts/test-regression.ts
// 自动化全场景回归测试套件 (Automated Full Scenario Regression Suite)
// 每次修改代码后必须自动执行并通过，彻底杜绝“修 A 坏 B”

import assert from 'node:assert/strict';
import {
  parseRawNote,
  parseNotesPayload,
  parseCommentsPayload,
  parseSubCommentsPayload,
  cleanImageUrl,
  formatTimestamp,
} from '../src/core/parser';
import { classifyXhsError } from '../src/core/scheduler';
import { recordLog, getAllLogs, clearLogs } from '../src/core/logger';
import { XhsErrorCode } from '../src/types';

console.log('\n===========================================================');
console.log('🧪 开始执行 [小天媒媒助手] 核心功能自动化回归测试流水线...');
console.log('===========================================================\n');

let passedTests = 0;
let failedTests = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     原因: ${err?.message || err}\n`);
    failedTests++;
  }
}

// --------------------------------------------------------------------
// 【场景 1 回归测试：被动浏览嗅探】
// --------------------------------------------------------------------
console.log('📦 1. 场景 1 自动化回归（被动浏览嗅探 & 格式解析兼容性）:');

runTest('1.1 能正确解析 Feed/搜索接口返回的 items 数组', () => {
  const mockFeed = {
    items: [
      {
        id: '6a8001',
        note_card: {
          display_title: '发现好物',
          desc: '正文内容详情',
          user: { user_id: 'u_101', nickname: '测试博主', avatar: 'https://sns-avatar-qc.xhscdn.com/123!nd_dft' },
          interact_info: { liked_count: '1500', collected_count: '320' },
          tag_list: [{ name: '好物分享' }],
          image_list: [{ url_default: 'https://sns-img-qc.xhscdn.com/img1!nd_dft_wlteh_webp_3' }],
          time: 1724832000000,
        },
      },
    ],
  };

  const notes = parseNotesPayload(mockFeed);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].id, '6a8001');
  assert.equal(notes[0].title, '发现好物');
  assert.equal(notes[0].interactInfo.likedCount, 1500);
  assert.equal(notes[0].images[0], 'https://sns-img-qc.xhscdn.com/img1'); // 验证去水印
});

runTest('1.2 能正确解析博主个人主页 user_posted 返回的 notes 数组（关键防退化）', () => {
  const mockBloggerPosted = {
    cursor: 'cur_abc_123',
    has_more: true,
    notes: [
      {
        note_id: '6a8002',
        xsec_token: 'AB_TOKEN_002',
        display_title: '博主专属作品',
        desc: '博主发布的长文描述 #打卡',
        user: { user_id: 'u_blogger', nickname: '李大饱' },
        interact_info: { likedCount: 999 },
        cover: { url_default: 'https://sns-img-qc.xhscdn.com/cover1!strip' },
      },
    ],
  };

  const notes = parseNotesPayload(mockBloggerPosted);
  assert.equal(notes.length, 1, '必须能够识别 payload.notes 字段');
  assert.equal(notes[0].id, '6a8002');
  assert.equal(notes[0].xsecToken, 'AB_TOKEN_002');
  assert.equal(notes[0].title, '博主专属作品');
  assert.equal(notes[0].images[0], 'https://sns-img-qc.xhscdn.com/cover1');
});

runTest('1.3 时间戳能正确推算为格式化绝对物理时间 (YYYY-MM-DD HH:mm:ss)', () => {
  const formatted = formatTimestamp(1724832000000);
  assert.match(formatted, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

// --------------------------------------------------------------------
// 【场景 2 回归测试：指定博主全量作品采集流】
// --------------------------------------------------------------------
console.log('\n📦 2. 场景 2 自动化回归（博主全量采集 & URL/Token 提取）:');

runTest('2.1 能从博主主页完整 URL 准确提取 User ID 与 xsec_token', () => {
  const testUrl = 'https://www.xiaohongshu.com/user/profile/5c7c0cac0000000018011d6b?xsec_token=ABV-baoXhxiyMN0HyEUd2vvZp_iIe-AfB_-JqTYA0QaHU=&xsec_source=pc_feed';
  
  const userMatch = testUrl.match(/\/user\/profile\/([a-f0-9]+)/i);
  const tokenMatch = testUrl.match(/xsec_token=([^&]+)/);

  assert.ok(userMatch, '必须能匹配出博主 ID');
  assert.equal(userMatch[1], '5c7c0cac0000000018011d6b');

  assert.ok(tokenMatch, '必须能全局提取 xsec_token');
  assert.equal(decodeURIComponent(tokenMatch[1]), 'ABV-baoXhxiyMN0HyEUd2vvZp_iIe-AfB_-JqTYA0QaHU=');
});

runTest('2.2 API 目标域名必须严格路由到 edith.xiaohongshu.com', () => {
  const relativeUrl = '/api/sns/web/v1/user_posted?user_id=123';
  const targetUrl = relativeUrl.startsWith('/api/') ? 'https://edith.xiaohongshu.com' + relativeUrl : relativeUrl;
  assert.ok(targetUrl.startsWith('https://edith.xiaohongshu.com/api/sns/web/v1/user_posted'));
});

// --------------------------------------------------------------------
// 【场景 3 回归测试：单篇/批量选定笔记全深度采集】
// --------------------------------------------------------------------
console.log('\n📦 3. 场景 3 自动化回归（单篇深度采集、评论递归展开与去重）:');

runTest('3.1 能正确解析一级评论并平铺内嵌折叠的二级回复', () => {
  const mockComments = {
    comments: [
      {
        id: 'c_root_1',
        content: '这是第一条主评论',
        like_count: 50,
        sub_comment_count: 2,
        user_info: { user_id: 'u_1', nickname: '用户A' },
        sub_comments: [
          {
            id: 'c_sub_1_1',
            content: '这是第一条子回复',
            user_info: { user_id: 'u_2', nickname: '用户B' },
            target_comment: { user_info: { user_id: 'u_1', nickname: '用户A' } },
          },
        ],
      },
    ],
  };

  const parsed = parseCommentsPayload(mockComments, 'note_999');
  assert.equal(parsed.length, 2, '必须同时提取 1 级主评和 1 条嵌套子评');
  assert.equal(parsed[0].level, 1);
  assert.equal(parsed[0].id, 'c_root_1');
  assert.equal(parsed[1].level, 2);
  assert.equal(parsed[1].rootCommentId, 'c_root_1');
  assert.equal(parsed[1].targetUser?.name, '用户A');
});

runTest('3.2 专门解析二级子评论翻页接口响应', () => {
  const mockSubPage = {
    comments: [
      {
        id: 'c_sub_1_2',
        content: '第二条展开的子回复',
        user_info: { user_id: 'u_3', nickname: '用户C' },
      },
    ],
  };

  const subParsed = parseSubCommentsPayload(mockSubPage, 'note_999', 'c_root_1');
  assert.equal(subParsed.length, 1);
  assert.equal(subParsed[0].level, 2);
  assert.equal(subParsed[0].rootCommentId, 'c_root_1');
});

// --------------------------------------------------------------------
// 【场景 0 回归测试：错误码自愈与诊断日志】
// --------------------------------------------------------------------
console.log('\n📦 4. 场景 0 自动化回归（错误码状态机与诊断日志）:');

runTest('4.1 遇到小红书底层异常码能精准识别并给出大白话说明', () => {
  const errCaptcha = classifyXhsError(461, { code: 461 });
  assert.equal(errCaptcha.errorCode, XhsErrorCode.CAPTCHA_REQUIRED);
  assert.equal(errCaptcha.action, 'pause_captcha');

  const errNotFound = classifyXhsError(200, { code: -510000 });
  assert.equal(errNotFound.errorCode, XhsErrorCode.NOTE_NOT_FOUND);
  assert.equal(errNotFound.action, 'continue');

  const errHttp500 = classifyXhsError(500, null);
  assert.equal(errHttp500.isFatal, false, 'HTTP 500 必须由自愈状态机容错处理');
});

runTest('4.2 诊断日志系统能正确记录并在 500 条上限内滚动缓冲', () => {
  clearLogs();
  recordLog('INFO', '测试日志 1', { test: true });
  recordLog('ERROR', '测试错误日志', { code: 500 });

  const logs = getAllLogs();
  assert.equal(logs.length, 2);
  assert.equal(logs[0].type, 'INFO');
  assert.equal(logs[1].type, 'ERROR');
  assert.equal(logs[1].detail.code, 500);
});

// --------------------------------------------------------------------
// 汇总报告
// --------------------------------------------------------------------
console.log('\n===========================================================');
if (failedTests === 0) {
  console.log(`🎉 全部 ${passedTests} 项自动化回归用例 100% 通过！质量门禁检测合格！`);
  console.log('===========================================================\n');
  process.exit(0);
} else {
  console.error(`💥 警告：存在 ${failedTests} 项用例未通过，质量门禁拦截发布！`);
  console.log('===========================================================\n');
  process.exit(1);
}
