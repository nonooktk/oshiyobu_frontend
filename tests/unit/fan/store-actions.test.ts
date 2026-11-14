// 口座と預金の 3 つの行動・成立の表示・やめる・条件の変更・リセットの確かめ（上層: A-07・A-26・A-27・A-39・A-61・A-64〜A-66・I-18・I-22・I-25・I-26）。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { performanceIdOf } from '../../../src/core';
import { nextViewOf } from '../../../src/fan/domain/view';
import { harness, passStart } from './helpers';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('口座と預金の 3 つの行動（I-22・A-26）', () => {
  it('預金を積み増すと、次に開くコースの預金までちょうど増え（90,000 → 100,000 → 300,000 → 1,000,000円）、4 回目は押せない', () => {
    const h = harness(4);
    const seen: number[] = [];
    for (let i = 0; i < 3; i++) {
      h.a.runAcct('deposit', 'acct');
      seen.push(h.state().acct.deposit);
    }
    expect(seen).toEqual([100000, 300000, 1000000]);
    expect(h.a.acctDone('deposit')).toBe(true);
    h.a.runAcct('deposit', 'acct');
    expect(h.state().acct.deposit).toBe(1000000);
    expect(h.state().acct.times).toBe(3);
  });

  it('メイン口座にしても預金は変わらない。推し活定期は +5,000円で 1 回だけ（条件には入らない）', () => {
    const h = harness(4);
    h.a.runAcct('main', 'acct');
    expect(h.state().acct).toMatchObject({ pay: true, deposit: 90000 });
    h.a.runAcct('teiki', 'acct');
    h.a.runAcct('teiki', 'acct');
    expect(h.state().acct.deposit).toBe(95000);
    expect(h.state().done).toMatchObject({ main: true, teiki: true });
  });

  it('押すたびに、条件の達成のエフェクトが出る。全部そろったときは「そろいました」の種類（A-26・A-27）', () => {
    const h = harness(4);
    h.a.go('home');
    h.a.aimCourse('front');
    h.a.runAcct('main', 'next');
    expect(h.state().ach).toMatchObject({ kind: 'one', title: '達成！', small: '条件を1つクリア' });
    h.a.runAcct('deposit', 'next');
    expect(h.state().ach).toMatchObject({
      kind: 'all',
      title: '条件が',
      title2: 'そろいました！',
      sub: '前方の席に申し込めます',
    });
    expect(h.state().fresh).toMatchObject({ all: true, act: 'deposit' });
    // 押すと消える。待っていた ✓ の動きは、すぐ始まる（待ち時間 0）
    h.a.clearAch();
    expect(h.state().ach).toBeNull();
    expect(h.state().ckDelay).toBe(0);
  });

  it('条件の額を越えない預金の増え（推し活定期の 5,000円）は、「ナイス！」の種類', () => {
    const h = harness(4);
    h.a.aimCourse('front');
    h.a.runAcct('teiki', 'next');
    expect(h.state().ach).toMatchObject({ kind: 'one', title: 'ナイス！' });
  });

  it('全画面の演出・特典・シートが開いているあいだは、条件の達成のエフェクトを重ねない', () => {
    const h = harness(4);
    h.a.openShare('friend');
    h.a.runAcct('main', 'acct');
    expect(h.state().ach).toBeNull();
  });

  it('動きを減らす設定では、✓ を待たせず（0 秒）、紙吹雪を出さない', () => {
    const h = harness(4, { reduceMotion: true });
    h.a.runAcct('main', 'acct');
    expect(h.state().ckDelay).toBe(0);
    expect(h.state().ach?.confetti).toHaveLength(0);
    expect(h.state().ach?.ms).toBe(1200);
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
    expect(top && top.kind === 'fx' && top.fx.title).toBe('ごほうび');
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
  it('申し込む前で条件がそろっていないときは、残りの条件を言い、メイン口座 → 預金 → 推し活定期の順に並べる', () => {
    const h = harness(4);
    h.a.aimCourse('front');
    const v = nextViewOf(h.view());
    expect(v.hint).toBe('前方の席まで、残りは 預金 10,000円・メイン口座');
    expect(v.rows.map((r) => r.id)).toEqual(['main', 'deposit', 'teiki']);
    expect(v.rows[1]?.label).toBe('預金を積み増す ＋10,000円');
  });

  it('条件がそろうと、先頭に「{コース}に申し込む」が出て、押すと支援者が 74 人から 75 人になる説明が付く', () => {
    const h = harness(4);
    h.a.aimCourse('front');
    h.a.runAcct('main', 'next');
    h.a.runAcct('deposit', 'next');
    const v = nextViewOf(h.view());
    expect(v.rows[0]).toMatchObject({ id: 'apply', label: '前方の席に申し込む' });
    expect(v.hint).toBe('前方の席（21,000円）に申し込めます');
  });

  it('申し込んだあとは、仲間を呼ぶ・SNSで広めるだけ。成立後は「仲間に知らせる」（B4）', () => {
    const h = harness(4);
    passStart(h);
    expect(nextViewOf(h.view()).rows.map((r) => r.id)).toEqual(['friend', 'share']);
    expect(nextViewOf(h.view()).rows[0]?.hint).toBe('仲間を呼ぶと、あと18人が17人に');
    const h2 = harness(4, { server: 19 });
    passStart(h2);
    expect(nextViewOf(h2.view()).rows.map((r) => r.id)).toEqual(['notice']);
  });
});

describe('条件の変更・引き継ぎ（A-39・I-26。デモ用の操作）', () => {
  it('推し・市を変えると、開いた特典・達成の記録・呼んだ仲間・口座は残り、申し込み・目指すコース・80% の済みは取り直す', () => {
    const h = harness(4);
    passStart(h);
    vi.advanceTimersByTime(3500);
    h.a.closeGift();
    h.a.runAcct('main', 'acct');
    h.a.go('opt');
    h.a.pickPend('oshi', 'krs48');
    h.a.pickPend('city', '熊本市');
    h.a.applyChange();
    const s = h.state();
    expect(s).toMatchObject({
      oshiId: 'krs48',
      city: '熊本市',
      course: null,
      aim: null,
      friends: 0,
      milestoneShown: false,
      custom: true,
    });
    expect(s.gifts).toEqual([true, false, false]);
    expect(s.done).toMatchObject({ join: true, main: true });
    expect(s.acct).toMatchObject({ pay: true, deposit: 90000 });
    expect(s.carry).toMatchObject({
      gifts: 1,
      doneCount: 2,
      held: 7000,
      venueName: 'Restaurant Bar CIB',
    });
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
  it('ファン向けだけが、人物の初めの値のはじめの画面（1 / 3）に戻る。あとから出るはずの演出も止まる', () => {
    const h = harness(6);
    passStart(h);
    vi.advanceTimersByTime(200);
    h.a.resetFan();
    const s = h.state();
    expect(s.page).toBe('start');
    expect(s.start).toMatchObject({ step: 0, oshiId: 'tech0', city: '久留米市', seat: 'normal' });
    expect(s).toMatchObject({
      course: null,
      gifts: [false, false, false],
      done: {},
      called: 0,
      layers: [],
    });
    expect(s.acct).toMatchObject({ deposit: 120000, pay: true }); // 人物 6 の初めの値
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
    h.a.openShare('friend');
    h.a.closeShare();
    vi.advanceTimersByTime(2000);
    expect(h.view().status.supporters).toBe(76);
    h.a.serverReset(true);
    h.setServer(0);
    const s = h.state();
    expect(s.course).toBeNull();
    expect(s.friends).toBe(0);
    expect(s.called).toBe(1); // 「呼んだ仲間」の記録は変わらない
    expect(s.done).toMatchObject({ join: true, friend: true });
    expect(s.gifts[0]).toBe(true);
    expect(s.acct.deposit).toBe(90000);
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

describe('事務所向けとの連動（設計 D-44。仮の I/F で、受け口だけ確かめる）', () => {
  it('まだ選び直していなければ、はじめの画面の初めの値が、事務所向けの会場（熊本市）と人物 4 の口座に替わる（A-17・F-15）', () => {
    const h = harness(6); // 預金 120,000円・メイン口座あり（人物 6）
    h.a.applyOffice('KMM-002');
    const s = h.state();
    expect(s).toMatchObject({ oshiId: 'tech0', city: '熊本市', venueId: 'KMM-002' });
    expect(s.start).toMatchObject({
      city: '熊本市',
      baseCity: '熊本市',
      oshiId: 'tech0',
      touched: false,
    });
    expect(s.acct).toMatchObject({ deposit: 90000, pay: false }); // 連動中の初めの値は、人物 4
  });

  it('利用者が選び直したあとは、事務所向けで会場を選び直しても、ファン向けは切り替わらない（決定 14）', () => {
    const h = harness(4);
    h.a.startPick('city', '佐賀市');
    h.a.applyOffice('KMM-002');
    expect(h.state().start?.city).toBe('佐賀市');
    expect(h.state().venueId).toBe('cbox');
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
    const h = harness(6); // 預金 120,000円・メイン口座あり → 前方の席まで申し込める
    passStart(h);
    vi.advanceTimersByTime(3500);
    h.a.closeGift();
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

describe('会場の決め方（事務所向けと連動した会場を、勝手に替えない）', () => {
  it('連動した会場（RISE UP）で始まり、市を選び直さなければ、その会場のまま申し込む', () => {
    const h = harness(4);
    h.a.applyOffice('riseup');
    expect(h.state()).toMatchObject({ city: '久留米市', venueId: 'riseup' });
    passStart(h);
    expect(h.state().venueId).toBe('riseup');
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
  it('コースを選ぶ画面（3 / 3）に入ったときに 1 回、公演が変わったときに 1 回、依頼する', () => {
    const h = harness(4);
    h.a.startNext(); // 2 / 3
    expect(h.fetches).toEqual([]);
    h.a.startPick('oshi', 'krs48');
    h.a.startNext(); // 3 / 3
    expect(h.fetches).toEqual(['course-select']);
    h.a.startNext(); // 申し込む（公演は krs48:cbox に変わる）
    expect(h.fetches).toEqual(['course-select', 'performance-changed']);
  });

  it('G2-04 コースを選ぶ画面（3 / 3）に入ったときの取得は、選び直した（まだ確定していない）公演を指す', () => {
    const h = harness(4);
    h.a.startNext(); // 2 / 3
    h.a.startPick('oshi', 'krs48');
    h.a.startPick('city', '福岡市');
    h.a.startNext(); // 3 / 3
    const pending = h.fetchPids[0];
    expect(pending).toBeDefined();
    expect(pending).not.toBe('tech0:cbox'); // 確定前の state.oshiId・venueId（古い公演）ではない
    h.a.startNext(); // 確定
    expect(h.state().oshiId).toBe('krs48');
    expect(pending).toBe(performanceIdOf(h.state().oshiId, h.state().venueId));
  });

  it('G2-04 選び直していなければ、3 / 3 の取得は、いまの公演（tech0:cbox）を指す', () => {
    const h = harness(4);
    h.a.startNext();
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
