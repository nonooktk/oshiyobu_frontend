// ファン向けの基準の流れと、前方の席を目指す流れ（上層: A-15〜A-18・A-24〜A-27・A-34・A-35・A-40・A-41・A-45・A-46・I-23・I-24・I-74）。
// 通信は無い。共有メーターは、仮の I/F のメモリの値（サーバーへの申し込みの合図は、画面の人数に足されないことを確かめる）。
import { describe, expect, it, vi } from 'vitest';
import { getAppStore } from '../../../src/fan/store/FanProvider';
import { createLink } from '../../../src/shared/link';
import { asBroadcastChannel, FakeChannel } from '../../helpers/fakeChannel';
import {
  act,
  api,
  btn,
  click,
  closeGiftAfterFx,
  fireEvent,
  homeActionButtons,
  layer,
  mountFan,
  openNextPage,
  passStart,
  screen,
  tick,
  setupFanTest,
  within,
} from './helpers';

setupFanTest();

/** ホームの熱量のゲージ（読み上げ用の文。人数・割合の数字は入らない。G-08） */
const meter = () => screen.getByRole('img', { name: /^開催熱量。/ });
/** 内部の人数は、画面の文ではなく、ストアの状態で確かめる（ファン向けの画面に人数を出さないため） */
const supporters = () => getAppStore().view().status.supporters;
const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.dynamicImportSettled();
  });
};
const seatCard = (name: string) =>
  screen
    .getAllByRole('button')
    .find(
      (b) => b.hasAttribute('aria-pressed') && (b.textContent ?? '').includes(name),
    ) as HTMLElement;

describe('基準の流れ（人物 4・tech0・久留米市・Cボックス）', () => {
  it('はじめの画面は 2 つ（推し → コース）。「次へ」で 1 / 2 → 2 / 2 と進み、初めから選んである。市を選ぶ画面は無い（A-15・A-16・I-74）', () => {
    mountFan('?p=4');
    expect(screen.getByRole('heading', { name: '推しを選ぶ' })).toBeTruthy();
    expect(btn('Tech0サステナアイドル').getAttribute('aria-pressed')).toBe('true');
    click('次へ');
    expect(screen.getByRole('heading', { name: '目指すコースを選ぶ' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '呼びたい市を選ぶ' })).toBeNull();
    expect(seatCard('通常の席').getAttribute('aria-pressed')).toBe('true');
    expect(btn('このコースを目指して始める')).toBeTruthy();
    // 会場の説明は、コースを選ぶ画面にある（久留米の既定の会場。数字は席数だけ）
    expect(screen.getByText(/会場: 久留米シティプラザ Cボックス（144席）/)).toBeTruthy();
  });

  it('はじめる → 積み増す → 申し込むで、内部の人数が 74 人から 75 人（80%）に進み、熱量は ヒートアップ から FEVER 目前 になる（A-16・A-18）', async () => {
    mountFan('?p=4');
    expect(screen.getByRole('heading', { name: '推しを選ぶ' })).toBeTruthy();
    expect(supporters()).toBe(74);
    passStart();
    expect(supporters()).toBe(75);
    expect(getAppStore().view().status).toMatchObject({ pct: 80, left: 18 });
    expect(meter().getAttribute('aria-label')).toBe('開催熱量。FEVER 目前。あと一歩');
    expect(screen.getByText('デモ用の架空データ')).toBeTruthy();
  });

  it('ホームのボタンは主のボタンの 1 つだけ（A-34。申し込む前。SNS の副のボタンは、申し込んだあと）。申し込む前の知らせは、申し込むと消える', () => {
    mountFan('?p=4');
    click('次へ');
    fireEvent.click(seatCard('前方の席'));
    click('このコースを目指して始める');
    expect(screen.getByText('まだチケットと特典は入手できていません！')).toBeTruthy();
    expect(homeActionButtons()).toHaveLength(1);
    // 初めは口座なし: いまやることは、前方の席を目指しても「推し活定期をはじめる」の 1 つ
    expect(homeActionButtons()[0]).toMatch(/^推し活定期をはじめる/);
  });

  it('申し込むと 0.65 秒後に FEVER 目前の演出が出て、押すと飛ばせて、特典の絵が出る（A-40・A-41）', async () => {
    mountFan('?p=4');
    passStart();
    expect(layer('fx')).toBeNull();
    await tick(650);
    expect(layer('fx')?.textContent).toContain('FEVER 目前！');
    fireEvent.click(layer('fx') as HTMLElement); // 押すと飛ばせる
    await tick(10);
    expect(layer('fx')).toBeNull();
    expect(layer('gift')).not.toBeNull();
    expect(screen.getByRole('heading', { name: '特典 1/3 が開きました' })).toBeTruthy();
  });

  it('申し込んだあとの「次のアクション」には、仲間を呼ぶとSNSで広めるだけが並ぶ（A-35）', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    openNextPage();
    const rows = screen
      .getAllByRole('button')
      .map((b) => b.textContent ?? '')
      .filter((t) =>
        /^(仲間を呼ぶ|SNSで広める|メイン口座にする|預金を積み増す|推し活定期をはじめる)/.test(t),
      );
    expect(rows.map((t) => t.replace(/(仲間を呼ぶ|SNSで広める).*/, '$1'))).toEqual([
      '仲間を呼ぶ',
      'SNSで広める',
    ]);
  });

  it('メニューから「申し込みをやめる」まで 2 操作で届き、やめると 74 人に戻る。取り消しは送らない（A-45・A-46・I-25）', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    click('メニュー');
    await act(async () => {
      await import('../../../src/fan/pages/Pages');
    });
    click('申し込みをやめる');
    expect(screen.getByRole('heading', { name: '申し込みをやめますか？' })).toBeTruthy();
    await act(async () => {
      await import('../../../src/fan/layers/Sheets');
    });
    fireEvent.click(
      within(layer('sheet') as HTMLElement).getByRole('button', { name: '申し込みをやめる' }),
    );
    await tick(10);
    expect(supporters()).toBe(74);
    expect(
      screen.getAllByText(/申し込みをやめました。確保は解除され、負担は0円です。/).length,
    ).toBeGreaterThan(0);
  });
});

