// 口座と預金の 3 つの行動・成立の表示・やめる・条件の変更・リセットの確かめ（上層: A-07・A-26・A-27・A-39・A-61・A-64〜A-66・I-18・I-22・I-25・I-26）。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { performanceIdOf } from '../../../src/core';
import { nextViewOf } from '../../../src/fan/domain/view';
import { harness, passStart, passStartOnly } from './helpers';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** はじめの画面を抜けて、推し活定期をはじめた状態（口座あり・預金 0円）。目指すコースは通常の席。 */
function started(opts: Parameters<typeof harness>[1] = { solo: true }) {
  const h = harness(4, opts);
  passStartOnly(h);
  h.a.runAcct('teiki', 'home');
  return h;
}

describe('口座と預金の 3 つの行動（I-22・A-26）', () => {
  it('推し活定期をはじめると、口座が使える状態になる（預金は 0円のまま）。1 回だけ', () => {
    const h = harness(4, { solo: true });
    passStartOnly(h);
    expect(h.state().acct).toEqual({ pay: false, deposit: 0, times: 0 });
    h.a.runAcct('teiki', 'home');
    h.a.runAcct('teiki', 'home');
    expect(h.state().done.teiki).toBe(true);
    expect(h.state().acct).toEqual({ pay: false, deposit: 0, times: 0 });
    expect(h.state().toast?.text).toBe(
      '推し活定期をはじめました。デモ用の操作で、実際の手続きは行われません',
    );
    expect(h.state().ach).toMatchObject({
      title: 'はじめてくれてありがとう。',
      sub: '預金を積み増せるようになりました',
    });
  });

  it('メイン口座にしても預金は変わらない（口座を使える状態になってから）', () => {
    const h = started();
    h.a.runAcct('main', 'acct');
    expect(h.state().acct).toMatchObject({ pay: true, deposit: 0 });
    expect(h.state().done).toMatchObject({ main: true, teiki: true });
  });

  it('押すたびに、短い称賛が出る。条件がそろったときは「申し込めるようになりました」（A-26・A-27）', () => {
    const h = harness(4, { solo: true });
    passStartOnly(h);
    h.a.aimCourse('front');
    h.a.runAcct('teiki', 'next');
    h.a.runAcct('main', 'next');
    expect(h.state().ach).toMatchObject({
      title: 'メイン口座にしてくれてありがとう。',
      sub: '前方の席まで、残りは 預金 100,000円',
    });
    h.a.runAcct('deposit', 'next', 100_000);
    expect(h.state().ach).toMatchObject({
      title: '積み増しありがとう。',
      sub: '申し込めるようになりました',
    });
    expect(h.state().fresh).toMatchObject({ all: true, act: 'deposit' });
    // 押すと消える。待っていた ✓ の動きは、すぐ始まる（待ち時間 0）
    h.a.clearAch();
    expect(h.state().ach).toBeNull();
    expect(h.state().ckDelay).toBe(0);
  });

  it('全画面の演出・特典・シートが開いているあいだは、短い称賛を重ねない', () => {
    const h = started();
    h.a.openShare('friend');
    h.a.runAcct('main', 'acct');
    expect(h.state().ach).toBeNull();
  });

  it('動きを減らす設定では、✓ を待たせず（0 秒）、称賛は短い（2 秒）', () => {
    const h = started({ solo: true, reduceMotion: true });
    h.a.runAcct('main', 'acct');
    expect(h.state().ckDelay).toBe(0);
    expect(h.state().ach?.ms).toBe(2000);
  });
});

