// ファン向けの主な流れ（申し込み → 80% の演出 → 特典 → 仲間 → 感謝）の順番と数字（上層: A-15〜A-18・A-40・A-41・A-44・I-20〜I-24・I-27・I-28・I-123）。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harness, passStart } from './helpers';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const layerKinds = (h: ReturnType<typeof harness>) => h.state().layers.map((l) => l.kind);

describe('基準の流れ（人物 4・tech0・久留米市・Cボックス）', () => {
  it('はじめは、人物 4 の値で、はじめの画面 1 / 3 に出る（初めから選んである）', () => {
    const h = harness(4);
    const s = h.state();
    expect(s.page).toBe('start');
    expect(s.start).toMatchObject({ step: 0, oshiId: 'tech0', city: '久留米市', seat: 'normal' });
    expect(s.acct).toMatchObject({ deposit: 90000, pay: false });
    expect(h.view().status).toMatchObject({ supporters: 74, pct: 79, left: 19 });
  });

  it('「次へ」を 3 回押すとホームに着き、申し込みが確定して 75 人・80% になる', () => {
    const h = harness(4);
    passStart(h);
    expect(h.state().page).toBe('home');
    expect(h.state().course).toBe('normal');
    expect(h.joins).toEqual(['tech0:cbox']);
    expect(h.view().status).toMatchObject({ supporters: 75, pct: 80, left: 18 });
  });

  it('申し込みの 0.65 秒後に 80% の演出が 1 回出て、特典 1/3 の絵が、演出のあとに出る', () => {
    const h = harness(4);
    passStart(h);
    expect(layerKinds(h)).toEqual([]);
    vi.advanceTimersByTime(150);
    expect(layerKinds(h)).toEqual([]);
    vi.advanceTimersByTime(500);
    const top = h.state().layers[0];
    expect(top).toMatchObject({
      kind: 'fx',
      fx: { title: '80%', small: '突破！', sub: 'ライブ開催まで あと18人' },
    });
    // 特典の演出は重ねず、80% の演出の下の枠で伝える
    expect(top && top.kind === 'fx' && top.fx.say).toContain('特典 1/3');
    vi.advanceTimersByTime(2500 + 10);
    expect(layerKinds(h)).toEqual(['gift']);
    expect(h.view().giftCount).toBe(1);
  });

  it('演出は、押して飛ばすと、すぐ絵に進む（2.5 秒を待たない）', () => {
    const h = harness(4);
    passStart(h);
    vi.advanceTimersByTime(700);
    h.a.hideFx();
    vi.advanceTimersByTime(5);
    expect(layerKinds(h)).toEqual(['gift']);
  });

  it('やめて申し込み直しても、80% の演出と特典 1/3 は出ず、トーストだけ出る（決定 10・SP-75）', () => {
    const h = harness(4);
    passStart(h);
    vi.advanceTimersByTime(700 + 2510);
    h.a.closeGift();
    h.a.openCancel();
    h.a.doCancel();
    expect(h.state().course).toBeNull();
    expect(h.view().status.supporters).toBe(74);
    h.a.applyCourse('normal');
    vi.advanceTimersByTime(2000);
    expect(layerKinds(h)).toEqual([]);
    expect(h.state().toast?.text).toBe('もう一度申し込みました。確保は7,000円になりました');
    // 申し込み直しでも送る（reset のあとに押し直して数えられるため）。数えるのは、端末の番号で 1 回だけ（決定 3・6）
    expect(h.view().status.supporters).toBe(75);
  });

  it('同じコースをもう一度押しても、何も起きない', () => {
    const h = harness(4);
    passStart(h);
    vi.advanceTimersByTime(3500);
    h.a.closeGift();
    const before = h.state();
    h.a.applyCourse('normal');
    expect(h.state().course).toBe(before.course);
    expect(h.joins).toHaveLength(1);
  });
});

