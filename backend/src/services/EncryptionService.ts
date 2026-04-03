import { AUTH_ENV } from '../config/env';

const ENCRYPTION_KEY = AUTH_ENV.encryptionKey;
const CryptoJS: any = require('crypto-js');

export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
}

export function decrypt(ciphertext: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}
