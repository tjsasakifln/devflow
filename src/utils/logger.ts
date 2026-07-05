type LogLevel = "debug" | "info" | "warn" | "error";

let logLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  logLevel = level;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[logLevel];
}

export function debug(msg: string, ...args: unknown[]): void {
  if (shouldLog("debug")) {
    console.debug(`[DEBUG] ${msg}`, ...args);
  }
}

export function info(msg: string, ...args: unknown[]): void {
  if (shouldLog("info")) {
    console.info(`[INFO] ${msg}`, ...args);
  }
}

export function warn(msg: string, ...args: unknown[]): void {
  if (shouldLog("warn")) {
    console.warn(`[WARN] ${msg}`, ...args);
  }
}

export function error(msg: string, ...args: unknown[]): void {
  if (shouldLog("error")) {
    console.error(`[ERROR] ${msg}`, ...args);
  }
}

export const logger = { debug, info, warn, error, setLogLevel };
