// ---------------------------------------------------------------------------
// AIOX Unified Logging Abstraction
// ---------------------------------------------------------------------------
export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFormat = "text" | "json";
export interface LoggerOptions {
  level?: LogLevel; format?: LogFormat; quiet?: boolean;
  timestamps?: boolean; source?: boolean;
}
const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const LEVEL_LABELS: Record<LogLevel, string> = { debug: "DEBUG", info: "INFO", warn: "WARN", error: "ERROR" };
function getTimestamp(): string { return new Date().toISOString(); }
function getCallerSource(): string {
  try {
    const err = new Error(); const stack = err.stack?.split("\n");
    if (!stack) return "";
    for (const line of stack) {
      if (/\/logger\.ts:/.test(line) || /logger\.ts\)/.test(line)) continue;
      if (line.startsWith("Error") || line.includes("node:internal")) continue;
      if (line.includes("[eval]")) continue;
      const m = line.match(/\((.*?):(\d+):\d+\)/);
      if (m) return `${m[1]}:${m[2]}`;
      const m2 = line.match(/at (.*?):(\d+):\d+/);
      if (m2) return `${m2[1]}:${m2[2]}`;
    }
    return "";
  } catch { return ""; }
}
function readEnvConfig(): Partial<LoggerOptions> {
  const o: Partial<LoggerOptions> = {};
  const lvl = process.env["LOG_LEVEL"]?.toLowerCase();
  if (lvl && ["debug","info","warn","error"].includes(lvl)) o.level = lvl as LogLevel;
  if (process.env["LOG_FORMAT"]?.toLowerCase() === "json") o.format = "json";
  const q = process.env["LOG_QUIET"]?.toLowerCase();
  if (q === "true" || q === "1" || q === "yes") o.quiet = true;
  const t = process.env["LOG_TIMESTAMPS"]?.toLowerCase();
  if (t === "true" || t === "1" || t === "yes") o.timestamps = true;
  const s = process.env["LOG_SOURCE"]?.toLowerCase();
  if (s === "true" || s === "1" || s === "yes") o.source = true;
  return o;
}
class Logger {
  private level: LogLevel; private format: LogFormat; private quiet: boolean;
  private timestamps: boolean; private source: boolean;
  constructor(opts?: LoggerOptions) {
    const env = readEnvConfig();
    this.level = opts?.level ?? env.level ?? "info";
    this.format = opts?.format ?? env.format ?? "text";
    this.quiet = opts?.quiet ?? env.quiet ?? false;
    this.timestamps = opts?.timestamps ?? env.timestamps ?? false;
    this.source = opts?.source ?? env.source ?? false;
  }
  setLogLevel(l: LogLevel): void { this.level = l; }
  setFormat(f: LogFormat): void { this.format = f; }
  setQuiet(q: boolean): void { this.quiet = q; }
  configure(o: Partial<LoggerOptions>): void {
    if (o.level !== undefined) this.level = o.level;
    if (o.format !== undefined) this.format = o.format;
    if (o.quiet !== undefined) this.quiet = o.quiet;
    if (o.timestamps !== undefined) this.timestamps = o.timestamps;
    if (o.source !== undefined) this.source = o.source;
  }
  getLevel(): LogLevel { return this.level; }
  getFormat(): LogFormat { return this.format; }
  isQuiet(): boolean { return this.quiet; }
  debug(msg: string, ...args: unknown[]): void { if (!this.shouldLog("debug")) return; this.emit("debug", msg, args); }
  info(msg: string, ...args: unknown[]): void { if (!this.shouldLog("info")) return; this.emit("info", msg, args); }
  warn(msg: string, ...args: unknown[]): void { if (!this.shouldLog("warn")) return; this.emit("warn", msg, args); }
  error(msg: string, ...args: unknown[]): void { if (!this.shouldLog("error")) return; this.emit("error", msg, args); }
  log(msg: string, ...args: unknown[]): void { if (!this.quiet) console.log(msg, ...args); }
  logError(msg: string, ...args: unknown[]): void { console.error(msg, ...args); }
  private shouldLog(l: LogLevel): boolean {
    if (this.quiet && l !== "error") return false;
    return LEVEL_PRIORITY[l] >= LEVEL_PRIORITY[this.level];
  }
  private emit(l: LogLevel, msg: string, args: unknown[]): void {
    if (this.format === "json") this.emitJson(l, msg, args);
    else this.emitText(l, msg, args);
  }
  private emitText(l: LogLevel, msg: string, args: unknown[]): void {
    const parts = [`[${LEVEL_LABELS[l]}]`];
    if (this.timestamps) parts.push(getTimestamp());
    if (this.source) { const s = getCallerSource(); if (s) parts.push(`(${s})`); }
    const prefix = parts.join(" ");
    const ca = args.length > 0 ? [`${prefix} ${msg}`, ...args] : [`${prefix} ${msg}`];
    switch (l) {
      case "debug": console.debug(...ca); break;
      case "info":  console.info(...ca); break;
      case "warn":  console.warn(...ca); break;
      case "error": console.error(...ca); break;
    }
  }
  private emitJson(l: LogLevel, msg: string, args: unknown[]): void {
    const entry: Record<string, unknown> = { level: l, msg, timestamp: getTimestamp() };
    if (this.source) { const s = getCallerSource(); if (s) entry.source = s; }
    if (args.length > 0) entry.args = args.map(String);
    console.error(JSON.stringify(entry));
  }
}
const defaultLogger = new Logger();
export function setLogLevel(l: LogLevel): void { defaultLogger.setLogLevel(l); }
export function debug(msg: string, ...args: unknown[]): void { defaultLogger.debug(msg, ...args); }
export function info(msg: string, ...args: unknown[]): void { defaultLogger.info(msg, ...args); }
export function warn(msg: string, ...args: unknown[]): void { defaultLogger.warn(msg, ...args); }
export function error(msg: string, ...args: unknown[]): void { defaultLogger.error(msg, ...args); }
export function log(msg: string, ...args: unknown[]): void { defaultLogger.log(msg, ...args); }
export function logError(msg: string, ...args: unknown[]): void { defaultLogger.logError(msg, ...args); }
export function configure(o: Partial<LoggerOptions>): void { defaultLogger.configure(o); }
export { Logger }; export const logger = defaultLogger;
