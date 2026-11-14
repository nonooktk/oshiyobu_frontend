// 開催熱量の「行動の案内」と「称賛の演出」（統括の決定: ゲージを進める行動を明確に示し、行動したら強く称賛する。褒めるのは行動だけ）。
// 上層: ①ホームの主のボタンが、場面ごとに行動そのものになる（申し込む／仲間を呼ぶ／仲間に知らせる／預金を積み増す）
//       ②仲間を呼ぶは、共有のシートを経由せず、称賛 →「届いた！」→ ゲージが伸びる → FEVER まで一続き
//       ③SNS への投稿は別の行動（ゲージは動かさない）で、投稿の直後にも短い称賛が出る
//       ④申し込む前は仲間を呼べない。成立のあとは、もう一度は呼べない
// 内部の数字（74 → 75 → 93）は、画面の文ではなく、ストアの状態で確かめる。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SoundCue } from '../../../src/fan/sound';
import { homeActionOf } from '../../../src/fan/domain/view';
import { harness, passStart, passStartOnly } from './helpers';

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
const action = (h: H) => homeActionOf(h.view());

/** 申し込み → 80% の演出 → 特典 1/3 の絵を閉じる（仲間を呼ぶ前のホーム） */
function applied(h: H) {
  passStart(h);
  vi.advanceTimersByTime(700 + 2510);
  h.a.closeGift();
}

describe('主のボタン（場面ごとの文）', () => {
  it('申し込む前（条件がそろっている）は「申し込む → FEVER 目前へ」', () => {
    const h = harness(1, { solo: true });
    passStartOnly(h);
    h.a.runAcct('teiki', 'home');
    h.a.runAcct('deposit', 'home', 20_000); // 通常の席の条件
    expect(h.state().course).toBeNull();
    expect(action(h)).toMatchObject({ id: 'apply', label: '申し込む', sub: '→ FEVER 目前へ' });
  });

  it('申し込む前は、全人物で同じ順に 1 つずつ変わる: 推し活定期をはじめる → 預金を積み増す → 申し込む', () => {
    for (const no of [1, 4, 14]) {
      const h = harness(no, { solo: true });
      passStartOnly(h);
      expect(h.state().page).toBe('home');
      expect(h.state().course).toBeNull();
      expect(action(h)).toMatchObject({
        id: 'teiki',
        label: '推し活定期をはじめる',
        sub: '→ 預金を積み増せるようになります',
      });
      h.a.homePrimary();
      expect(action(h)).toMatchObject({
        id: 'deposit',
        label: '預金を積み増す',
        sub: '→ 申し込めるようになります',
      });
    }
  });

  it('メイン口座が条件のコース（前方の席）を目指すときは、推し活定期のあとに「メイン口座にする」が入る', () => {
    const h = harness(4, { solo: true });
    h.a.startPick('seat', 'front');
    passStartOnly(h);
    h.a.homePrimary(); // 推し活定期
    expect(action(h)).toMatchObject({ id: 'main', label: 'メイン口座にする' });
    h.a.homePrimary();
    expect(action(h)).toMatchObject({ id: 'deposit' });
  });

  it('申し込んだあと（成立前）は「仲間を呼ぶ → FEVER（開催決定）へ」', () => {
    const h = harness(4, { solo: true });
    applied(h);
    expect(action(h)).toMatchObject({
      id: 'friend',
      label: '仲間を呼ぶ',
      sub: '→ FEVER（開催決定）へ',
    });
  });

  it('成立したあとは「仲間に知らせる → 開催が決まったことを伝える」', () => {
    const h = harness(4, { solo: true });
    applied(h);
    h.a.callFriends();
    vi.advanceTimersByTime(60_000);
    expect(h.view().status.established).toBe(true);
    expect(action(h)).toMatchObject({
      id: 'notice',
      label: '仲間に知らせる',
      sub: '→ 開催が決まったことを伝える',
    });
  });
});

