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
