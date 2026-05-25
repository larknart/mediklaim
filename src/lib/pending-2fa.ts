import crypto from "crypto";

export function signPending2faToken(userId: string): string {
  const expiry = Date.now() + 5 * 60 * 1000; // 5 min
  const payload = `${userId}:${expiry}`;
  const sig = crypto
    .createHmac("sha256", process.env.AUTH_SECRET!)
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyPending2faToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return null;
    const [userId, expiry, sig] = parts;
    const payload = `${userId}:${expiry}`;
    const expected = crypto
      .createHmac("sha256", process.env.AUTH_SECRET!)
      .update(payload)
      .digest("hex");
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
    if (Date.now() > parseInt(expiry, 10)) return null;
    return userId;
  } catch {
    return null;
  }
}
