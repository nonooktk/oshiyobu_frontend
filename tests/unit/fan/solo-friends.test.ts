// ひとり体験（共有メーターなし）の「仲間を呼ぶ」。人数が、その公演の最低人数に届く所まで一度に増え、成立の演出が出る。
// 基準の公演（tech0・久留米市・Cボックス。人物 4）は、申し込んで 75 人・80%、仲間を呼んで 93 人・成立。
// 共有メーターあり（solo: false。VITE_SHARED_METER=on）は、これまでどおり仲間が 1 人ずつ。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harness, passStart } from './helpers';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

type H = ReturnType<typeof harness>;
const layerKinds = (h: H) => h.state().layers.map((l) => l.kind);
const topFx = (h: H) => {
  const top = h.state().layers.at(-1);
  return top && top.kind === 'fx' ? top.fx : null;
};

/** 申し込み → 80% の演出 → 特典 1/3 の絵を閉じる（仲間を呼ぶ前の、ホーム） */
function applied(h: H) {
  passStart(h);
  vi.advanceTimersByTime(700 + 2510);
  h.a.closeGift();
}
/** 仲間を呼ぶ（共有のシートを開いて閉じ、2 秒後に仲間が申し込む） */
function callFriends(h: H) {
  h.a.openShare('friend');
  h.a.closeShare();
  vi.advanceTimersByTime(2000);
}

describe('基準の公演（人物 4）で、申し込む → 仲間を呼ぶ', () => {
  it('申し込むと 75 人・80%（共有ありのときと同じ数字）。サーバーには数えない', () => {
    const h = harness(4, { solo: true });
    passStart(h);
    expect(h.view().status).toMatchObject({ supporters: 75, pct: 80, left: 18 });
    expect(h.state().course).toBe('normal');
  });

  it('仲間を呼ぶと、93 人・成立（金額 651,000円が到達ライン 650,000円以上）。仲間は 18 人', () => {
    const h = harness(4, { solo: true });
    applied(h);
    callFriends(h);
    const s = h.view().status;
    expect(s).toMatchObject({ supporters: 93, total: 651000, established: true, pct: 100 });
    expect(h.state()).toMatchObject({ friends: 18, called: 18 });
    expect(h.state().done.friend).toBe(true);
    expect(h.state().toast?.text).toBe('呼んだ仲間が申し込みました');
  });

  it('成立の演出（「成立！」「ライブの開催が決まりました」）が 1 回出て、そのあと特典の演出に進む（申し込みと仲間で、特典 2/3）', () => {
    const h = harness(4, { solo: true });
    applied(h);
    callFriends(h);
    expect(layerKinds(h)).toEqual([]);
    vi.advanceTimersByTime(700);
    expect(topFx(h)).toMatchObject({
      title: '100%',
      small: '成立！',
      sub: 'ライブの開催が決まりました',
    });
    vi.advanceTimersByTime(2500 + 10);
    expect(topFx(h)).toMatchObject({ title: 'ごほうび', small: '特典 2/3 が開いた！' });
    vi.advanceTimersByTime(2200 + 10);
    expect(layerKinds(h)).toEqual(['gift']);
    expect(h.view().giftCount).toBe(2);
  });

  it('動きを減らす設定でも、成立の演出は出る（短くなる）', () => {
    const h = harness(4, { solo: true, reduceMotion: true });
    applied(h);
    callFriends(h);
    vi.advanceTimersByTime(5);
    expect(topFx(h)).toMatchObject({ small: '成立！' });
  });

  it('成立のあとに、もう一度仲間を呼んでも、人数は増えず、演出も出ない（落ちない）', () => {
    const h = harness(4, { solo: true });
    applied(h);
    callFriends(h);
    vi.advanceTimersByTime(700 + 2510 + 2210);
    h.a.closeGift();
    h.a.closeThanks();
    const before = h.view().status;
    callFriends(h);
    vi.advanceTimersByTime(10_000);
    expect(h.view().status).toEqual(before);
    expect(h.state()).toMatchObject({ friends: 18, called: 18 });
    expect(layerKinds(h)).toEqual([]);
  });

  it('申し込む前に、仲間を呼ぼうとしても、何も起きない（人数は 74 人のまま・落ちない）', () => {
    const h = harness(4, { solo: true });
    h.a.openShare('friend');
    h.a.closeShare();
    vi.advanceTimersByTime(10_000);
    expect(h.view().status.supporters).toBe(74);
    expect(h.state()).toMatchObject({ friends: 0, called: 0 });
    expect(h.state().done.friend).toBeUndefined();
  });

  it('共有メーターあり（solo でない）は、これまでどおり仲間が 1 人。成立の演出は出ない', () => {
    const h = harness(4, { solo: false });
    applied(h);
    callFriends(h);
    vi.advanceTimersByTime(700);
    expect(h.state()).toMatchObject({ friends: 1, called: 1 });
    expect(h.view().status).toMatchObject({ supporters: 76, established: false });
    expect(layerKinds(h)).not.toContain('thanks');
  });
});

describe('最低人数・費用が、事務所向けと連動して変わっているとき', () => {
  it('最低人数が少なく、人数だけ先に届いていても、金額が足りるまで仲間が増える（成立する）', () => {
    const h = harness(4, { solo: true, minPeople: 70 });
    applied(h);
    expect(h.view().status).toMatchObject({ peopleOk: true, amountOk: false, gathered: true });
    callFriends(h);
    // 金額: 74 人 × 7,000 + 自分 7,000 = 525,000。あと 125,000円 ÷ 7,000円 = 17.86 → 18 人
    expect(h.state().friends).toBe(18);
    expect(h.view().status).toMatchObject({ established: true, total: 651000 });
  });

  it('最低人数が多いときは、その人数まで増える', () => {
    const h = harness(4, { solo: true, minPeople: 120 });
    applied(h);
    callFriends(h);
    expect(h.view().status).toMatchObject({ supporters: 120, established: true });
  });
});
