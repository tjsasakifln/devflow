import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, setLogLevel, configure, debug, info, warn, error, log, logError, Logger } from "../../src/kernel/utils/logger.js";
describe("Logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    setLogLevel("info");
    configure({ format: "text", quiet: false, timestamps: false, source: false });
  });
  afterEach(() => { vi.restoreAllMocks(); });
  it("info at info level", () => { info("t"); expect(console.info).toHaveBeenCalledWith("[INFO] t"); });
  it("info with args", () => { info("v: %s","x"); expect(console.info).toHaveBeenCalledWith("[INFO] v: %s","x"); });
  it("warn logs", () => { warn("w"); expect(console.warn).toHaveBeenCalledWith("[WARN] w"); });
  it("error logs", () => { error("e"); expect(console.error).toHaveBeenCalledWith("[ERROR] e"); });
  it("debug suppressed at info", () => { debug("d"); expect(console.debug).not.toHaveBeenCalled(); });
  it("debug at debug level", () => { setLogLevel("debug"); debug("d"); expect(console.debug).toHaveBeenCalledWith("[DEBUG] d"); });
  it("logger has methods", () => {
    expect(typeof logger.debug).toBe("function"); expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function"); expect(typeof logger.error).toBe("function");
    expect(typeof logger.setLogLevel).toBe("function");
  });
  it("log writes to stdout", () => { log("h"); expect(console.log).toHaveBeenCalledWith("h"); });
  it("logError writes to stderr", () => { logError("e"); expect(console.error).toHaveBeenCalledWith("e"); });
  it("log suppressed in quiet", () => { configure({quiet:true}); log("q"); expect(console.log).not.toHaveBeenCalled(); });
  it("logError not suppressed in quiet", () => { configure({quiet:true}); logError("v"); expect(console.error).toHaveBeenCalledWith("v"); });
  it("quiet suppresses info", () => { configure({quiet:true}); info("x"); expect(console.info).not.toHaveBeenCalled(); });
  it("quiet does not suppress error", () => { configure({quiet:true}); error("x"); expect(console.error).toHaveBeenCalled(); });
  it("json format output", () => {
    configure({format:"json"}); info("ji");
    const arg = (console.error).mock.calls[0]?.[0]; const p = JSON.parse(arg);
    expect(p.level).toBe("info"); expect(p.msg).toBe("ji"); expect(typeof p.timestamp).toBe("string");
  });
  it("log raw in json mode", () => { configure({format:"json"}); log("r"); expect(console.log).toHaveBeenCalledWith("r"); });
  it("timestamps", () => {
    configure({timestamps:true}); info("t");
    expect((console.info).mock.calls[0]?.[0]).toMatch(/^\[INFO\] \d{4}-\d{2}-\d{2}T/);
  });
  it("source context", () => {
    configure({source:true}); info("s");
    expect((console.info).mock.calls[0]?.[0]).toMatch(/\(.*\)/);
  });
  it("configure changes level", () => {
    configure({level:"error"}); info("x"); expect(console.info).not.toHaveBeenCalled();
    error("y"); expect(console.error).toHaveBeenCalled();
  });
  it("independent instances", () => {
    const l1 = new Logger({level:"error"}); const l2 = new Logger({level:"debug"});
    l1.info("no"); l2.info("yes"); expect(console.info).toHaveBeenCalledTimes(1);
  });
  it("getters", () => {
    setLogLevel("debug"); expect(logger.getLevel()).toBe("debug");
    configure({format:"json"}); expect(logger.getFormat()).toBe("json");
    configure({quiet:true}); expect(logger.isQuiet()).toBe(true);
  });
});
