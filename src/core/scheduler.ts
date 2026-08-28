/**
 * 账号安全调度器与频控核心
 */

export interface SchedulerOptions {
  minDelayMs: number; // 最小延时（默认 2500ms）
  maxDelayMs: number; // 最大延时（默认 4500ms）
  maxBatchSize: number; // 单批次最大数量上限
}

export const DEFAULT_SCHEDULER_OPTIONS: SchedulerOptions = {
  minDelayMs: 2500,
  maxDelayMs: 4500,
  maxBatchSize: 50,
};

/**
 * 随机延时（产生带正态波动的安全延时间隔，模拟人类行为）
 */
export function sleepSafe(min = 2500, max = 4500): Promise<number> {
  const delay = Math.floor(min + Math.random() * (max - min));
  return new Promise((resolve) => setTimeout(() => resolve(delay), delay));
}

/**
 * 风控状态检测
 */
export function checkRiskResponse(status: number, responseBody?: any): { hasRisk: boolean; reason?: string } {
  if (status === 406) {
    return { hasRisk: true, reason: '触发小红书 406 频控拦截，请暂停并手动浏览页面' };
  }
  if (status === 302) {
    return { hasRisk: true, reason: '触发登录或重定向验证' };
  }
  if (responseBody && typeof responseBody === 'object') {
    if (responseBody.code === -100 || responseBody.code === 300015 || responseBody.success === false && responseBody.msg?.includes('频繁')) {
      return { hasRisk: true, reason: responseBody.msg || '触发小红书访问频繁警告' };
    }
  }
  return { hasRisk: false };
}
