import type { DiagnosticLog } from '../types';

/**
 * 诊断日志环形缓冲区（最多保留 500 条）
 */
const MAX_LOG_SIZE = 500;
const logBuffer: DiagnosticLog[] = [];

export function recordLog(
  type: 'INFO' | 'WARN' | 'ERROR' | 'NET_INTERCEPT' | 'RPC_REQ' | 'RPC_RES',
  message: string,
  detail?: any
): void {
  const timestamp = new Date().toISOString();
  const logItem: DiagnosticLog = {
    timestamp,
    type,
    message,
    detail: detail ? (typeof detail === 'object' ? JSON.parse(JSON.stringify(detail)) : detail) : undefined,
  };

  logBuffer.push(logItem);
  if (logBuffer.length > MAX_LOG_SIZE) {
    logBuffer.shift();
  }

  // 同时打印到 DevTools Console 方便排查
  const consolePrefix = `[XT-LOG ${logItem.timestamp.slice(11, 19)}] [${type}]`;
  if (type === 'ERROR') {
    console.error(consolePrefix, message, detail || '');
  } else if (type === 'WARN') {
    console.warn(consolePrefix, message, detail || '');
  } else {
    console.log(consolePrefix, message, detail || '');
  }
}

export function getAllLogs(): DiagnosticLog[] {
  return [...logBuffer];
}

export function clearLogs(): void {
  logBuffer.length = 0;
}

export function downloadLogsAsJson(): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logBuffer, null, 2));
  const downloadAnchor = document.createElement('a');
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `小天媒媒助手_排错日志_${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export async function copyLogsToClipboard(): Promise<boolean> {
  try {
    const text = JSON.stringify(logBuffer, null, 2);
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    console.error('复制日志失败:', e);
    return false;
  }
}
