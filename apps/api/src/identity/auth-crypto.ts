import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SCRYPT_KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const [, salt, expectedHex] = encoded.split("$");
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export interface TokenClaims {
  sub: string;
  sid: string;
  typ: "access" | "refresh";
  exp: number;
}

export function createToken(claims: TokenClaims, secret: string): string {
  const encoded = base64url(JSON.stringify(claims));
  const signature = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyToken(
  token: string,
  secret: string,
  now = Date.now(),
): TokenClaims | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  )
    return null;
  try {
    const claims = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as TokenClaims;
    return claims.exp * 1000 > now &&
      (claims.typ === "access" || claims.typ === "refresh")
      ? claims
      : null;
  } catch {
    return null;
  }
}

export function createRefreshSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHmac("sha256", "creator-pulse-refresh")
    .update(token)
    .digest("hex");
}

function base64url(value: string): string {
  return Buffer.from(value).toString("base64url");
}
