export interface XhsAuthor {
  id: string;
  name: string;
  avatar: string;
}

export interface XhsInteractInfo {
  likedCount: number;
  collectedCount: number;
  commentCount: number;
  shareCount: number;
}

export interface XhsNote {
  id: string;
  xsecToken: string;
  title: string;
  desc: string;
  type: 'normal' | 'video';
  author: XhsAuthor;
  interactInfo: XhsInteractInfo;
  tagList: string[];
  ipLocation: string;
  time: number;
  dateStr: string;
  images: string[];
  videoUrl?: string;
  url: string;
}

export interface XhsComment {
  id: string;
  noteId: string;
  level: 1 | 2; // 1: 一级主评论, 2: 二级子回复
  rootCommentId?: string;
  targetUser?: {
    id: string;
    name: string;
  };
  content: string;
  author: XhsAuthor;
  likeCount: number;
  subCommentCount: number;
  ipLocation: string;
  createTime: number;
  dateStr: string;
}

export type SniffedDataType = 'notes' | 'comments' | 'search';

export interface SniffMessage {
  type: 'XHS_DATA_CAPTURED';
  sourceUrl: string;
  category: SniffedDataType;
  data: any;
}

export interface CrawlProgress {
  status: 'idle' | 'running' | 'paused' | 'waiting_captcha' | 'completed' | 'error';
  currentStepText: string;
  totalNotes: number;
  finishedNotes: number;
  totalComments: number;
  errorMsg?: string;
}

export interface NoteCrawlItemReport {
  id: string;
  title: string;
  status: 'full' | 'partial' | 'failed';
  commentCount: number;
  reason: string; // 人话解释
  errorCode?: number | string;
}

export interface CrawlTaskSummaryReport {
  taskId: string;
  startTime: string;
  endTime: string;
  durationText: string;
  totalNotesTarget: number;
  fullCount: number;
  partialCount: number;
  failedCount: number;
  totalCommentsCaptured: number;
  details: NoteCrawlItemReport[];
}

export interface DiagnosticLog {
  timestamp: string;
  type: 'INFO' | 'WARN' | 'ERROR' | 'NET_INTERCEPT' | 'RPC_REQ' | 'RPC_RES';
  message: string;
  detail?: any;
}

/**
 * 小红书标准化底层异常枚举
 */
export enum XhsErrorCode {
  SUCCESS = 0,
  IP_BLOCK = 300012, // IP 被封禁/网络异常
  SECURITY_LIMIT = 300011, // 账号触发安全限制/风控拦截
  NOTE_NOT_FOUND = -510000, // 笔记已被博主删除
  NOTE_ABNORMAL = -510001, // 笔记状态异常/审核中/仅自己可见
  CAPTCHA_REQUIRED = 461, // 触发滑块验证码
  TIMEOUT = 408, // 请求超时熔断
  RATE_LIMIT = 429, // 频控限流
}
