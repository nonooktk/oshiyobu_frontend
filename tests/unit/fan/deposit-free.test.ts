// 預金を、利用者が決めた額で積み増す（ストアの動き）。統括の依頼:「額面を自由に指定できるようにしてほしい」。
// 初めは口座なし・預金 0円（全人物で同じ）。推し活定期をはじめると口座が使える状態になり、そのあとで、自由な額を積み増せる。
// 足したあとは、預金の額とコースの条件がその場で変わり、足したことを（トースト・読み上げで）事実の文で伝える。
// 戻る（リセット・5 分・人物の切り替え）と、口座も預金も初めに戻る。投稿文には預金の額が出ない。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEPOSIT_MAX } from '../../../src/fan/domain/deposit';
import { buildPostText } from '../../../src/fan/domain/share';
import { canApplyOf, courseOf, nextViewOf } from '../../../src/fan/domain/view';
import { harness, passStartOnly } from './helpers';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

type H = ReturnType<typeof harness>;
const canApplyNormal = (h: H): boolean => {
  const v = h.view();
  return canApplyOf(v, courseOf(v.cond, 'normal'));
};

/** はじめの画面を抜けて（目指すコースは通常の席）、推し活定期をはじめた状態。預金は 0円（通常の席の条件は 20,000円）。 */
function started(personaNo = 1): H {
  const h = harness(personaNo, { solo: true });
  passStartOnly(h);
  h.a.runAcct('teiki', 'home');
  return h;
}

describe('自由な額で足す（初めは預金 0円・通常の席の条件は 20,000円）', () => {
  it('足りない額（19,999円）では、まだ申し込めない。ちょうど届く額（あと 1円）で 20,000円になり、申し込める', () => {
    const h = started();
    expect(h.state().acct.deposit).toBe(0);
    expect(canApplyNormal(h)).toBe(false);
    h.a.runAcct('deposit', 'acct', 19_999);
    expect(h.state().acct.deposit).toBe(19_999);
    expect(canApplyNormal(h)).toBe(false);
    h.a.runAcct('deposit', 'acct', 1);
    expect(h.state().acct.deposit).toBe(20_000);
    expect(canApplyNormal(h)).toBe(true);
    // 次のアクションの先頭が、「通常の席に申し込む」に変わる（条件がその場で変わる）
    expect(nextViewOf(h.view()).rows[0]).toMatchObject({
      id: 'apply',
      label: '通常の席に申し込む',
    });
  });

  it('決まった額だけでなく、どんな額でも足せる（12,345円）', () => {
    const h = started();
    h.a.runAcct('deposit', 'acct', 12_345);
    expect(h.state().acct.deposit).toBe(12_345);
  });

  it('足すたびに合計が増え、回数が数えられ、「積み増した」の印が付く', () => {
    const h = started();
    h.a.runAcct('deposit', 'acct', 1_000);
    h.a.runAcct('deposit', 'acct', 2_000);
    expect(h.state().acct).toMatchObject({ deposit: 3_000, times: 2 });
    expect(h.state().done.deposit).toBe(true);
  });

  it('額を渡さない「決まった額の近道」は無い（額が無いときは、何も足さない）', () => {
    const h = started();
    h.a.runAcct('deposit', 'next');
    expect(h.state().acct).toMatchObject({ deposit: 0, times: 0 });
  });

  it('「次に開くコース」の預金（100,000円）を越える額も足せる。最上位の条件（1,000,000円）を越えても、上限までは足せる', () => {
    const h = started();
    h.a.runAcct('deposit', 'acct', 2_000_000);
    expect(h.state().acct.deposit).toBe(2_000_000);
    h.a.runAcct('deposit', 'acct', 1);
    expect(h.state().acct.deposit).toBe(2_000_001);
  });

  it('口座を使う行動（預金・メイン口座）は、推し活定期をはじめる前は、何も起きない', () => {
    const h = harness(4, { solo: true });
    passStartOnly(h);
    h.a.runAcct('deposit', 'acct', 5_000);
    h.a.runAcct('main', 'acct');
    expect(h.state().acct).toEqual({ pay: false, deposit: 0, times: 0 });
    expect(h.state().done).toEqual({});
  });
});

