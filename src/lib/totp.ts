import { generateSecret, generateSync, verifySync, generateURI } from "otplib";
import qrcode from "qrcode";
import crypto from "crypto";
import bcrypt from "bcryptjs";

export function generateTotpSecret(): string {
  // length is the number of base32 chars; 32 chars ≈ 20 bytes of entropy
  return generateSecret({ length: 32 });
}

export function verifyTotpCode(code: string, secret: string): boolean {
  try {
    const result = verifySync({
      token: code.replace(/\s/g, ""),
      secret,
    });
    return result.valid;
  } catch {
    return false;
  }
}

export function generateOtpAuthUrl(email: string, secret: string): string {
  return generateURI({ label: email, issuer: "MediKlaim MDS", secret });
}

export async function generateQrDataUrl(otpAuthUrl: string): Promise<string> {
  return qrcode.toDataURL(otpAuthUrl, { width: 200, margin: 1 });
}

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: 8 }, () =>
    crypto.randomBytes(5).toString("hex").toUpperCase()
  );
}

export async function hashRecoveryCodes(codes: string[]): Promise<string> {
  const hashed = await Promise.all(codes.map((c) => bcrypt.hash(c, 10)));
  return JSON.stringify(hashed);
}

// Returns updated hashed-codes JSON string if code matches, null if no match
export async function consumeRecoveryCode(
  inputCode: string,
  hashedCodesJson: string
): Promise<string | null> {
  const hashes: string[] = JSON.parse(hashedCodesJson);
  for (let i = 0; i < hashes.length; i++) {
    if (
      await bcrypt.compare(
        inputCode.toUpperCase().replace(/\s/g, ""),
        hashes[i]
      )
    ) {
      const remaining = hashes.filter((_, idx) => idx !== i);
      return JSON.stringify(remaining);
    }
  }
  return null;
}