describe('成立の表示（A-07・A-64〜A-66・I-18）', () => {
  it('最低人数 80 で申し込むと、あと 5 人になる（A-07）', () => {
    const h = harness(4, { minPeople: 80 });
    expect(h.view().status).toMatchObject({ supporters: 74, left: 6, pct: 92 });
    passStart(h);
    expect(h.view().status).toMatchObject({ supporters: 75, left: 5, pct: 93 });
  });

  it('最低人数 80 では、74 人（92%）から始めるので、80% の演出は出ない（I-20 の (c)）', () => {
    const h = harness(4, { minPeople: 80 });
    passStart(h);
    vi.advanceTimersByTime(200);
    const top = h.state().layers[0];
    // 80% の演出（FEVER 目前・FEVER）は出ない。申し込みの称賛（段階が上がらないとき）だけが出る
    expect(top && top.kind === 'fx' && top.fx.kind).toBe('join');
    expect(top && top.kind === 'fx' && top.fx.title).toBe('ナイス！');
  });

  it('人数だけ届いたとき（最低人数 80・支援者 80・合計 560,000円）は「人数は集まりました」で、成立ではない（A-65）', () => {
    const h = harness(4, { minPeople: 80, server: 6 });
    expect(h.view().status).toMatchObject({
      supporters: 80,
      total: 560000,
      peopleOk: true,
      amountOk: false,
      gathered: true,
      established: false,
    });
  });

  it('最低人数 100・支援者 93 は、金額は届いても、あと 7 人で、成立ではない（A-66）', () => {
    const h = harness(4, { minPeople: 100, server: 19 });
    expect(h.view().status).toMatchObject({
      supporters: 93,
      total: 651000,
      amountOk: true,
      peopleOk: false,
      left: 7,
      established: false,
    });
  });

  it('金額と人数がそろうと成立（93 人・651,000円。A-64）。成立後は、申し込みをやめられない（SP-78）', () => {
    const h = harness(4, { server: 19 });
    passStart(h);
    vi.advanceTimersByTime(300);
    expect(h.view().status.established).toBe(true);
    h.a.openCancel();
    h.a.doCancel();
    expect(h.state().course).toBe('normal');
    expect(h.state().layers.some((l) => l.kind === 'cancel')).toBe(false);
  });
});

describe('次のアクション（SP-42）', () => {
  it('申し込む前は、いまやる 1 つだけが並ぶ。推し活定期 → メイン口座（条件にあるとき）→ 預金 → 申し込む', () => {
    const h = harness(4, { solo: true });
    passStartOnly(h);
    h.a.aimCourse('front');
    expect(nextViewOf(h.view()).rows.map((r) => r.id)).toEqual(['teiki']);
    h.a.runAcct('teiki', 'next');
    const v = nextViewOf(h.view());
    expect(v.hint).toBe('前方の席まで、残りは 預金 100,000円・メイン口座');
    expect(v.rows.map((r) => r.id)).toEqual(['main']);
    h.a.runAcct('main', 'next');
    expect(nextViewOf(h.view()).rows.map((r) => r.id)).toEqual(['deposit']);
    expect(nextViewOf(h.view()).rows[0]?.label).toBe('預金を積み増す'); // 決まった額（＋◯◯円）の近道は無い
  });

  it('条件がそろうと、先頭に「{コース}に申し込む」が出て、押すと何が進むか（FEVER 目前へ）の説明が付く', () => {
    const h = harness(4, { solo: true });
    passStartOnly(h);
    h.a.aimCourse('front');
    h.a.runAcct('teiki', 'next');
    h.a.runAcct('main', 'next');
    h.a.runAcct('deposit', 'next', 100_000);
    const v = nextViewOf(h.view());
    expect(v.rows[0]).toMatchObject({ id: 'apply', label: '前方の席に申し込む' });
    expect(v.hint).toBe('申し込む → FEVER 目前へ（21,000円）'); // 行動 → 結果の対。自分が払う金額だけ残す
  });

  it('申し込んだあとは、仲間を呼ぶ・SNSで広めるだけ。成立後は「仲間に知らせる」（B4）', () => {
    const h = harness(4);
    passStart(h);
    expect(nextViewOf(h.view()).rows.map((r) => r.id)).toEqual(['friend', 'share']);
    expect(nextViewOf(h.view()).rows[0]?.hint).toBe('仲間を呼ぶ → 熱が高まります'); // 人数は言わない
    const h2 = harness(4, { server: 19 });
    passStart(h2);
    expect(nextViewOf(h2.view()).rows.map((r) => r.id)).toEqual(['notice']);
  });
});

describe('条件の変更・引き継ぎ（A-39・I-26。デモ用の操作）', () => {
  it('推しを変えると、開いた特典・達成の記録・呼んだ仲間・口座は残り、申し込み・目指すコース・80% の済みは取り直す（市は久留米市のまま）', () => {
    const h = harness(4);
    passStart(h);
    vi.advanceTimersByTime(3500);
    h.a.closeGift();
    h.a.runAcct('main', 'acct');
    h.a.go('opt');
    h.a.pickPend('oshi', 'krs48');
    h.a.applyChange();
    const s = h.state();
    expect(s).toMatchObject({
      oshiId: 'krs48',
      city: '久留米市',
      course: null,
      aim: null,
      friends: 0,
      milestoneShown: false,
    });
    expect(s.gifts).toEqual([true, false, false]);
    expect(s.done).toMatchObject({ join: true, teiki: true, deposit: true, main: true });
    expect(s.acct).toMatchObject({ pay: true, deposit: 20000 });
    expect(s.carry).toMatchObject({ gifts: 1, doneCount: 4, held: 7000, city: '久留米市' });
    expect(s.carry?.venueName).toContain('Cボックス');
    expect(s.layers.map((l) => l.kind)).toEqual(['carry']);
    h.a.closeCarry();
    expect(h.state().page).toBe('home');
  });

  it('条件がそろっていないコースは選べない（選んでいたら通常の席に戻す）', () => {
    const h = harness(4);
    h.a.go('opt');
    h.a.pickPend('seat', 'front');
    expect(h.state().pend?.seat).toBe('normal');
  });
});

