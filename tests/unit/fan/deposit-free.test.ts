// 預金を、利用者が決めた額で積み増す（ストアの動き）。統括の依頼:「額面を自由に指定できるようにしてほしい」。
// 足したあとは、預金の額とコースの条件がその場で変わり、足したことを（トースト・読み上げで）事実の文で伝える。
// 戻る（リセット・5 分・人物の切り替え）と、預金も初めの額に戻る。投稿文には預金の額が出ない。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEPOSIT_MAX } from '../../../src/fan/domain/deposit';
import { buildPostText } from '../../../src/fan/domain/share';
import { canApplyOf, courseOf, nextViewOf } from '../../../src/fan/domain/view';
import { harness, passStart } from './helpers';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const canApplyNormal = (h: ReturnType<typeof harness>): boolean => {
  const v = h.view();
  return canApplyOf(v, courseOf(v.cond, 'normal'));
};

/** はじめの画面を抜けて、12,345円を足した状態（はじめの画面のままだと、5 分で戻す対象にならない） */
function toDeposited(personaNo: number) {
  const h = harness(personaNo);
  passStart(h);
  h.a.runAcct('deposit', 'acct', 12_345);
  return h;
}

describe('自由な額で足す（人物 1: 預金 15,000円・通常の席の条件は 20,000円）', () => {
  it('足りない額（4,999円）では、19,999円で、まだ申し込めない。ちょうど届く額（あと 1円）で 20,000円になり、申し込める', () => {
    const h = harness(1);
    h.a.aimCourse('normal');
    expect(h.state().acct.deposit).toBe(15_000);
    expect(canApplyNormal(h)).toBe(false);
    h.a.runAcct('deposit', 'acct', 4_999);
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

  it('いちどに、ちょうど届く額（5,000円）でも届く。決まった額だけでなく、どんな額でも足せる（12,345円）', () => {
    const a = harness(1);
    a.a.runAcct('deposit', 'acct', 5_000);
    expect(a.state().acct.deposit).toBe(20_000);
    const b = harness(1);
    b.a.runAcct('deposit', 'acct', 12_345);
    expect(b.state().acct.deposit).toBe(27_345);
  });

  it('足すたびに合計が増え、回数が数えられ、「積み増した」の印が付く', () => {
    const h = harness(1);
    h.a.runAcct('deposit', 'acct', 1_000);
    h.a.runAcct('deposit', 'acct', 2_000);
    expect(h.state().acct).toMatchObject({ deposit: 18_000, times: 2 });
    expect(h.state().done.deposit).toBe(true);
  });

  it('人物 14（預金 9,000円・通常の席まで 11,000円）も、足りない額 → ちょうど届く額で申し込める', () => {
    const h = harness(14);
    h.a.runAcct('deposit', 'acct', 10_999);
    expect(canApplyNormal(h)).toBe(false);
    h.a.runAcct('deposit', 'acct', 1);
    expect(h.state().acct.deposit).toBe(20_000);
    expect(canApplyNormal(h)).toBe(true);
  });

  it('「次に開くコース」の預金（100,000円）を越える額も足せる。最上位の条件（1,000,000円）を越えても、上限までは足せる', () => {
    const h = harness(4);
    h.a.runAcct('deposit', 'acct', 2_000_000);
    expect(h.state().acct.deposit).toBe(2_090_000);
    expect(h.a.acctDone('deposit')).toBe(true); // 決まった額で進める行動（次のアクション）は、もう無い
    h.a.runAcct('deposit', 'acct', 1);
    expect(h.state().acct.deposit).toBe(2_090_001);
  });
});

describe('足したことの伝え方（トースト・読み上げ。事実の文だけ）', () => {
  it('「◯◯円を積み増しました（預金 ◯◯円）」。条件がそろうときは、続けて申し込めるコースを言う', () => {
    const h = harness(1);
    h.a.aimCourse('normal');
    h.a.runAcct('deposit', 'acct', 5_000);
    expect(h.state().toast?.text).toBe(
      '5,000円を積み増しました（預金 20,000円）。通常の席に申し込めます',
    );
    expect(h.state().live).toBe(
      '条件がそろいました。5,000円を積み増しました（預金 20,000円）。通常の席に申し込めます。',
    );
  });

  it('条件が変わらない額のときは、あと何が要るかを言う。「増えました」を重ねない', () => {
    const h = harness(1);
    h.a.aimCourse('normal');
    h.a.runAcct('deposit', 'acct', 1_000);
    expect(h.state().toast?.text).toBe(
      '1,000円を積み増しました（預金 16,000円）。通常の席まで、残りは 預金 4,000円',
    );
    expect(h.state().live).toBe(
      '1,000円を積み増しました（預金 16,000円）。通常の席まで、残りは 預金 4,000円。',
    );
    expect(h.state().ach).toMatchObject({
      kind: 'one',
      title: 'ナイス！',
      small: '1,000円を積み増しました',
    });
  });

  it('得・運を褒める語、使わない語が、トースト・読み上げ・演出の文に入らない（G-04・G-10）', () => {
    const h = harness(1);
    h.a.aimCourse('normal');
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

  it('決まった額で進める行動（次のアクション）の文は、従来のまま（預金が ◯◯円になりました）', () => {
    const h = harness(4);
    h.a.runAcct('deposit', 'next');
    expect(h.state().toast?.text).toMatch(/^預金が 100,000円になりました/);
    expect(h.state().live).toBe('条件を1つ達成！預金が 100,000円になりました。');
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
    const h = harness(1);
    h.a.runAcct('deposit', 'acct', amount);
    expect(h.state().acct).toMatchObject({ deposit: 15_000, times: 0 });
    expect(h.state().done.deposit).toBeUndefined();
    expect(h.state().toast).toBeNull();
  });
});

describe('上限（預金の合計が 99,999,999円を超えない）', () => {
  it('ちょうど上限までは足せる。1円超は足さない', () => {
    const h = harness(1);
    h.a.runAcct('deposit', 'acct', DEPOSIT_MAX - 15_000 + 1);
    expect(h.state().acct.deposit).toBe(15_000);
    h.a.runAcct('deposit', 'acct', DEPOSIT_MAX - 15_000);
    expect(h.state().acct.deposit).toBe(DEPOSIT_MAX);
    h.a.runAcct('deposit', 'acct', 1);
    expect(h.state().acct).toMatchObject({ deposit: DEPOSIT_MAX, times: 1 });
  });
});

describe('戻る（閉じる・5 分・リセット・人物の切り替え）と、預金も初めの額に戻る', () => {
  it.each([
    ['リセット（デモ用）', (h: ReturnType<typeof harness>) => h.a.resetFan()],
    [
      '閉じる・「デモを最初に戻す」（静かに戻す）',
      (h: ReturnType<typeof harness>) => h.a.resetFanQuiet(),
    ],
    ['5 分たつ', (h: ReturnType<typeof harness>) => void h.a.resetForIdle()],
  ])('%s と、預金・回数・印が、人物 1 の初めの値（15,000円・0 回）に戻る', (_name, back) => {
    const h = toDeposited(1);
    expect(h.state().acct.deposit).toBe(15_000 + 12_345);
    back(h);
    expect(h.state().acct).toMatchObject({ deposit: 15_000, times: 0 });
    expect(h.state().done).toEqual({});
  });

  it('人物を切り替える（人物ごとに別のストア）と、それぞれの初めの額から。足した額は引き継がない', () => {
    const one = toDeposited(1);
    expect(one.state().acct.deposit).toBe(27_345);
    const fourteen = harness(14);
    expect(fourteen.state().acct).toMatchObject({ deposit: 9_000, times: 0 });
    const four = harness(4);
    expect(four.state().acct).toMatchObject({ deposit: 90_000, times: 0 });
  });
});

describe('投稿文に、預金の額が出ない（いまのまま）', () => {
  it('預金を足したあとも、投稿文は預金・口座・人物の番号を含まない', () => {
    const h = toDeposited(1);
    const text = buildPostText(h.view());
    expect(text).not.toMatch(/預金|口座|27,345|27345|12,345|12345|p=\d/);
  });
});
