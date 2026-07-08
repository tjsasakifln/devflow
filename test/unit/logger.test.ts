import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, setLogLevel, debug, info, warn, error } from "../../src/kernel/utils/logger.js";

describe("Logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    setLogLevel("info");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("info logs when level is info", () => {
    info("test message");
    expect(console.info).toHaveBeenCalledWith("[INFO] test message");
  });

  it("info logs with args", () => {
    info("value: %s", "x");
    expect(console.info).toHaveBeenCalledWith("[INFO] value: %s", "x");
  });

  it("warn logs when level is info", () => {
    warn("warning");
    expect(console.warn).toHaveBeenCalledWith("[WARN] warning");
  });

  it("error logs when level is info", () => {
    error("error msg");
    expect(console.error).toHaveBeenCalledWith("[ERROR] error msg");
  });

  it("debug does not log at info level", () => {
    debug("debug msg");
    expect(console.debug).not.toHaveBeenCalled();
  });

  it("debug logs when level is debug", () => {
    setLogLevel("debug");
    debug("debug msg");
    expect(console.debug).toHaveBeenCalledWith("[DEBUG] debug msg");
  });

  it("error logs at debug level", () => {
    setLogLevel("debug");
    error("err");
    expect(console.error).toHaveBeenCalled();
  });

  it("logger object has all methods", () => {
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.setLogLevel).toBe("function");
  });
});