describe('共有（X・Facebook は、外のサイトを開かず、アプリの中で「投稿した」ことになる）', () => {
  /** 申し込み → 特典 1/3 を閉じる → 共有のシートを開いた状態 */
  function toShareSheet() {
    const h = harness(4);
    passStart(h);
    vi.advanceTimersByTime(700 + 2510);
    h.a.closeGift();
    h.a.openShare('share');
    return h;
  }

  it.each([
    ['x', 'Xに投稿しました（デモのため、実際には投稿されません）'],
    ['fb', 'Facebookに投稿しました（デモのため、実際には投稿されません）'],
  ] as const)(
    '%s を押すと、外を開かず・コピーもせず、投稿したことが出て、共有した印が付き、0.4 秒後に特典 2/3 が開く',
    async (ch, text) => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      const h = toShareSheet();
      expect(h.state().done.share).toBeUndefined(); // まだ共有していない
      await h.a.shareTo(ch);
      expect(open).not.toHaveBeenCalled();
      expect(h.copied).toEqual([]);
      expect(h.state().toast?.text).toBe(text);
      // 読み上げにも、投稿したことが伝わる（トーストは読み上げの対象外）
      expect(h.state().live.replace('\u200b', '')).toBe(`${text}。`);
      expect(h.state().done.share).toBe(true);
      vi.advanceTimersByTime(400);
      expect(h.view().giftCount).toBe(2);
      expect(h.joins).toHaveLength(1); // API へ加算は送らない（決定 3）
    },
  );

  it('続けて別のボタンを押しても、そのたびに投稿したことが出る。特典は 1 回しか開かない', async () => {
    const h = toShareSheet();
    await h.a.shareTo('x');
    vi.advanceTimersByTime(400);
    expect(h.view().giftCount).toBe(2);
    await h.a.shareTo('fb');
    expect(h.state().toast?.text).toBe(
      'Facebookに投稿しました（デモのため、実際には投稿されません）',
    );
    vi.advanceTimersByTime(400 + 2300);
    expect(h.view().giftCount).toBe(2);
    expect(h.state().gifts).toEqual([true, true, false]);
  });
});

