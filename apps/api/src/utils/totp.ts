import { authenticator } from "otplib";
import * as QRCode from "qrcode";

export function generateMfaSecret(email: string, appName: string = "csERP") {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(email, appName, secret);
  return { secret, otpauth };
}

export async function generateQrCodeDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl);
}

export function verifyMfaToken(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret });
}