describe('リセット（デモ用。A-61）', () => {
  it('ファン向けだけが、初めの値のはじめの画面（1 / 2）に戻る（口座なし・預金 0円）。あとから出るはずの演出も止まる', () => {
    const h = harness(6);
    passStart(h);
    vi.advanceTimersByTime(200);
    h.a.resetFan();
    const s = h.state();
    expect(s.page).toBe('start');
    expect(s.start).toMatchObject({ step: 0, oshiId: 'tech0', seat: 'normal' });
    expect(s.city).toBe('久留米市');
    expect(s).toMatchObject({
      course: null,
      gifts: [false, false, false],
      done: {},
      called: 0,
      layers: [],
    });
    expect(s.acct).toEqual({ deposit: 0, pay: false, times: 0 }); // 全人物で同じ初めの値
    expect(h.state().toast?.text).toBe('ファン向けを、はじめの画面に戻しました');
    vi.advanceTimersByTime(5000);
    expect(h.state().layers).toEqual([]); // 申し込みの演出は、もう出ない
  });
});

describe('共有メーターの reset を検知したとき（I-126・A-61 の外の reset）', () => {
  it('数えられた申し込みは「未申し込み」に戻り、擬似の仲間の加算は消える。行動の記録・特典・口座は変わらない', () => {
    const h = harness(4);
    passStart(h);
    vi.advanceTimersByTime(3500);
    h.a.closeGift();
    h.a.callFriends(); // 共有メーターありは、1 人ずつ（ゲージの伸びは 1.2 秒）
    vi.advanceTimersByTime(1200);
    expect(h.view().status.supporters).toBe(76);
    h.a.serverReset(true);
    h.setServer(0);
    const s = h.state();
    expect(s.course).toBeNull();
    expect(s.friends).toBe(0);
    expect(s.called).toBe(1); // 「呼んだ仲間」の記録は変わらない
    expect(s.done).toMatchObject({ join: true, friend: true });
    expect(s.gifts[0]).toBe(true);
    expect(s.acct.deposit).toBe(20000);
    expect(h.view().status.supporters).toBe(74);
    // 同じコースを、もう一度押して申し込み直せる。80% の演出は、出した済みなので出ない
    h.a.applyCourse('normal');
    expect(h.state().course).toBe('normal');
  });

  it('まだ数えられていない申し込み（未送信・再送中）は消さない', () => {
    const h = harness(4);
    passStart(h);
    h.a.serverReset(false);
    expect(h.state().course).toBe('normal');
  });
});

describe('事務所向けとの連動（事務所向けで選んだ市は、ファン向けに伝わらない。「デモを最初に戻す」だけ受ける）', () => {
  it('ファン向けの市・会場は、久留米市・Cボックスに固定。事務所向けの会場を受ける口は無い', () => {
    const h = harness(4);
    expect((h.a as Record<string, unknown>).applyOffice).toBeUndefined();
    expect(h.state()).toMatchObject({ city: '久留米市', venueId: 'cbox' });
  });

  it('事務所向けの「デモを最初に戻す」を受けると、トーストを出さずに、はじめの画面へ戻る', () => {
    const h = harness(4);
    passStart(h);
    h.a.resetFanQuiet();
    expect(h.state().page).toBe('start');
    expect(h.state().toast).toBeNull();
  });
});

describe('申し込み済みのあとのコース変更（SP-75。デモ用の操作）', () => {
  it('別のコースに変えても、支援者は増えず（75 人のまま）、確保額だけが変わる。送り直しもしない', () => {
    const h = harness(6);
    passStart(h);
    vi.advanceTimersByTime(3500);
    h.a.closeGift();
    h.a.runAcct('main', 'acct'); // 前方の席の条件（メイン口座・預金 100,000円）をそろえる
    h.a.runAcct('deposit', 'acct', 80_000);
    h.a.applyCourse('front');
    vi.advanceTimersByTime(200);
    expect(h.state().course).toBe('front');
    expect(h.view().status.supporters).toBe(75);
    expect(h.view().my?.price).toBe(21000);
    expect(h.joins).toHaveLength(1);
    expect(h.state().toast?.text).toBe(
      'コースを「前方の席」に変えました。確保は21,000円になりました',
    );
  });
});