describe('前方の席を目指す流れ（推し活定期 → メイン口座 → 預金の入力 → 申し込む。A-24〜A-27・I-23）', () => {
  /** 前方の席を目指して、ホームまで進む */
  function toFront(): void {
    mountFan('?p=4');
    click('次へ');
    fireEvent.click(seatCard('前方の席'));
    click('このコースを目指して始める');
  }

  it('ホームの主のボタンが、推し活定期 → メイン口座 → 預金を積み増す（額の入力）→ 申し込むと、1 つずつ変わる', async () => {
    toFront();
    expect(homeActionButtons()).toHaveLength(1);
    for (const [label, praise] of [
      [/^推し活定期をはじめる/, 'はじめてくれてありがとう。'],
      [/^メイン口座にする/, 'メイン口座にしてくれてありがとう。'],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(layer('ach')?.textContent).toContain(praise); // 押すたびに、控えめな短い称賛の札が出る
      fireEvent.pointerDown(document.body); // 押すと消える（連続で押せる）
      expect(layer('ach')).toBeNull();
    }
    // 預金を積み増す: 額の入力のシートが開き、条件にちょうど届く額（前方の席は 100,000円）が初めから入っている
    fireEvent.click(screen.getByRole('button', { name: /^預金を積み増す/ }));
    await settle();
    const box = screen.getByRole('textbox', { name: '積み増す額（円）' }) as HTMLInputElement;
    expect(box.value).toBe('100000');
    fireEvent.click(screen.getByRole('button', { name: '積み増す' }));
    expect(layer('sheet')).toBeNull(); // 条件に届いたら、シートは閉じる
    expect(layer('ach')?.textContent).toContain('申し込めるようになりました');
    fireEvent.click(screen.getByRole('button', { name: /^申し込む/ }));
    expect(supporters()).toBe(75);
  });

  it('次のアクションの画面でも、いま 1 つだけが並び、押すと短い称賛が出て、条件の ✓ が付く', async () => {
    toFront();
    openNextPage();
    expect(screen.getByText('推し活定期をはじめる', { selector: 'button b' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^推し活定期をはじめる/ }));
    expect(layer('ach')?.textContent).toContain('はじめてくれてありがとう。');
    fireEvent.click(screen.getByRole('button', { name: /^メイン口座にする/ }));
    expect(layer('ach')?.textContent).toContain('メイン口座にしてくれてありがとう。');
    expect(screen.getByText('預金 あと 100,000円（いま 0円／100,000円以上）')).toBeTruthy();
    expect(screen.getByText('メイン口座にした', { selector: 'li span' })).toBeTruthy();
  });

  it('C-04 条件がそろった札の最中に「申し込む」を押すと、押した瞬間に札が消え、押した先のボタンは入れ替わらず、そのクリックで申し込める', () => {
    toFront();
    act(() => {
      const { actions } = getAppStore();
      actions.runAcct('teiki', 'home');
      actions.runAcct('main', 'home');
      actions.runAcct('deposit', 'home', 100_000); // 条件がそろう（短い称賛の札）
    });
    expect(layer('ach')?.textContent).toContain('申し込めるようになりました');
    const apply = screen.getByRole('button', { name: /^申し込む/ });
    fireEvent.pointerDown(apply); // マウスは、押す（pointerdown）と離す（pointerup）のあいだに、押した先が同じ要素のままでないと、クリックにならない
    expect(layer('ach')).toBeNull(); // 押した次の描画で、札は消える（F-21）
    expect(apply.isConnected).toBe(true);
    expect(screen.getByRole('button', { name: /^申し込む/ })).toBe(apply);
    fireEvent.pointerUp(apply);
    fireEvent.click(apply);
    expect(supporters()).toBe(75);
  });

  it('動きを減らす設定では、称賛の札は動かさず（色と文字だけ）、短くする（2 秒）（N-04）', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: /reduce/.test(q), media: q }));
    try {
      toFront();
      fireEvent.click(screen.getByRole('button', { name: /^推し活定期をはじめる/ }));
      const ach = layer('ach') as HTMLElement;
      expect(ach.querySelectorAll('i')).toHaveLength(0);
      expect(ach.style.getPropertyValue('--ach-ms')).toBe('2000ms');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('申し込み済みの再押下・コース変更（A-24・I-24）', () => {
  it('同じコースの「申し込み中」は押せない。上位コースは条件がそろうと「このコースに変える（デモ用）」になる', async () => {
    mountFan('?p=6');
    passStart();
    await closeGiftAfterFx();
    act(() => {
      const { actions } = getAppStore();
      actions.runAcct('main', 'home'); // 前方の席の条件（メイン口座・預金 100,000円）をそろえる
      actions.runAcct('deposit', 'home', 80_000);
      actions.clearAch();
    });
    click('メニュー');
    await act(async () => {
      await import('../../../src/fan/pages/Pages');
    });
    click('応援コース');
    expect(
      screen.getByRole('button', { name: 'このコースで申し込み中' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(screen.getAllByRole('button', { name: 'このコースに変える（デモ用）' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '条件がそろうと申し込めます' })).toHaveLength(2);
  });
});

describe('共有メーターの reset と連動（I-64・I-126・A-62 のファン向け側）', () => {
  it('サーバーの人数に追いつく: 取れた人数（ほかの端末の申し込み）を足して、自分の分を二重に数えない（I-129）', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    await tick(3000);
    expect(api.joined).toBe(1); // 自分の申し込みが、サーバーに 1 回だけ数えられた
    expect(supporters()).toBe(75);
    api.joined += 1; // ほかの端末が 1 人申し込んだ
    await tick(4000);
    expect(supporters()).toBe(76);
  });

  it('発表者の reset を検知すると 74 人に戻り、「未申し込み」になって、同じコースを押し直して申し込める', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    await tick(3000);
    expect(supporters()).toBe(75);
    api.reset();
    await tick(6000); // 次の取得で、resetAt の変化を見つける（3 秒前後）
    expect(supporters()).toBe(74);
    expect(screen.getByText('まだチケットと特典は入手できていません！')).toBeTruthy();
    click(/^申し込む/); // ホームの主のボタン（その場で申し込む）
    await tick(3000);
    expect(api.joined).toBe(1);
    expect(supporters()).toBe(75);
  });

  it('申し込みの応答だけが遅れ、あとに出した取得の応答より遅く着いても、75 人のまま（76 人にならない）。reset を検知すると 74 人に戻る（G2-01）', async () => {
    mountFan('?p=4');
    api.latency = 2500; // 申し込み（POST）だけを遅くする（取得は、このあとすぐ 0 秒に戻す）
    passStart();
    api.latency = 0;
    await closeGiftAfterFx();
    await tick(7000);
    expect(api.joined).toBe(1);
    expect(supporters()).toBe(75);
    api.reset();
    await tick(6000);
    expect(supporters()).toBe(74);
    expect(screen.getByText('まだチケットと特典は入手できていません！')).toBeTruthy();
  });

  it('事務所向けの「デモを最初に戻す」を受けた連動で、はじめの画面に戻る。共有のメーターには触らない', async () => {
    FakeChannel.reset();
    vi.stubGlobal('BroadcastChannel', asBroadcastChannel);
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    await tick(3000);
    const joinedBefore = api.joined;
    createLink(asBroadcastChannel).broadcastResetAll(); // 事務所向けのページ
    await tick(10);
    expect(screen.getByRole('heading', { name: '推しを選ぶ' })).toBeTruthy();
    expect(api.joined).toBe(joinedBefore);
  });

  it('事務所向けで熊本市の会場を選んでも、ファン向けは久留米市のまま（事務所向けの選択は、ファン向けの市に伝わらない）', async () => {
    FakeChannel.reset();
    vi.stubGlobal('BroadcastChannel', asBroadcastChannel);
    mountFan('?p=4');
    const office = createLink(asBroadcastChannel);
    await act(async () => {
      office.publishOffice({
        venueId: 'KMM-002',
        costs: { venue: 60000, prod: 100000, fee: 250000, travel: 120000, profit: 120000 },
        minPeople: null,
      });
      vi.advanceTimersByTime(200);
    });
    click('次へ');
    expect(screen.getByText(/会場: 久留米シティプラザ Cボックス/)).toBeTruthy();
    expect(screen.queryByText(/熊本市/)).toBeNull();
  });
});