describe('主のボタンを押したときの動き', () => {
  it('「推し活定期をはじめる」を押すと、その場で口座が使える状態になり、短い称賛と音が出る（預金は 0円のまま）', () => {
    const sounds: SoundCue[] = [];
    const h = harness(1, { solo: true, sounds });
    passStartOnly(h);
    h.a.homePrimary();
    expect(h.state().done.teiki).toBe(true);
    expect(h.state().acct).toEqual({ pay: false, deposit: 0, times: 0 });
    expect(h.state().page).toBe('home');
    expect(h.state().ach).toMatchObject({ title: 'はじめてくれてありがとう。' });
    expect(sounds).toEqual(['share']);
  });

  it('「預金を積み増す」を押すと、ホームの上に、額の入力のシートが開く（口座と預金の画面へは移らない）', () => {
    const h = harness(1, { solo: true });
    passStartOnly(h);
    h.a.homePrimary();
    h.a.homePrimary();
    expect(h.state().page).toBe('home');
    expect(layerKinds(h)).toEqual(['deposit']);
    h.a.closeDeposit();
    expect(layerKinds(h)).toEqual([]);
  });

  it('額の入力は、条件にちょうど届いたら、シートが閉じて、主のボタンが「申し込む」に変わる', () => {
    const h = harness(1, { solo: true });
    passStartOnly(h);
    h.a.homePrimary();
    h.a.homePrimary();
    h.a.runAcct('deposit', 'home', 5_000); // 届かない額: シートは開いたまま
    expect(layerKinds(h)).toEqual(['deposit']);
    h.a.runAcct('deposit', 'home', 15_000); // 20,000円に届く
    expect(layerKinds(h)).toEqual([]);
    expect(action(h)).toMatchObject({ id: 'apply' });
    expect(h.state().ach).toMatchObject({ sub: '申し込めるようになりました' });
  });

  it('「申し込む」を押すと、その場で申し込みが進み、称賛の音が鳴る', () => {
    const sounds: SoundCue[] = [];
    const h = harness(1, { solo: true, sounds });
    passStartOnly(h);
    h.a.runAcct('teiki', 'home');
    h.a.runAcct('deposit', 'home', 20_000);
    vi.advanceTimersByTime(5000);
    h.a.clearAch();
    sounds.length = 0;
    h.a.homePrimary();
    expect(h.state().course).toBe('normal');
    expect(sounds).toEqual(['join']);
    expect(h.joins).toHaveLength(1);
  });

  it('「仲間を呼ぶ」を押すと、共有のシートは開かず、称賛が出る', () => {
    const h = harness(4, { solo: true });
    applied(h);
    h.a.homePrimary();
    expect(layerKinds(h)).toEqual(['fx']);
    expect(topFx(h)).toMatchObject({ kind: 'friend', title: '届いた！' });
  });
});

