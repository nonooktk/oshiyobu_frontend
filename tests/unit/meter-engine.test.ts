// 共有メーターの取得・申し込み（設計 D-17・D-18・D-41。I-46〜I-66・I-122〜I-126・I-133・I-135 のうち画面側）
// 相手は、テストの中の偽のサーバー（tests/helpers/fakeApi.ts）
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { displayedCount } from '../../src/core';
import {
  FAILURE_MS,
  FLOOR_MS,
  JOIN_RETRY_MS,
  POLL_MS,
  createMeterEngine,
  type MeterEngine,
} from '../../src/shared/meter/engine';
import { FakeApi } from '../helpers/fakeApi';

const PID = 'tech0:cbox';
const BASE = 'https://api.example.test';
const DEVICE = 'device-aaaaaaaaaaaaaaaa';

let api: FakeApi;
let engine: MeterEngine;
let visible = true;
let online = true;

const make = (device = DEVICE, apiBase = BASE) =>
  createMeterEngine({
    apiBase,
    deviceId: () => device,
    random: () => 0.5, // ゆらぎなし（2.0 秒ちょうど）。開いた直後の遅れは 0.5 秒
    isVisible: () => visible,
    isOnline: () => online,
  });
const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

describe('共有メーターの仕組み', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    api = new FakeApi();
    vi.stubGlobal('fetch', api.fetch);
    visible = true;
    online = true;
    engine = make();
  });
  afterEach(() => {
    engine.dispose();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('サーバーなし・止まっているとき（I-46・I-47・I-52）', () => {
    it('接続先が無いとき、通信せず、初期値のまま（状態は offline）', async () => {
      const offline = make(DEVICE, '');
      offline.watch(PID);
      offline.subscribe(PID);
      offline.requestFetch('open');
      offline.join(PID);
      await advance(60_000);
      expect(api.fetch).not.toHaveBeenCalled();
      expect(offline.getSnapshot(PID)).toEqual({
        joined: 0,
        status: 'offline',
        mineCounted: false,
        resetEpoch: 0,
      });
      expect(offline.isBusy()).toBe(false);
      offline.dispose();
    });

    it('通信できなくても、例外を投げず、最後に取れた値のまま（状態は failing）', async () => {
      api.joined = 12;
      engine.subscribe(PID);
      await advance(POLL_MS + 10);
      expect(engine.getSnapshot(PID)).toMatchObject({ joined: 12, status: 'ok' });
      api.down = true;
      await advance(30_000);
      expect(engine.getSnapshot(PID)).toMatchObject({ joined: 12, status: 'failing' });
    });

    it.each([
      ['形の違う応答', { malformed: true }],
      ['HTTP 500', { status: 500 }],
    ])('%s は捨てる（画面の値は変わらない）', async (_name, patch) => {
      Object.assign(api, patch);
      api.joined = 5;
      engine.subscribe(PID);
      await advance(POLL_MS * 3);
      expect(engine.getSnapshot(PID)).toMatchObject({ joined: 0, status: 'failing' });
    });
  });

  describe('要求の形（D-13・D-16）', () => {
    it('GET は独自のヘッダーを付けない。cookie を送らず、キャッシュしない', async () => {
      engine.subscribe(PID);
      await advance(POLL_MS + 10);
      const [get] = api.gets();
      expect(get?.url).toBe(`${BASE}/api/v1/performances/${PID}/meter`);
      expect(get?.init.headers).toBeUndefined();
      expect(get?.init).toMatchObject({ credentials: 'omit', cache: 'no-store' });
    });

    it('申し込みの POST は text/plain で、本文は { deviceId } だけ（事前の問い合わせを無くす）', async () => {
      engine.join(PID);
      await advance(0);
      const [post] = api.posts();
      expect(post?.url).toBe(`${BASE}/api/v1/performances/${PID}/joins`);
      expect(post?.init.headers).toEqual({ 'Content-Type': 'text/plain;charset=UTF-8' });
      expect(JSON.parse(String(post?.init.body))).toEqual({ deviceId: DEVICE });
    });
  });

  describe('取得の間隔（D-17・D-41。I-54・I-58）', () => {
    it('ホーム以降は 2 秒おき。購読をやめたら止まる', async () => {
      const stop = engine.subscribe(PID);
      await advance(POLL_MS * 5 + 10);
      expect(api.gets()).toHaveLength(5);
      stop();
      await advance(60_000);
      expect(api.gets()).toHaveLength(5);
    });

    it('購読が無いとき（はじめの画面の 1/3・2/3）は、2 秒おきには取らない。契機の 1 回だけ', async () => {
      engine.watch(PID);
      engine.requestFetch('open');
      await advance(60_000);
      expect(api.gets()).toHaveLength(1);
    });

    it('失敗が続くと 2 → 4 → 8 → 10 → 10 秒と間隔を空け、成功したら 2 秒に戻る', async () => {
      api.down = true;
      engine.subscribe(PID);
      await advance(60_000);
      const gapsOf = () => {
        const starts = api.gets().map((request) => request.at);
        return starts.slice(1).map((at, i) => Math.round((at - (starts[i] ?? 0)) / 100) * 100);
      };
      expect(gapsOf().slice(0, 5)).toEqual([...FAILURE_MS, 10_000]);
      api.down = false;
      await advance(20_000);
      expect(gapsOf().slice(-3)).toEqual([POLL_MS, POLL_MS, POLL_MS]);
      expect(engine.getSnapshot(PID).status).toBe('ok');
    });

    it('10 分開いたまま、隠す・戻す・切る・戻すを繰り返しても、1 分あたり 34 回以下', async () => {
      engine.subscribe(PID);
      for (let second = 0; second < 600; second += 1) {
        if (second % 7 === 0) {
          visible = false;
          document.dispatchEvent(new Event('visibilitychange'));
        } else if (second % 7 === 1) {
          visible = true;
          document.dispatchEvent(new Event('visibilitychange'));
        }
        if (second % 11 === 0) {
          online = false;
          window.dispatchEvent(new Event('offline'));
        } else if (second % 11 === 1) {
          online = true;
          window.dispatchEvent(new Event('online'));
        }
        await advance(1000);
      }
      const starts = api.gets().map((request) => request.at);
      for (let i = 0; i < starts.length; i += 1) {
        const inMinute = starts.filter(
          (at) => at >= (starts[i] ?? 0) && at < (starts[i] ?? 0) + 60_000,
        );
        expect(inMinute.length).toBeLessThanOrEqual(34);
      }
      // どの取得も、前の取得の開始から 1.8 秒以上あと
      for (let i = 1; i < starts.length; i += 1) {
        expect((starts[i] ?? 0) - (starts[i - 1] ?? 0)).toBeGreaterThanOrEqual(FLOOR_MS);
      }
      expect(starts.length).toBeGreaterThan(100);
    });

    it('隠す・戻すを 0.5 秒ごとに繰り返しても、取得は前の開始から 1.8 秒以上あけ、1 分あたり 34 回以下', async () => {
      engine.subscribe(PID);
      for (let step = 0; step < 360; step += 1) {
        // 0.5 秒ごとに、隠す・戻す（戻すたびに「すぐ 1 回」の要求が出る）
        visible = step % 2 === 1;
        document.dispatchEvent(new Event('visibilitychange'));
        online = step % 3 !== 0;
        window.dispatchEvent(new Event(online ? 'online' : 'offline'));
        await advance(500);
      }
      const starts = api.gets().map((request) => request.at);
      expect(starts.length).toBeGreaterThan(30);
      for (let i = 1; i < starts.length; i += 1) {
        expect((starts[i] ?? 0) - (starts[i - 1] ?? 0)).toBeGreaterThanOrEqual(FLOOR_MS);
      }
      for (const at of starts) {
        expect(
          starts.filter((other) => other >= at && other < at + 60_000).length,
        ).toBeLessThanOrEqual(34);
      }
    });

    it('隠れている間と、回線が切れている間は取らない。戻ったら 1 回すぐ取りに行く', async () => {
      engine.subscribe(PID);
      await advance(POLL_MS + 10);
      visible = false;
      document.dispatchEvent(new Event('visibilitychange'));
      const before = api.gets().length;
      await advance(60_000);
      expect(api.gets()).toHaveLength(before);
      visible = true;
      document.dispatchEvent(new Event('visibilitychange'));
      await advance(0);
      expect(api.gets()).toHaveLength(before + 1);
    });
  });

  describe('取得の契機（D-18 の規則 8。I-122）', () => {
    it('開いた直後は、0〜1 秒の遅れで 1 回。3/3 に入ったとき・公演が変わったときは、すぐ 1 回', async () => {
      engine.watch(PID);
      engine.requestFetch('open');
      await advance(499);
      expect(api.gets()).toHaveLength(0);
      await advance(1);
      expect(api.gets()).toHaveLength(1);
      engine.requestFetch('course-select');
      await advance(FLOOR_MS - 1);
      expect(api.gets()).toHaveLength(1);
      await advance(1);
      expect(api.gets()).toHaveLength(2);
      api.joined = 3;
      engine.requestFetch('performance-changed');
      await advance(FLOOR_MS);
      expect(api.gets()).toHaveLength(3);
      expect(engine.getSnapshot(PID).joined).toBe(3);
    });

    it('G2-04 公演を指定した依頼は、見ている公演ではなく、指定した公演を取る（はじめの画面で選び直した公演）', async () => {
      const OTHER = 'krs48:cbox';
      engine.watch(PID);
      engine.requestFetch('course-select', OTHER);
      await advance(10);
      expect(api.gets().map((request) => request.url)).toEqual([
        `${BASE}/api/v1/performances/${OTHER}/meter`,
      ]);
      api.joined = 7;
      engine.requestFetch('course-select');
      await advance(FLOOR_MS + 10);
      expect(api.gets().at(-1)?.url).toBe(`${BASE}/api/v1/performances/${PID}/meter`); // 指定なしは、従来どおり見ている公演
    });

    it('G2-04 公演を指定した依頼は、見る公演がまだ分からなくても覚えずに取り、その公演の人数を持つ', async () => {
      const OTHER = 'krs48:cbox';
      api.joined = 7;
      engine.requestFetch('course-select', OTHER);
      await advance(10);
      expect(api.gets()).toHaveLength(1);
      expect(engine.getSnapshot(OTHER).joined).toBe(7);
      expect(engine.getSnapshot(PID).joined).toBe(0);
    });

    it('公演が分かる前の依頼は覚えておき、公演が分かったら取る', async () => {
      engine.requestFetch('course-select');
      await advance(5000);
      expect(api.gets()).toHaveLength(0);
      engine.watch(PID);
      await advance(10);
      expect(api.gets()).toHaveLength(1);
    });
  });

  describe('待ち時間（D-17。I-53・I-124）', () => {
    it('応答が 2 秒を過ぎても、8 秒までは待って使う（遅れて届いた応答も使う）', async () => {
      api.latency = 5000;
      api.joined = 40;
      engine.subscribe(PID);
      await advance(POLL_MS + 5000 + 10);
      expect(engine.getSnapshot(PID)).toMatchObject({ joined: 40, status: 'ok' });
    });

    it('8 秒を超えたら打ち切り、失敗として数える', async () => {
      api.latency = 9000;
      api.joined = 40;
      engine.subscribe(PID);
      await advance(POLL_MS + 8000 + 10);
      expect(engine.getSnapshot(PID)).toMatchObject({ joined: 0, status: 'failing' });
    });

    it('前の取得が終わるまで、次を出さない（重ねない）', async () => {
      api.latency = 7000;
      engine.subscribe(PID);
      await advance(30_000);
      const starts = api.gets().map((request) => request.at);
      starts
        .slice(1)
        .forEach((at, i) => expect(at - (starts[i] ?? 0)).toBeGreaterThanOrEqual(7000));
    });
  });

  describe('申し込み（D-17・D-18。I-57・I-135）', () => {
    it('送ると、サーバーの人数に自分の分が入る。counted が false（前に数えられていた）でも、印が付く', async () => {
      api.devices.add(DEVICE);
      api.joined = 1;
      engine.join(PID);
      await advance(0);
      expect(engine.getSnapshot(PID)).toMatchObject({ joined: 1, mineCounted: true });
    });

    it('表示の人数 ＝ 開始人数 + ほかの端末 + 自分。申し込み後に、サーバーの応答で二重に数えない', async () => {
      api.joined = 4;
      engine.watch(PID);
      engine.requestFetch('course-select');
      await advance(10);
      const state = (mine: boolean) => ({
        ...engine.getSnapshot(PID),
        serverJoined: engine.getSnapshot(PID).joined,
        counted: engine.getSnapshot(PID).mineCounted,
        joined: mine,
        pseudoFriends: 0,
      });
      expect(displayedCount(74, state(false))).toBe(78);
      expect(displayedCount(74, state(true))).toBe(79);
      engine.join(PID);
      await advance(10);
      expect(api.joined).toBe(5);
      expect(displayedCount(74, state(true))).toBe(79);
    });

    it('すぐ戻る。同じ公演を続けて送っても、サーバーに送るのは 1 回（冪等）', async () => {
      engine.join(PID);
      engine.join(PID);
      engine.join(PID);
      await advance(0);
      expect(api.posts()).toHaveLength(1);
      engine.join(PID);
      expect(api.posts()).toHaveLength(1);
    });

    it('失敗したら 1・2・4・8・16 秒の間隔で再送し、使い切ったら止める。例外は投げない', async () => {
      api.down = true;
      engine.join(PID);
      await advance(0);
      let elapsed = 0;
      for (const wait of JOIN_RETRY_MS) {
        expect(api.posts()).toHaveLength(JOIN_RETRY_MS.indexOf(wait) + 1);
        await advance(wait - 1);
        expect(api.posts()).toHaveLength(JOIN_RETRY_MS.indexOf(wait) + 1);
        await advance(1);
        elapsed += wait;
      }
      expect(api.posts()).toHaveLength(JOIN_RETRY_MS.length + 1);
      await advance(120_000);
      expect(api.posts()).toHaveLength(JOIN_RETRY_MS.length + 1);
      expect(elapsed).toBe(31_000);
    });

    it('再送を使い切ったあと、次の取得が成功したら、もう一度送る', async () => {
      api.down = true;
      engine.join(PID);
      await advance(40_000);
      expect(api.posts()).toHaveLength(6);
      api.down = false;
      engine.watch(PID);
      engine.requestFetch('course-select');
      await advance(FLOOR_MS + 10);
      expect(api.posts()).toHaveLength(7);
      expect(engine.getSnapshot(PID).mineCounted).toBe(true);
    });
  });

  describe('429・409・長い切断（I-49・I-60）', () => {
    it('429 は、Retry-After を尊重して、間隔を空けて続ける。画面は最後の値のまま', async () => {
      api.joined = 7;
      engine.subscribe(PID);
      await advance(POLL_MS + 10);
      api.status = 429;
      api.retryAfter = '30';
      await advance(POLL_MS + 10);
      const before = api.gets().length;
      await advance(29_000);
      expect(api.gets()).toHaveLength(before);
      await advance(2000);
      expect(api.gets().length).toBe(before + 1);
      expect(engine.getSnapshot(PID).joined).toBe(7);
    });

    it('429 で Retry-After が読めないとき（ブラウザの CORS では公開されない）は、決まった間隔（2 → 4 → 8 → 10 秒）に戻る', async () => {
      api.joined = 4;
      engine.subscribe(PID);
      await advance(POLL_MS + 10);
      const before = api.gets().length;
      api.status = 429; // retryAfter なし
      await advance(40_000);
      const starts = api
        .gets()
        .slice(before)
        .map((request) => request.at);
      const gaps = starts
        .slice(1, 5)
        .map((at, i) => Math.round((at - (starts[i] ?? 0)) / 100) * 100);
      expect(gaps).toEqual([2000, 4000, 8000, 10000]);
      expect(engine.getSnapshot(PID).joined).toBe(4);
    });

    it.each([400, 401, 404, 413, 415, 500, 503])(
      '状態 %i の応答でも、例外を出さず、最後の値のまま（状態は failing）',
      async (status) => {
        api.joined = 6;
        engine.subscribe(PID);
        await advance(POLL_MS + 10);
        api.status = status;
        await advance(30_000);
        expect(engine.getSnapshot(PID)).toMatchObject({ joined: 6, status: 'failing' });
      },
    );

    it('409（上限）の申し込みは、送信済みとして扱い、再送しない', async () => {
      api.status = 409;
      engine.join(PID);
      await advance(60_000);
      expect(api.posts()).toHaveLength(1);
      expect(engine.getSnapshot(PID).mineCounted).toBe(false);
    });

    it('10 分切れていても、要求は約 60 回以内。戻ったあと 10 秒以内に追いつく', async () => {
      api.joined = 2;
      engine.subscribe(PID);
      await advance(POLL_MS + 10);
      api.down = true;
      const offlineFrom = api.log.length;
      await advance(600_000);
      expect(api.log.length - offlineFrom).toBeLessThanOrEqual(65);
      api.down = false;
      api.joined = 9;
      await advance(11_000);
      expect(engine.getSnapshot(PID)).toMatchObject({ joined: 9, status: 'ok' });
    });

    it('サーバーの人数が減っても（再起動）、取得のたびにサーバーの値に従う（5 → 3）', async () => {
      api.joined = 5;
      engine.subscribe(PID);
      await advance(POLL_MS + 10);
      expect(engine.getSnapshot(PID).joined).toBe(5);
      api.joined = 3;
      await advance(POLL_MS + 10);
      expect(engine.getSnapshot(PID).joined).toBe(3);
    });
  });

  describe('reset の検知（D-18 の規則 10。I-126）', () => {
    it('resetAt が変わったら、数えた印を消し、resetEpoch を増やし、登録した動きを呼ぶ', async () => {
      const onReset = vi.fn();
      engine.onReset(onReset);
      api.joined = 3;
      engine.subscribe(PID);
      engine.join(PID);
      await advance(POLL_MS + 10);
      expect(engine.getSnapshot(PID)).toMatchObject({
        mineCounted: true,
        resetEpoch: 0,
        joined: 4,
      });
      api.reset();
      await advance(POLL_MS + 10);
      expect(engine.getSnapshot(PID)).toMatchObject({
        mineCounted: false,
        resetEpoch: 1,
        joined: 0,
      });
      expect(onReset).toHaveBeenCalledTimes(1);
      await advance(POLL_MS * 3);
      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('reset のあとに、同じコースを押し直せる（もう一度送り、新しい人数に数えられる）', async () => {
      engine.subscribe(PID);
      engine.join(PID);
      await advance(POLL_MS + 10);
      api.reset();
      await advance(POLL_MS + 10);
      expect(engine.getSnapshot(PID).mineCounted).toBe(false);
      engine.join(PID);
      await advance(10);
      expect(engine.getSnapshot(PID)).toMatchObject({
        mineCounted: true,
        joined: 1,
        resetEpoch: 1,
      });
    });

    it('最初の応答の resetAt を基準にする。基準が null から日時に変わっても、reset として検知する', async () => {
      engine.subscribe(PID);
      await advance(POLL_MS + 10);
      expect(engine.getSnapshot(PID).resetEpoch).toBe(0);
      api.reset();
      await advance(POLL_MS + 10);
      expect(engine.getSnapshot(PID).resetEpoch).toBe(1);
    });

    it('まだ数えられていない申し込み（再送の途中）は、reset で消さない', async () => {
      api.down = true;
      engine.join(PID);
      await advance(1500);
      api.down = false;
      api.reset();
      await advance(JOIN_RETRY_MS[1] ?? 0);
      expect(engine.getSnapshot(PID)).toMatchObject({ mineCounted: true, joined: 1 });
    });
  });

  describe('応答の順序（D-41。I-133）', () => {
    it('古い連番の応答は捨てる。遅れて届いた最新の連番の応答は使う', async () => {
      api.latency = 5000;
      api.joined = 5;
      engine.watch(PID);
      engine.requestFetch('course-select'); // 連番 1。応答は 5 秒後に joined=5
      await advance(10);
      api.latency = 100;
      engine.join(PID); // 連番 2。すぐ返り、joined=6
      await advance(200);
      expect(engine.getSnapshot(PID).joined).toBe(6);
      await advance(6000);
      expect(engine.getSnapshot(PID).joined).toBe(6);
    });

    it('公演ごとに別の状態を持つ（別の公演の応答が混ざらない）', async () => {
      engine.watch('tech0:cbox');
      engine.requestFetch('course-select');
      await advance(10);
      expect(engine.getSnapshot('krs48:KMM-002')).toMatchObject({ joined: 0, mineCounted: false });
    });
  });

  // 申し込み（POST）の応答が、あとから出した取得（GET）の応答より遅く着くと、古い連番として捨てられ、
  // 「数えられた印」が立たなかった。自分の分が二重になり、reset でも戻らなかった（要件 F-38・F-40。D-18 の規則 4・10）
  describe('申し込みの応答が、あとに出した取得の応答より遅く着くとき（G2-01）', () => {
    /** 表示の人数（初めの支援者 74 人から。自分の申し込みを端末の中で足した形） */
    const shown = (mine: boolean): number => {
      const meter = engine.getSnapshot(PID);
      return displayedCount(74, {
        serverJoined: meter.joined,
        counted: meter.mineCounted,
        joined: mine,
        pseudoFriends: 0,
      });
    };
    /**
     * 申し込みだけが遅い通信: 申し込み（連番 1）を 3 秒後に数えて応答する。
     * その間に 2 秒おきの取得（連番 2）が先に返り、そのあと 3 秒の時点で、申し込みの応答が古い連番で着く。
     */
    const joinWithSlowResponse = async (): Promise<void> => {
      engine.subscribe(PID);
      api.latency = 3000;
      engine.join(PID);
      api.latency = 0;
      await advance(POLL_MS + 10); // 2 秒: 取得が先に返る（このあと着く申し込みの応答は、古い連番になる）
      expect(engine.getSnapshot(PID).mineCounted).toBe(false);
      await advance(1000); // 3 秒: 申し込みの応答が着く
    };

    it('数えられた印が立つ。人数は新しい取得の応答のまま。次の取得のあとも自分の分を二重に数えない（75 人。76 人にならない）', async () => {
      await joinWithSlowResponse();
      expect(engine.getSnapshot(PID)).toMatchObject({ joined: 0, mineCounted: true });
      await advance(POLL_MS); // 次の取得: サーバーの人数に自分が入る
      expect(engine.getSnapshot(PID)).toMatchObject({ joined: 1, mineCounted: true });
      expect(shown(true)).toBe(75);
    });

    it('応答の counted が false（前に数えられていた端末の 2 回目）でも、数えられた印が立つ', async () => {
      api.devices.add(DEVICE); // サーバーは、この端末を数えてある
      api.joined = 1;
      await joinWithSlowResponse();
      expect(engine.getSnapshot(PID)).toMatchObject({ joined: 1, mineCounted: true });
      expect(shown(true)).toBe(75);
    });

    it('そのあとサーバーが戻すと、数えられた印が消え、reset の動きが呼ばれる（74 人に戻る）', async () => {
      const onReset = vi.fn();
      engine.onReset(onReset);
      await joinWithSlowResponse();
      expect(engine.getSnapshot(PID).mineCounted).toBe(true);
      api.reset();
      await advance(POLL_MS + 10);
      expect(engine.getSnapshot(PID)).toMatchObject({
        joined: 0,
        mineCounted: false,
        resetEpoch: 1,
      });
      expect(onReset).toHaveBeenCalledTimes(1);
      expect(shown(false)).toBe(74);
    });

    it('戻す前に出した申し込みの応答は、戻したあとの取得より遅く着いても、数えられた印を立てない（resetAt が基準と違う応答は捨てる）', async () => {
      // 申し込みの応答だけを止めておく偽のサーバー。サーバーは先に数え終わり、応答だけが遅れて届く
      let release: () => void = () => undefined;
      vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
        const response = api.fetch(input, init);
        if (init?.method !== 'POST') return response;
        return new Promise<Response>((resolve, reject) => {
          release = () => void response.then(resolve, reject);
        });
      });
      engine.subscribe(PID);
      await advance(POLL_MS + 10); // 最初の取得（連番 1）。基準の resetAt が決まる
      engine.join(PID); // 連番 2。戻す前の resetAt で数えられ、応答は止められる
      await advance(10);
      expect(api.joined).toBe(1);
      api.reset();
      await advance(POLL_MS); // 戻したあとの取得（連番 3）で、reset を検知する
      expect(engine.getSnapshot(PID)).toMatchObject({
        joined: 0,
        mineCounted: false,
        resetEpoch: 1,
      });
      release(); // 戻す前の申し込みの応答が、ようやく着く（連番 2 < 3）
      await advance(10);
      expect(engine.getSnapshot(PID)).toMatchObject({
        joined: 0,
        mineCounted: false,
        resetEpoch: 1,
      });
    });
  });

  it('通信が飛んでいる間は busy（絵の先読みを始めない）', async () => {
    api.latency = 1000;
    engine.watch(PID);
    engine.requestFetch('course-select');
    await advance(10);
    expect(engine.isBusy()).toBe(true);
    await advance(1100);
    expect(engine.isBusy()).toBe(false);
  });

  it('2 台目の端末に、申し込みが 3 秒未満で届く（I-61）', async () => {
    const other = make('device-bbbbbbbbbbbbbbbb');
    other.subscribe(PID);
    engine.join(PID);
    await advance(0);
    const joinedAt = Date.now();
    let seenAt = 0;
    for (let i = 0; i < 40 && seenAt === 0; i += 1) {
      await advance(100);
      if (other.getSnapshot(PID).joined === 1) seenAt = Date.now();
    }
    expect(seenAt - joinedAt).toBeLessThan(3000);
    other.dispose();
  });
});
