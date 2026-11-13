import { isValidDeviceId } from '../core';

// 端末の中に残してよいもの（設計 D-10）。操作のあとの localStorage のキーが、この一覧に収まることをテストで確かめる（I-103）
export const STORAGE_KEYS = ['oshiyobu.v1.device'] as const;
const DEVICE_KEY = STORAGE_KEYS[0];

// localStorage が使えないとき（プライベートブラウズなど）のための、メモリの番号
let memoryDeviceId: string | null = null;

/** 端末の番号を作る。個人を特定しない乱数。Math.random は使わない（設計 D-10 の K-23） */
function createDeviceId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  // HTTPS 以外（LAN の http://192.168.x.x など）では randomUUID が無い。16 バイトの乱数を 32 桁の 16 進数にする
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** 端末の番号。再読み込みで変わらない（localStorage）。使えなければ、このページの間だけ同じメモリの番号 */
export function getDeviceId(): string {
  if (memoryDeviceId !== null) {
    return memoryDeviceId;
  }
  try {
    const stored = globalThis.localStorage.getItem(DEVICE_KEY);
    if (isValidDeviceId(stored)) {
      memoryDeviceId = stored;
      return stored;
    }
  } catch {
    // localStorage が使えない。メモリの番号で動く
  }
  const created = createDeviceId();
  memoryDeviceId = created;
  try {
    globalThis.localStorage.setItem(DEVICE_KEY, created);
  } catch {
    // 保存できなくても動く（再読み込みで別の端末として数えられうる限界は、設計 D-10 のとおり受け入れる）
  }
  return created;
}

/** テスト用: メモリの番号を忘れる（再読み込みの代わり） */
export function forgetDeviceIdForTest(): void {
  memoryDeviceId = null;
}
