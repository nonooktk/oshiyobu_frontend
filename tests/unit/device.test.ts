// 端末の番号（設計 D-10・I-103・I-131）
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidDeviceId } from '../../src/core';
import { STORAGE_KEYS, forgetDeviceIdForTest, getDeviceId } from '../../src/shared/device';

describe('端末の番号', () => {
  beforeEach(() => {
    localStorage.clear();
    forgetDeviceIdForTest();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('API が受ける形（16〜64 文字の英数字と - _）の乱数で、localStorage に 1 つだけ残す', () => {
    const id = getDeviceId();
    expect(isValidDeviceId(id)).toBe(true);
    expect(Object.keys(localStorage)).toEqual([...STORAGE_KEYS]);
    expect(localStorage.getItem(STORAGE_KEYS[0])).toBe(id);
  });

  it('再読み込み（メモリを忘れる）をしても、同じ番号', () => {
    const first = getDeviceId();
    forgetDeviceIdForTest();
    expect(getDeviceId()).toBe(first);
  });

  it('端末ごとに違う番号（別の端末として数えられる）', () => {
    const first = getDeviceId();
    localStorage.clear();
    forgetDeviceIdForTest();
    expect(getDeviceId()).not.toBe(first);
  });

  it('localStorage が使えなくても、そのページの間は同じ番号で動く', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('使えません');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('使えません');
    });
    const id = getDeviceId();
    expect(isValidDeviceId(id)).toBe(true);
    expect(getDeviceId()).toBe(id);
  });

  it('crypto.randomUUID が無い環境（http の LAN）では、getRandomValues で 32 桁の 16 進数を作る', () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.forEach((_, index) => {
        bytes[index] = index * 7;
      });
      return bytes;
    });
    vi.stubGlobal('crypto', { getRandomValues });
    const id = getDeviceId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(isValidDeviceId(id)).toBe(true);
    expect(getRandomValues).toHaveBeenCalledTimes(1);
  });

  it('壊れた保存値は使わず、作り直す', () => {
    localStorage.setItem(STORAGE_KEYS[0], 'short');
    const id = getDeviceId();
    expect(id).not.toBe('short');
    expect(isValidDeviceId(id)).toBe(true);
  });
});
