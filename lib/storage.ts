'use client';

import { DEFAULT_THRESHOLDS, STORAGE_KEY } from '@/lib/constants';
import type { AppSettings } from '@/lib/types';

const SECRET_KEY = 'nisa-support-secret';

async function deriveCryptoKey(secret: string, salt: Uint8Array) {
  const enc = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 120_000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function getOrCreateSecret() {
  let secret = window.localStorage.getItem(SECRET_KEY);
  if (!secret) {
    const random = window.crypto.getRandomValues(new Uint8Array(32));
    secret = btoa(String.fromCharCode(...Array.from(random)));
    window.localStorage.setItem(SECRET_KEY, secret);
  }
  return secret;
}

export async function saveSettings(settings: AppSettings) {
  const secret = getOrCreateSecret();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveCryptoKey(secret, salt);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const payload = new TextEncoder().encode(JSON.stringify(settings));
  const cipher = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload);
  const buffer = new Uint8Array(cipher);
  const packed = new Uint8Array(salt.length + iv.length + buffer.length);
  packed.set(salt, 0);
  packed.set(iv, salt.length);
  packed.set(buffer, salt.length + iv.length);
  const encoded = btoa(String.fromCharCode(...Array.from(packed)));
  window.localStorage.setItem(STORAGE_KEY, encoded);
}

export async function loadSettings(): Promise<AppSettings | null> {
  const encoded = window.localStorage.getItem(STORAGE_KEY);
  if (!encoded) return null;
  try {
    const secret = getOrCreateSecret();
    const packed = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    const salt = packed.slice(0, 16);
    const iv = packed.slice(16, 28);
    const data = packed.slice(28);
    const key = await deriveCryptoKey(secret, salt);
    const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    const decoded = new TextDecoder().decode(decrypted);
    return JSON.parse(decoded) as AppSettings;
  } catch (error) {
    console.error('Failed to decode settings', error);
    return null;
  }
}

export function defaultSettings(): AppSettings {
  return {
    thresholds: DEFAULT_THRESHOLDS,
    mode: 'long',
    theme: 'system',
    acceptedDisclaimer: false
  };
}
