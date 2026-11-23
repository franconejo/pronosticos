import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Context } from 'hono';
import type { Bindings, User, Variables } from '../types';
import { nowIso } from './time';

const SESSION_COOKIE = 'pronostico_session';
const SESSION_DAYS = 30;

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function pbkdf2(pin: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromHex(saltHex), iterations: 100_000, hash: 'SHA-256' },
    key,
    256,
  );
  return toHex(bits);
}

export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = toHex(salt.buffer);
  const hash = await pbkdf2(pin, saltHex);
  return `pbkdf2$100000$${saltHex}$${hash}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const [, , saltHex, expected] = parts;
  const actual = await pbkdf2(pin, saltHex);
  return actual === expected;
}

export function createId(): string {
  return crypto.randomUUID();
}

export async function createSession(c: Context<{ Bindings: Bindings; Variables: Variables }>, userId: string) {
  const id = createId();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
  )
    .bind(id, userId, expires, nowIso())
    .run();

  setCookie(c, SESSION_COOKIE, id, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    expires: new Date(expires),
  });
}

export async function clearSession(c: Context<{ Bindings: Bindings; Variables: Variables }>) {
  const id = getCookie(c, SESSION_COOKIE);
  if (id) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export async function getCurrentUser(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
): Promise<User | null> {
  const id = getCookie(c, SESSION_COOKIE);
  if (!id) return null;

  const row = await c.env.DB.prepare(
    `SELECT u.* FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ? AND u.active = 1`,
  )
    .bind(id, nowIso())
    .first<User>();

  return row ?? null;
}

export function requireUser(c: Context<{ Bindings: Bindings; Variables: Variables }>): User {
  const user = c.get('user');
  if (!user) throw new Response('No autorizado', { status: 401 });
  return user;
}

export function requireAdmin(c: Context<{ Bindings: Bindings; Variables: Variables }>): User {
  const user = requireUser(c);
  if (user.role !== 'admin') throw new Response('Prohibido', { status: 403 });
  return user;
}