describe('会場の決め方（どの推しでも、久留米市・久留米の既定の会場に固定）', () => {
  it('5 組のどの推しを選んでも、市は久留米市・会場は Cボックスで、申し込む', () => {
    for (const oshi of ['tech0', 'krs48', 'riji', 'terao', 'heisei'] as const) {
      const h = harness(4);
      h.a.startPick('oshi', oshi);
      passStart(h);
      expect(h.state()).toMatchObject({ oshiId: oshi, city: '久留米市', venueId: 'cbox' });
      expect(h.view().cond.city).toBe('久留米市');
    }
  });
});

describe('人数の表示と達成率（I-16・I-17）', () => {
  it('支援者 74・75・76 人で、あと 19・18・17 人・79・80・81%（A-18・I-16）', () => {
    const h = harness(4, { server: 0 });
    const at = (n: number) => {
      h.setServer(n);
      return h.view().status;
    };
    expect(at(0)).toMatchObject({ supporters: 74, left: 19, pct: 79 });
    expect(at(1)).toMatchObject({ supporters: 75, left: 18, pct: 80 });
    expect(at(2)).toMatchObject({ supporters: 76, left: 17, pct: 81 });
    expect(at(0).fill).toBeCloseTo((74 / 93) * 100, 1);
  });

  it('最低人数を超えると、あと 0 人のまま、達成率は 100% を超えた数字をそのまま出し、棒は 100% で止まる（I-17）', () => {
    const h = harness(4, { minPeople: 70, server: 1 });
    expect(h.view().status).toMatchObject({ supporters: 75, left: 0, pct: 107, fill: 100 });
  });
});

describe('共有メーターの取得の依頼（取得の契機。I-122）', () => {
  it('コースを選ぶ画面（2 / 2）に入ったときに 1 回、公演が変わったときに 1 回、依頼する', () => {
    const h = harness(4);
    expect(h.fetches).toEqual([]);
    h.a.startPick('oshi', 'krs48');
    h.a.startNext(); // 2 / 2
    expect(h.fetches).toEqual(['course-select']);
    h.a.startNext(); // 目指すコースを決める（公演は krs48:cbox に変わる）
    expect(h.fetches).toEqual(['course-select', 'performance-changed']);
  });

  it('G2-04 コースを選ぶ画面（2 / 2）に入ったときの取得は、選び直した（まだ確定していない）公演を指す', () => {
    const h = harness(4);
    h.a.startPick('oshi', 'krs48');
    h.a.startNext(); // 2 / 2
    const pending = h.fetchPids[0];
    expect(pending).toBe('krs48:cbox');
    expect(pending).not.toBe('tech0:cbox'); // 確定前の state.oshiId・venueId（古い公演）ではない
    h.a.startNext(); // 確定
    expect(h.state().oshiId).toBe('krs48');
    expect(pending).toBe(performanceIdOf(h.state().oshiId, h.state().venueId));
  });

  it('G2-04 選び直していなければ、2 / 2 の取得は、いまの公演（tech0:cbox）を指す', () => {
    const h = harness(4);
    h.a.startNext();
    expect(h.fetchPids).toEqual(['tech0:cbox']);
  });
});

describe('読み上げの領域（同じ文が続いても、2 回目が伝わる）', () => {
  it('同じ文を続けて伝えると、見えない印を付け替えて、領域の中身を変える（文そのものは同じ）', () => {
    const h = harness(4);
    const seen: string[] = [];
    h.store.subscribe(() => seen.push(h.state().live));
    h.a.announce('呼んだ仲間が申し込みました。');
    h.a.announce('呼んだ仲間が申し込みました。');
    h.a.announce('呼んだ仲間が申し込みました。');
    const lives = seen.filter((t) => t.startsWith('呼んだ仲間'));
    expect(new Set(lives).size).toBe(2); // 3 回目は 1 回目と同じ形に戻る。連続した 2 回は、必ず違う
    expect(lives[0]).not.toBe(lives[1]);
    expect(lives[1]).not.toBe(lives[2]);
    expect(lives.every((t) => t.replace('\u200b', '') === '呼んだ仲間が申し込みました。')).toBe(
      true,
    );
  });
});
