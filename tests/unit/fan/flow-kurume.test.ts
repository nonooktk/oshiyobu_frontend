// 新しい流れの通し（統括の決定。ビズ側の要望を含む）:
//   推しを選ぶ → コースを選ぶ（市の選択は無い。久留米市に固定）→ ホーム
//   ①推し活定期をはじめる → ②預金を積み増す（自由な額）→ ③申し込む → ④仲間を呼ぶ → ⑤仲間に知らせる
// 初めは口座なし・預金 0円（全人物で同じ）。内部の数字は、画面の文ではなく、ストアの状態で確かめる（74 → 75 → 93・成立）。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { homeActionOf } from '../../../src/fan/domain/view';
import { harness, passStartOnly } from './helpers';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('はじめから成立まで、主のボタンの 1 つずつで進む（基準の公演 tech0:cbox）', () => {
  it('①〜⑤を順に。人数（内部）は 74 → 75 → 93、成立は最後の仲間を呼んだとき', () => {
    const h = harness(4, { solo: true });
    const act = () => homeActionOf(h.view());

    // はじめの画面（推し → コース）。市は選ばない
    expect(h.state().start).toMatchObject({ step: 0, oshiId: 'tech0', seat: 'normal' });
    passStartOnly(h);
    expect(h.state()).toMatchObject({
      page: 'home',
      city: '久留米市',
      venueId: 'cbox',
      aim: 'normal',
    });
    expect(h.state().course).toBeNull(); // この時点では、まだ申し込めない
    expect(h.view().status.supporters).toBe(74);

    // ① 推し活定期をはじめる → 預金を積み増せるようになります
    expect(act()).toMatchObject({
      id: 'teiki',
      label: '推し活定期をはじめる',
      sub: '→ 預金を積み増せるようになります',
    });
    h.a.homePrimary();
    expect(h.state().acct).toEqual({ pay: false, deposit: 0, times: 0 }); // 口座が使える状態になるだけ（預金は 0円のまま）

    // ② 預金を積み増す → 申し込めるようになります。額は自由（通常の席の条件 20,000円。足りない額では、まだ申し込めない）
    expect(act()).toMatchObject({
      id: 'deposit',
      label: '預金を積み増す',
      sub: '→ 申し込めるようになります',
    });
    h.a.runAcct('deposit', 'home', 12_345);
    expect(act().id).toBe('deposit'); // まだ届かない
    h.a.runAcct('deposit', 'home', 20_000 - 12_345);
    expect(h.state().acct.deposit).toBe(20_000);

    // ③ 申し込む → FEVER 目前へ（74 → 75 人）
    expect(act()).toMatchObject({ id: 'apply', label: '申し込む', sub: '→ FEVER 目前へ' });
    h.a.homePrimary();
    expect(h.state().course).toBe('normal');
    expect(h.view().status).toMatchObject({ supporters: 75, pct: 80 });
    vi.advanceTimersByTime(700 + 2510);
    h.a.closeGift();

    // ④ 仲間を呼ぶ → FEVER（開催決定）へ（75 → 93 人・成立）
    expect(act()).toMatchObject({
      id: 'friend',
      label: '仲間を呼ぶ',
      sub: '→ FEVER（開催決定）へ',
    });
    h.a.homePrimary();
    vi.advanceTimersByTime(2600);
    expect(h.view().status).toMatchObject({ supporters: 93, established: true });
    vi.advanceTimersByTime(3600 + 10 + 2200 + 10);
    h.a.closeGift();
    h.a.closeThanks();

    // ⑤ 仲間に知らせる
    expect(act()).toMatchObject({ id: 'notice', label: '仲間に知らせる' });
  });

  it('メイン口座が条件のコース（前方の席）は、推し活定期のあとに「メイン口座にする」が入り、預金は 100,000円まで', () => {
    const h = harness(4, { solo: true });
    h.a.startPick('seat', 'front');
    passStartOnly(h);
    const ids: string[] = [];
    for (let i = 0; i < 4 && h.state().course === null; i += 1) {
      ids.push(homeActionOf(h.view()).id);
      if (homeActionOf(h.view()).id === 'deposit') h.a.runAcct('deposit', 'home', 100_000);
      else h.a.homePrimary();
    }
    expect(ids).toEqual(['teiki', 'main', 'deposit', 'apply']);
    expect(h.state().course).toBe('front');
  });

  it('預金が足りないまま「申し込む」は出ない。口座を使う前に預金を足しても、何も起きない', () => {
    const h = harness(4, { solo: true });
    passStartOnly(h);
    h.a.runAcct('deposit', 'home', 20_000);
    expect(h.state().acct.deposit).toBe(0);
    expect(homeActionOf(h.view()).id).toBe('teiki');
  });

  it('閉じる・5 分・リセットで、初めの状態（口座なし・預金 0円・はじめの画面）に戻る', () => {
    for (const back of [
      (h: ReturnType<typeof harness>) => h.a.resetFan(),
      (h: ReturnType<typeof harness>) => h.a.resetFanQuiet(),
      (h: ReturnType<typeof harness>) => void h.a.resetForIdle(),
    ]) {
      const h = harness(4, { solo: true });
      passStartOnly(h);
      h.a.homePrimary();
      h.a.runAcct('deposit', 'home', 20_000);
      back(h);
      expect(h.state()).toMatchObject({ page: 'start', course: null, aim: null });
      expect(h.state().acct).toEqual({ pay: false, deposit: 0, times: 0 });
      expect(h.state().done).toEqual({});
    }
  });
});
