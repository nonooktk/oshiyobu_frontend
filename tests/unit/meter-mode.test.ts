// 共有メーターの切り替え（ビルド時の VITE_SHARED_METER）。既定は「ひとり体験」で、ファン向けは API を呼ばない。
// API の接続先（VITE_API_BASE）は、配備で渡されたままでも、既定では使わない。発表者用の画面の接続の確認・リセットは、これまでどおり接続先を使う
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeApi } from '../helpers/fakeApi';

const PID = 'tech0:cbox';
const BASE = 'https://api.example.test';
let api: FakeApi;
let loaded: typeof import('../../src/shared/meter') | null = null;

/** ビルド時の環境変数を差し替えて、共有メーターの入り口を読み込み直す（config.ts は読み込み時に値を決める） */
async function loadMeter(env: Record<string, string>) {
  vi.unstubAllEnvs();
  // 外の環境（VITE_SHARED_METER=on で全部のテストを回したとき）の値を引きずらない。渡さなかった変数は、未設定にする
  vi.stubEnv('VITE_API_BASE', undefined);
  vi.stubEnv('VITE_SHARED_METER', undefined);
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  vi.resetModules();
  loaded = await import('../../src/shared/meter');
  return loaded;
}

describe('共有メーターの切り替え（VITE_SHARED_METER）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    api = new FakeApi();
    vi.stubGlobal('fetch', api.fetch);
  });
  afterEach(() => {
    loaded?.setMeterEngineForTest(null);
    loaded = null;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.resetModules();
  });

  it('既定（VITE_SHARED_METER なし）は、API の接続先があっても、取得も申し込みも送らない', async () => {
    const meter = await loadMeter({ VITE_API_BASE: BASE });
    meter.requestMeterFetch('open', PID);
    meter.joinPerformance(PID);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it('既定では、共有の仕組みは「通信しない」と名乗る（画面が、ひとり体験の動きに切り替える目印）', async () => {
    const meter = await loadMeter({ VITE_API_BASE: BASE });
    expect(meter.isSoloMeter()).toBe(true);
  });

  it.each(['', 'off', 'ON', 'true', '1'])(
    '「%s」は共有にしない（ちょうど on のときだけ共有）',
    async (value) => {
      const meter = await loadMeter({ VITE_API_BASE: BASE, VITE_SHARED_METER: value });
      meter.joinPerformance(PID);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(api.fetch).not.toHaveBeenCalled();
      expect(meter.isSoloMeter()).toBe(true);
    },
  );

  it('VITE_SHARED_METER=on のときだけ、これまでどおり API を呼ぶ（取得と申し込み）', async () => {
    const meter = await loadMeter({ VITE_API_BASE: BASE, VITE_SHARED_METER: 'on' });
    expect(meter.isSoloMeter()).toBe(false);
    meter.requestMeterFetch('open', PID);
    meter.joinPerformance(PID);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(api.gets().length).toBeGreaterThanOrEqual(1);
    expect(api.posts()).toHaveLength(1);
  });

  it('VITE_SHARED_METER=on でも、接続先が無ければ、ひとり体験（通信しない）', async () => {
    const meter = await loadMeter({ VITE_SHARED_METER: 'on' });
    meter.joinPerformance(PID);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(api.fetch).not.toHaveBeenCalled();
    expect(meter.isSoloMeter()).toBe(true);
  });

  it('発表者用の画面は、既定でも接続先を使う（接続の確認・リセット）', async () => {
    const meter = await loadMeter({ VITE_API_BASE: BASE });
    expect(meter.API_CONFIGURED).toBe(true);
    const health = meter.checkApiHealth();
    await vi.advanceTimersByTimeAsync(10);
    expect((await health).ok).toBe(true);
    expect(api.log.some((request) => request.url === `${BASE}/healthz`)).toBe(true);
  });
});