describe('仲間を呼ぶ → 届いた！ → ゲージが伸びる → FEVER（基準の公演・ひとり体験）', () => {
  it('押した直後に、称賛の音（friend）と「届いた！」。人数はまだ変わらず、ゲージが 2.6 秒かけて満タンへ伸びる', () => {
    const sounds: SoundCue[] = [];
    const h = harness(4, { solo: true, sounds });
    applied(h);
    sounds.length = 0;
    const before = h.view();
    h.a.callFriends();
    expect(sounds).toEqual(['friend']);
    expect(topFx(h)).toMatchObject({
      title: '届いた！',
      small: '仲間を呼んでくれてありがとう。',
      sub: 'あなたの声が届いて、熱が高まっています',
    });
    // 数字（内部）: 75 人のまま。ゲージの動きは、伸びる前の長さから満タンまで、2.6 秒
    expect(h.view().status.supporters).toBe(75);
    expect(h.state().done.friend).toBeUndefined();
    expect(h.state().gaugeRun).toMatchObject({ from: before.heat.fill, to: 1, ms: 2600 });
    vi.advanceTimersByTime(2599);
    expect(h.view().status.supporters).toBe(75);
    expect(h.state().gaugeRun).not.toBeNull();
  });

  it('2.6 秒後に 93 人・成立。FEVER の瞬間の演出（派手）と音（fever）が出て、ゲージの動きは終わる', () => {
    const sounds: SoundCue[] = [];
    const h = harness(4, { solo: true, sounds });
    applied(h);
    h.a.callFriends();
    sounds.length = 0;
    vi.advanceTimersByTime(2600);
    expect(h.view().status).toMatchObject({ supporters: 93, total: 651000, established: true });
    expect(h.state()).toMatchObject({ friends: 18, called: 18, gaugeRun: null });
    expect(h.state().done.friend).toBe(true);
    expect(h.view().heat).toMatchObject({ stage: 5, fill: 1 });
    expect(topFx(h)).toMatchObject({
      kind: 'fever',
      strong: true,
      title: 'FEVER！',
      small: '仲間を呼んでくれてありがとう。',
      sub: 'あなたの声が届いて、開催が決まりました',
    });
    expect(sounds).toEqual(['fever']);
  });

  it('FEVER の演出のあと、特典 2/3 のごほうび → 特典の絵に進む', () => {
    const h = harness(4, { solo: true });
    applied(h);
    h.a.callFriends();
    vi.advanceTimersByTime(2600);
    vi.advanceTimersByTime(3600 + 10);
    expect(topFx(h)).toMatchObject({ title: 'ごほうび', small: '特典 2/3 が開いた！' });
    vi.advanceTimersByTime(2200 + 10);
    expect(layerKinds(h)).toEqual(['gift']);
    expect(h.view().giftCount).toBe(2);
  });

  it('「届いた！」の演出を押して飛ばしても、ゲージは伸び続け、2.6 秒後に FEVER になる', () => {
    const h = harness(4, { solo: true });
    applied(h);
    h.a.callFriends();
    vi.advanceTimersByTime(300);
    h.a.hideFx();
    expect(layerKinds(h)).toEqual([]);
    expect(h.state().gaugeRun).not.toBeNull();
    vi.advanceTimersByTime(2300);
    expect(h.view().status.established).toBe(true);
    expect(topFx(h)).toMatchObject({ title: 'FEVER！' });
  });

  it('動きを減らす設定でも、順番は同じ（カードだけ。ゲージの伸びは 1.8 秒の待ちのあとに一度で変わる）', () => {
    const h = harness(4, { solo: true, reduceMotion: true });
    applied(h);
    h.a.callFriends();
    expect(topFx(h)).toMatchObject({ title: '届いた！' });
    expect(topFx(h)?.confetti).toEqual([]);
    vi.advanceTimersByTime(1800);
    expect(h.view().status.established).toBe(true);
    expect(topFx(h)).toMatchObject({ title: 'FEVER！' });
  });
});

describe('呼べない場面（落ちない・何も起きない）', () => {
  it('申し込む前は、仲間を呼べない（人数は 74 人のまま・演出も出ない）', () => {
    const h = harness(4, { solo: true });
    h.a.callFriends();
    vi.advanceTimersByTime(10_000);
    expect(h.view().status.supporters).toBe(74);
    expect(h.state()).toMatchObject({ friends: 0, called: 0 });
    expect(layerKinds(h)).toEqual([]);
    expect(h.state().gaugeRun).toBeNull();
  });

  it('成立のあとは、もう一度は呼べない（人数も演出も変わらない）', () => {
    const h = harness(4, { solo: true });
    applied(h);
    h.a.callFriends();
    vi.advanceTimersByTime(2600 + 3600 + 2210);
    h.a.closeGift();
    h.a.closeThanks();
    const before = h.view().status;
    h.a.callFriends();
    vi.advanceTimersByTime(10_000);
    expect(h.view().status).toEqual(before);
    expect(h.state()).toMatchObject({ friends: 18, called: 18 });
    expect(layerKinds(h)).toEqual([]);
  });

  it('押し続けても（呼んでいる最中にもう一度）、仲間は 1 回ぶんしか増えない', () => {
    const h = harness(4, { solo: true });
    applied(h);
    h.a.callFriends();
    h.a.callFriends();
    vi.advanceTimersByTime(2600);
    expect(h.state()).toMatchObject({ friends: 18, called: 18 });
  });

  it('共有のシートを閉じても、仲間は来ない（シートは、SNS への投稿のためだけ）', () => {
    const h = harness(4, { solo: true });
    applied(h);
    h.a.openShare('share');
    h.a.closeShare();
    vi.advanceTimersByTime(10_000);
    expect(h.state()).toMatchObject({ friends: 0, called: 0 });
    expect(h.view().status.supporters).toBe(75);
  });
});