describe('足したことの伝え方（トースト・読み上げ・短い称賛。事実の文だけ）', () => {
  it('「◯◯円を積み増しました（預金 ◯◯円）」。条件に届いたときの称賛は「申し込めるようになりました」', () => {
    const h = started();
    h.a.runAcct('deposit', 'acct', 20_000);
    expect(h.state().toast?.text).toBe('20,000円を積み増しました（預金 20,000円）');
    expect(h.state().ach).toMatchObject({
      title: '積み増しありがとう。',
      sub: '申し込めるようになりました',
    });
    expect(h.state().live).toContain('積み増しありがとう。申し込めるようになりました');
  });

  it('条件に届かない額のときの称賛は、あと何が要るか（自分の預金の話）を言う', () => {
    const h = started();
    h.a.runAcct('deposit', 'acct', 1_000);
    expect(h.state().toast?.text).toBe('1,000円を積み増しました（預金 1,000円）');
    expect(h.state().ach).toMatchObject({
      title: '積み増しありがとう。',
      sub: '通常の席まで、残りは 預金 19,000円',
    });
  });

  it('得・運を褒める語、使わない語が、トースト・読み上げ・称賛の文に入らない（G-04・G-10）', () => {
    const h = started();
    h.a.runAcct('deposit', 'acct', 5_000);
    const s = h.state();
    const all = [s.toast?.text, s.live, JSON.stringify(s.ach)].join('');
    for (const w of [
      '増える',
      'お得',
      'もらえる',
      '獲得',
      'ボーナス',
      '口座開設',
      '確約',
      '新しい口座を開く',
    ])
      expect(all.includes(w), w).toBe(false);
  });
});

describe('足さない額（画面が先に断るが、ストアも守る。預金・回数・印は変わらない）', () => {
  it.each([
    ['0', 0],
    ['負', -1],
    ['小数', 1.5],
    ['NaN', Number.NaN],
    ['無限大', Number.POSITIVE_INFINITY],
    ['安全な整数を超える', Number.MAX_SAFE_INTEGER + 1],
  ])('%s（%s）', (_name, amount) => {
    const h = started();
    h.a.runAcct('deposit', 'acct', amount);
    expect(h.state().acct).toMatchObject({ deposit: 0, times: 0 });
    expect(h.state().done.deposit).toBeUndefined();
  });
});

describe('上限（預金の合計が 99,999,999円を超えない）', () => {
  it('ちょうど上限までは足せる。1円超は足さない', () => {
    const h = started();
    h.a.runAcct('deposit', 'acct', DEPOSIT_MAX + 1);
    expect(h.state().acct.deposit).toBe(0);
    h.a.runAcct('deposit', 'acct', DEPOSIT_MAX);
    expect(h.state().acct.deposit).toBe(DEPOSIT_MAX);
    h.a.runAcct('deposit', 'acct', 1);
    expect(h.state().acct).toMatchObject({ deposit: DEPOSIT_MAX, times: 1 });
  });
});

describe('戻る（閉じる・5 分・リセット）と、口座も預金も初めに戻る（口座なし・預金 0円）', () => {
  it.each([
    ['リセット（デモ用）', (h: H) => h.a.resetFan()],
    ['閉じる・「デモを最初に戻す」（静かに戻す）', (h: H) => h.a.resetFanQuiet()],
    ['5 分たつ', (h: H) => void h.a.resetForIdle()],
  ])('%s と、口座・預金・回数・印が、初めの値に戻る', (_name, back) => {
    const h = started();
    h.a.runAcct('deposit', 'acct', 12_345);
    expect(h.state().acct.deposit).toBe(12_345);
    back(h);
    expect(h.state().acct).toEqual({ pay: false, deposit: 0, times: 0 });
    expect(h.state().done).toEqual({});
  });

  it('人物を切り替える（人物ごとに別のストア）と、全員が同じ初めの値から。足した額は引き継がない', () => {
    const one = started(1);
    one.a.runAcct('deposit', 'acct', 12_345);
    for (const no of [1, 4, 14]) {
      expect(harness(no).state().acct).toEqual({ pay: false, deposit: 0, times: 0 });
    }
  });
});

describe('投稿文に、預金の額が出ない（いまのまま）', () => {
  it('預金を足したあとも、投稿文は預金・口座・人物の番号を含まない', () => {
    const h = started();
    h.a.runAcct('deposit', 'acct', 12_345);
    const text = buildPostText(h.view());
    expect(text).not.toMatch(/預金|口座|12,345|12345|p=\d/);
  });
});
