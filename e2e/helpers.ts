import type { BrowserContext, Page } from '@playwright/test';

export const API = 'http://127.0.0.1:4391';

/** 弱い回線（Fast 3G 相当: 下り 200,000 バイト/秒・上り 93,750 バイト/秒・遅延 150 ms）と、CPU 4 倍（設計 D-40・SP-93） */
export async function throttle(context: BrowserContext, page: Page): Promise<void> {
  const session = await context.newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 200_000,
    uploadThroughput: 93_750,
  });
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
}

/** 偽の API の動きを変える（遅れ・停止・状態）。API の応答には、試験が決めた値だけを返させる */
export async function control(patch: Record<string, unknown>): Promise<void> {
  await fetch(`${API}/__control`, { method: 'POST', body: JSON.stringify(patch) });
}

export async function apiState(): Promise<{
  joined: Record<string, number>;
  resetAt: string | null;
  log: { method: string; path: string; at: number }[];
}> {
  return (await fetch(`${API}/__state`)).json();
}

/** `oshiyobu:ready` の時刻（ナビゲーション開始からのミリ秒）。打たれるまで待つ。打たれなければ null */
export async function readyTime(page: Page, timeoutMs = 20_000): Promise<number | null> {
  try {
    await page.waitForFunction(
      () => performance.getEntriesByName('oshiyobu:ready').length > 0,
      undefined,
      {
        timeout: timeoutMs,
      },
    );
  } catch {
    return null;
  }
  return page.evaluate(() => performance.getEntriesByName('oshiyobu:ready')[0]!.startTime);
}
