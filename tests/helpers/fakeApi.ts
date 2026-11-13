// 共有メーター API の代わり（テストの中の偽のサーバー。設計 D-13 の応答の形）
import { vi } from 'vitest';

export interface LoggedRequest {
  readonly method: string;
  readonly url: string;
  readonly at: number;
  readonly init: RequestInit;
}

export class FakeApi {
  joined = 0;
  resetAt: string | null = null;
  devices = new Set<string>();
  /** 応答までの時間（ミリ秒） */
  latency = 0;
  /** true なら、通信できない（fetch が失敗する） */
  down = false;
  /** 0 でなければ、その HTTP ステータスを返す */
  status = 0;
  /** true なら、形の違う応答を返す */
  malformed = false;
  log: LoggedRequest[] = [];

  /** fetch の代わり。vi.stubGlobal('fetch', api.fetch) で差し込む */
  fetch = vi.fn(
    (input: string | URL | Request, init: RequestInit = {}) =>
      new Promise<Response>((resolve, reject) => {
        const url = String(input);
        this.log.push({ method: init.method ?? 'GET', url, at: Date.now(), init });
        if (this.down) {
          reject(new TypeError('Failed to fetch'));
          return;
        }
        const timer = setTimeout(() => resolve(this.respond(url, init)), this.latency);
        init.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('打ち切り', 'AbortError'));
        });
      }),
  );

  private respond(url: string, init: RequestInit): Response {
    if (this.status !== 0) {
      return new Response('{}', { status: this.status });
    }
    if (this.malformed) {
      return new Response(JSON.stringify({ hello: 'world' }));
    }
    const pid = /performances\/([^/]+)\/(meter|joins)/.exec(url)?.[1] ?? 'tech0:cbox';
    if (url.endsWith('/reset')) {
      this.reset();
      return new Response(JSON.stringify({ resetAt: this.resetAt }));
    }
    if ((init.method ?? 'GET') === 'POST') {
      const { deviceId } = JSON.parse(String(init.body)) as { deviceId: string };
      const counted = !this.devices.has(deviceId);
      if (counted) {
        this.devices.add(deviceId);
        this.joined += 1;
      }
      return new Response(
        JSON.stringify({ performanceId: pid, joined: this.joined, counted, resetAt: this.resetAt }),
      );
    }
    return new Response(
      JSON.stringify({ performanceId: pid, joined: this.joined, resetAt: this.resetAt }),
    );
  }

  /** 発表者の reset と同じ（人数と端末の番号を空にし、resetAt を新しくする） */
  reset(): void {
    this.joined = 0;
    this.devices.clear();
    this.resetAt = new Date(Date.now() + this.log.length * 1000).toISOString();
  }

  gets(): LoggedRequest[] {
    return this.log.filter((request) => request.method === 'GET');
  }
  posts(): LoggedRequest[] {
    return this.log.filter((request) => request.method === 'POST');
  }
}