describe('SNS への投稿（別の行動。ゲージは動かさない）', () => {
  it('投稿した直後に、短い称賛が出る。人数・ゲージは変わらない', () => {
    const sounds: SoundCue[] = [];
    const h = harness(4, { solo: true, sounds });
    applied(h);
    sounds.length = 0;
    const before = h.view();
    h.a.openShare('share');
    h.a.shareTo('x');
    expect(sounds).toEqual(['share']);
    expect(topFx(h)).toMatchObject({
      kind: 'share',
      small: '投稿してくれてありがとう。',
      sub: '応援が広がっています',
    });
    expect(h.state().toast?.text).toBe('Xに投稿しました（デモ・未投稿）');
    vi.advanceTimersByTime(10_000);
    expect(h.view().status).toEqual(before.status);
    expect(h.view().heat.fill).toBe(before.heat.fill);
    expect(h.state().gaugeRun).toBeNull();
    expect(h.joins).toHaveLength(1); // API へ加算は送らない
  });

  it('称賛のあとに、特典 2/3 が開く。続けて別のボタンを押しても、称賛は 1 回だけ（音とトーストは毎回）', () => {
    const sounds: SoundCue[] = [];
    const h = harness(4, { solo: true, sounds });
    applied(h);
    sounds.length = 0;
    h.a.openShare('share');
    h.a.shareTo('x');
    expect(h.view().giftCount).toBe(1); // 称賛の最中は、まだ開かない
    vi.advanceTimersByTime(2600 + 10);
    expect(h.view().giftCount).toBe(2);
    vi.advanceTimersByTime(2200 + 10); // ごほうびの演出のあと、特典の絵
    h.a.closeGift();
    h.a.shareTo('ig');
    expect(h.state().toast?.text).toBe('Instagramに投稿しました（デモ・未投稿）');
    expect(sounds).toEqual(['share', 'share']);
    expect(layerKinds(h)).toEqual(['share']); // 2 回目は、称賛の演出を重ねない
  });
});

describe('仲間に知らせる（成立のあと）', () => {
  it('押すと、短い称賛が出る。人数・状態は変わらない', () => {
    const sounds: SoundCue[] = [];
    const h = harness(4, { solo: true, sounds });
    applied(h);
    h.a.callFriends();
    vi.advanceTimersByTime(2600 + 3600 + 2210);
    h.a.closeGift();
    h.a.closeThanks();
    const before = h.state();
    sounds.length = 0;
    h.a.homePrimary();
    expect(topFx(h)).toMatchObject({
      kind: 'notify',
      title: '届いた！',
      small: '知らせてくれてありがとう。',
      sub: 'あなたの声が、仲間に届きました',
    });
    expect(sounds).toEqual(['share']);
    vi.advanceTimersByTime(10_000);
    expect(h.state().friends).toBe(before.friends);
    expect(h.view().status.established).toBe(true);
    expect(layerKinds(h)).toEqual([]);
  });
});

describe('申し込んだ直後の称賛（見本の形: あなたがしたこと → それで何が進んだか）', () => {
  it('FEVER 目前に届くとき: 「申し込みありがとう。あなたの一歩で、FEVER 目前まで来ました」', () => {
    const h = harness(4, { solo: true });
    passStart(h);
    vi.advanceTimersByTime(700);
    expect(topFx(h)).toMatchObject({
      kind: 'stage',
      title: 'FEVER 目前！',
      small: '申し込みありがとう。あなたの一歩で、',
      sub: 'FEVER 目前まで来ました',
    });
    expect(topFx(h)?.strong).toBe(false); // 派手なのは、FEVER の瞬間だけ
  });

  it('段階が上がらない申し込みでも、称賛が出る（「熱が高まりました」）', () => {
    const h = harness(4, { solo: true, minPeople: 200 }); // 最低人数が多く、1 人増えても、段階は 1 のまま
    passStart(h);
    vi.advanceTimersByTime(700);
    expect(h.state().course).toBe('normal');
    expect(topFx(h)).toMatchObject({
      kind: 'join',
      title: 'ナイス！',
      small: '申し込みありがとう。あなたの一歩で、',
      sub: '熱が高まりました',
    });
  });
});