describe('仲間と感謝（SNSで広める → 仲間が申し込む → 特典 3/3 → 感謝）', () => {
  function toHomeWithGift1() {
    const h = harness(4);
    passStart(h);
    vi.advanceTimersByTime(700 + 2510);
    h.a.closeGift();
    return h;
  }

  it('Instagram を押すと文面がコピーされ、0.4 秒後に特典 2/3 が開く。API へ加算は送らない（決定 3）', async () => {
    const h = toHomeWithGift1();
    h.a.openShare('share');
    await h.a.shareTo('ig');
    expect(h.copied[0]).toContain(
      'Tech0サステナアイドルを久留米市に呼びたい！ いま80%まで来ています。ライブ開催まであと18人です。',
    );
    expect(h.state().toast?.text).toBe('コピーしました。Instagramに貼り付けて投稿できます');
    vi.advanceTimersByTime(400);
    expect(h.view().giftCount).toBe(2);
    expect(h.joins).toHaveLength(1);
  });

  it('投稿文に、人物の番号・預金額・口座が入らない', async () => {
    const h = toHomeWithGift1();
    await h.a.shareTo('ig');
    const text = h.copied[0] ?? '';
    expect(text).not.toMatch(/p=\d|90,?000|預金|口座/);
    // 仮の URL を、班のメンバーに見せない。URL は文に入れず、ハッシュタグで終わる
    expect(text).not.toMatch(/https?:|example\.test|\/fan\//);
    expect(text.endsWith('#OSHIYOBU')).toBe(true);
  });

  it('シートを閉じて 2 秒後に擬似の仲間が 1 人申し込み、76 人になり、0.7 秒後に特典 3/3 が開く', async () => {
    const h = toHomeWithGift1();
    h.a.openShare('friend');
    h.a.closeShare();
    vi.advanceTimersByTime(1999);
    expect(h.view().status.supporters).toBe(75);
    vi.advanceTimersByTime(2);
    expect(h.view().status.supporters).toBe(76);
    expect(h.state()).toMatchObject({ friends: 1, called: 1 });
    expect(h.joins).toHaveLength(1);
    vi.advanceTimersByTime(700);
    expect(h.view().giftCount).toBe(2); // 仲間の特典は 3 つ目だが、開いた数は 1 + 1
    expect(h.state().gifts).toEqual([true, false, true]);
  });

  it('3 つ目の特典の絵を閉じた直後に、感謝のメッセージが 1 回だけ出る（A-44・I-28）', async () => {
    const h = toHomeWithGift1();
    await h.a.shareTo('x');
    vi.advanceTimersByTime(400 + 2300);
    h.a.closeGift();
    expect(h.state().layers.map((l) => l.kind)).toEqual([]);
    h.a.openShare('friend');
    h.a.closeShare();
    vi.advanceTimersByTime(2000 + 700 + 2300);
    expect(layerKinds(h)).toEqual(['gift']);
    expect(h.view().giftCount).toBe(3);
    h.a.closeGift();
    expect(layerKinds(h)).toEqual(['thanks']);
    h.a.closeThanks();
    // 貢献から見返す（replay）と、感謝はもう出ない
    h.a.showGift(true);
    h.a.closeGift();
    expect(layerKinds(h)).toEqual([]);
  });
});

describe('サーバーの件数と 80% の判定（I-123）', () => {
  it('成立済みの公演（サーバー 19 件・画面は 93 人）に入ると、80% の演出が出ない', () => {
    const h = harness(4, { server: 19 });
    expect(h.view().status).toMatchObject({ supporters: 93, established: true });
    passStart(h);
    vi.advanceTimersByTime(200);
    // 特典 1/3 の演出だけが出る（80% の演出ではない）
    const top = h.state().layers[0];
    expect(top && top.kind === 'fx' && top.fx.title).toBe('ごほうび');
    vi.advanceTimersByTime(2300);
    expect(layerKinds(h)).toEqual(['gift']);
  });

  it('一度もサーバーの人数が取れていなくても、初期値で判定して 80% の演出が 1 回出る', () => {
    const h = harness(4);
    passStart(h);
    vi.advanceTimersByTime(700);
    expect(h.state().layers[0]).toMatchObject({ kind: 'fx', fx: { title: '80%' } });
  });

  it('演出の時点で取れた人数で判定する。判定のあとに届いた応答では、出した演出を取り消さない', () => {
    const h = harness(4);
    passStart(h);
    vi.advanceTimersByTime(200);
    h.setServer(5);
    vi.advanceTimersByTime(500);
    // 応答が来たあとの申し込み後の達成率は 86% だが、申し込む前も 80% 以上（5 件 → 79 人 → 84%）なので演出は出ない
    expect(h.state().layers[0]).toMatchObject({ kind: 'fx', fx: { title: 'ごほうび' } });
  });

  it('ほかの端末の申し込みで 80% を越えても、演出は出ない（自分の申し込みの直後だけ）', () => {
    const h = harness(4);
    h.setServer(1); // 74 → 75 人（80%）
    vi.advanceTimersByTime(5000);
    expect(h.state().layers).toEqual([]);
    expect(h.view().status.pct).toBe(80);
  });
});

describe('最低人数・コースと人数（A-65・A-66・A-68・I-19）', () => {
  it('最上位コースに申し込んでも、人数は 1 人ぶん（74 → 75）。金額は届くが人数が足りず成立しない', () => {
    const h = harness(9);
    h.a.startPick('seat', 'top');
    passStart(h);
    expect(h.state().course).toBe('top');
    expect(h.view().status).toMatchObject({
      supporters: 75,
      total: 74 * 7000 + 300000,
      established: false,
    });
  });

  it('全員が通常の席なら、93 人（サーバー 19 件）で、成立する（651,000円）', () => {
    const h = harness(4);
    h.setServer(19);
    expect(h.view().status).toMatchObject({ supporters: 93, total: 651000, established: true });
  });
});
