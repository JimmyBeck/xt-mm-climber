import { XhsErrorCode } from '../types';

/**
 * 拟人化安全延时调度器（正态分布随机抖动）
 */
export function sleepSafe(minMs = 2500, maxMs = 4500): Promise<void> {
  const randomDelay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, randomDelay));
}

export interface ErrorClassificationResult {
  errorCode: XhsErrorCode;
  action: 'continue' | 'pause_cooldown' | 'pause_captcha' | 'abort';
  cooldownSeconds?: number;
  userMessage: string;
  isFatal: boolean;
}

/**
 * 核心：小红书底层异常错误码标准化分类与自愈调度器
 */
export function classifyXhsError(status: number, responseData?: any): ErrorClassificationResult {
  const code = responseData?.code !== undefined ? Number(responseData.code) : status;

  // 1. IP 频控封锁
  if (code === XhsErrorCode.IP_BLOCK || status === 429) {
    return {
      errorCode: XhsErrorCode.IP_BLOCK,
      action: 'pause_cooldown',
      cooldownSeconds: 60,
      userMessage: '当前网络触发小红书频控保护，看门狗已自动暂停 60 秒等待解封...',
      isFatal: false,
    };
  }

  // 2. 账号主体安全限制
  if (code === XhsErrorCode.SECURITY_LIMIT) {
    return {
      errorCode: XhsErrorCode.SECURITY_LIMIT,
      action: 'abort',
      userMessage: '账号触发小红书安全保护限制，任务已自动终止并保全已有数据，建议稍后再试。',
      isFatal: true,
    };
  }

  // 3. 触发滑块验证
  if (status === 461 || status === 471 || code === XhsErrorCode.CAPTCHA_REQUIRED) {
    return {
      errorCode: XhsErrorCode.CAPTCHA_REQUIRED,
      action: 'pause_captcha',
      userMessage: '小红书下发了安全验证码，请在网页上完成滑块，完成后自动恢复。',
      isFatal: false,
    };
  }

  // 4. 单篇笔记被删除 (404)
  if (code === XhsErrorCode.NOTE_NOT_FOUND || status === 404) {
    return {
      errorCode: XhsErrorCode.NOTE_NOT_FOUND,
      action: 'continue',
      userMessage: '该笔记已被博主删除或下架(404)，已自动跳过并记录。',
      isFatal: false,
    };
  }

  // 5. 单篇笔记审核中或仅自己可见
  if (code === XhsErrorCode.NOTE_ABNORMAL) {
    return {
      errorCode: XhsErrorCode.NOTE_ABNORMAL,
      action: 'continue',
      userMessage: '笔记处于审核中或被博主设为仅自己可见，已自动跳过。',
      isFatal: false,
    };
  }

  // 6. 看门狗超时 (12s)
  if (status === 408) {
    return {
      errorCode: XhsErrorCode.TIMEOUT,
      action: 'continue',
      userMessage: '单次请求超时(>12s)，看门狗已自动切断并保全数据，跳过当前项。',
      isFatal: false,
    };
  }

  // 7. 通用未知异常
  return {
    errorCode: status as any,
    action: 'continue',
    userMessage: `接口返回状态异常 (HTTP ${status} / Code ${code})，已自动容错处理。`,
    isFatal: false,
  };
}
