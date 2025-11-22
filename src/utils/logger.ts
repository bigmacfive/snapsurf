// 로깅 유틸리티

export type LogLevel = 'info' | 'success' | 'error' | 'warning';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
}

export class Logger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 500;

  constructor(maxLogs: number = 500) {
    this.maxLogs = maxLogs;
  }

  private addLog(level: LogLevel, message: string): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message
    };

    this.logs.push(entry);

    // 로그 개수 제한
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    return entry;
  }

  info(message: string): LogEntry {
    return this.addLog('info', message);
  }

  success(message: string): LogEntry {
    return this.addLog('success', `✅ ${message}`);
  }

  error(message: string): LogEntry {
    return this.addLog('error', `❌ ${message}`);
  }

  warning(message: string): LogEntry {
    return this.addLog('warning', `⚠️ ${message}`);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getFormattedLogs(): string[] {
    return this.logs.map(log =>
      `[${log.timestamp.toLocaleTimeString()}] ${log.message}`
    );
  }

  clear(): void {
    this.logs = [];
  }
}

// 기본 로거 인스턴스
export const defaultLogger = new Logger();
