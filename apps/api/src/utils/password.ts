import bcrypt from 'bcrypt';
import { env } from '../config/env.js';

export async function hashPassword(password: string): Promise<string> {
  const rounds = process.env.BCRYPT_SALT_ROUNDS ? parseInt(process.env.BCRYPT_SALT_ROUNDS) : 10;
  return bcrypt.hash(password, rounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
