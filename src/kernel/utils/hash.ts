import crypto from "node:crypto";

export async function sha256(content: string): Promise<string> {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function sha256Sync(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}
