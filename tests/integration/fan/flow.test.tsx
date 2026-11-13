// ファン向けの基準の流れと、前方の席を目指す流れ（上層: A-15〜A-18・A-24〜A-27・A-34・A-35・A-40・A-41・A-45・A-46・I-23・I-24・I-74）。
// 通信は無い。共有メーターは、仮の I/F のメモリの値（サーバーへの申し込みの合図は、画面の人数に足されないことを確かめる）。
import { describe, expect, it, vi } from 'vitest';
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
  passStart,
  screen,
  tick,
  setupFanTest,
  within,
} from './helpers';

setupFanTest();

const meter = () => screen.getByRole('img', { name: /^支援者\d+人、最低人数/ });
const seatCard = (name: string) =>
  screen
    .getAllByRole('button')
    .find(
      (b) => b.hasAttribute('aria-pressed') && (b.textContent ?? '').includes(name),
    ) as HTMLElement;

describe('基準の流れ（人物 4・tech0・久留米市・Cボックス）', () => {
  it('はじめの画面は「次へ」で 1 / 3 → 2 / 3 → 3 / 3 と進み、初めから選んである（A-15・A-16・I-74）', () => {
    mountFan('?p=4');
    expect(screen.getByRole('heading', { name: '推しを選ぶ' })).toBeTruthy();
    expect(btn('Tech0サステナアイドル').getAttribute('aria-pressed')).toBe('true');
    click('次へ');
    expect(screen.getByRole('heading', { name: '呼びたい市を選ぶ' })).toBeTruthy();
    expect(btn('久留米市').getAttribute('aria-pressed')).toBe('true');
    click('次へ');
    expect(screen.getByRole('heading', { name: '目指すコースを選ぶ' })).toBeTruthy();
    expect(seatCard('通常の席').getAttribute('aria-pressed')).toBe('true');
    expect(btn('この内容で申し込む')).toBeTruthy();
  });

  it('3 回押すとホームに着き、支援者が 74 人から 75 人・80%・あと 18 人に進む（A-16・A-18）', async () => {
    mountFan('?p=4');
    expect(screen.getByRole('heading', { name: '推しを選ぶ' })).toBeTruthy();
    passStart();
    expect(meter().getAttribute('aria-label')).toBe(
      '支援者75人、最低人数93人。ライブ開催まで あと18人。達成率80%',
    );
    expect(screen.getByText('デモ用の架空データ')).toBeTruthy();
  });

  it('ホームのボタンは「次のアクション」の 1 つだけ（A-34）。申し込む前の知らせは、申し込むと消える', () => {
    mountFan('?p=4');
    click('次へ');
    click('次へ');
    fireEvent.click(seatCard('前方の席'));
    click('このコースを目指して始める');
    expect(screen.getByText('まだチケットと特典は入手できていません！')).toBeTruthy();
    expect(homeActionButtons()).toHaveLength(1);
    expect(homeActionButtons()[0]).toMatch(/^次のアクション/);
  });

  it('申し込むと 0.65 秒後に 80% の演出が出て、押すと飛ばせて、特典の絵が出る（A-40・A-41）', async () => {
    mountFan('?p=4');
    passStart();
    expect(layer('fx')).toBeNull();
    await tick(650);
    expect(layer('fx')?.textContent).toContain('80%');
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
    click(/^次のアクション/);
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
    expect(meter().getAttribute('aria-label')).toContain('支援者74人');
    expect(
      screen.getAllByText(/申し込みをやめました。確保は解除され、負担は0円です。/).length,
    ).toBeGreaterThan(0);
  });
});

describe('前方の席を目指す流れ（人物 4。A-24〜A-27・I-23）', () => {
  it('目指して始め、メイン口座 → 預金を積み増す → 推し活定期と進めると、条件がそろって申し込める', async () => {
    mountFan('?p=4');
    click('次へ');
    click('次へ');
    fireEvent.click(seatCard('前方の席'));
    click('このコースを目指して始める');
    click(/^次のアクション/);
    expect(screen.getByText('預金 あと 10,000円（いま 90,000円／100,000円以上）')).toBeTruthy();
    expect(screen.getByText('メイン口座にする', { selector: 'li span' })).toBeTruthy();

    for (const label of [
      /^メイン口座にする/,
      /^預金を積み増す ＋10,000円/,
      /^推し活定期をはじめる/,
    ]) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(layer('ach')).not.toBeNull(); // 押すたびに、画面いっぱいのエフェクトが出る
      fireEvent.pointerDown(document.body); // 押すと消える（連続で押せる）
      expect(layer('ach')).toBeNull();
    }
    expect(screen.getByText('条件がそろいました。')).toBeTruthy();
    const first = screen.getByRole('button', { name: /^前方の席に申し込む/ });
    fireEvent.click(first);
    expect(meter().getAttribute('aria-label')).toContain('支援者75人');
  });

  it('条件がそろうと、条件のチェックが ✓ になり、「条件がそろいました」の演出（全部そろった）が出る', async () => {
    mountFan('?p=4');
    click('次へ');
    click('次へ');
    fireEvent.click(seatCard('前方の席'));
    click('このコースを目指して始める');
    click(/^次のアクション/);
    fireEvent.click(screen.getByRole('button', { name: /^メイン口座にする/ }));
    expect(layer('ach')?.textContent).toContain('条件を1つクリア');
    fireEvent.click(screen.getByRole('button', { name: /^預金を積み増す/ }));
    expect(layer('ach')?.textContent).toContain('条件が');
    expect(layer('ach')?.textContent).toContain('そろいました！');
    expect(layer('ach')?.textContent).toContain('前方の席に申し込めます');
  });

  it('動きを減らす設定では、紙吹雪と閃光を出さず、短いフェードだけ（N-04）', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: /reduce/.test(q), media: q }));
    try {
      mountFan('?p=4');
      click('次へ');
      click('次へ');
      fireEvent.click(seatCard('前方の席'));
      click('このコースを目指して始める');
      click(/^次のアクション/);
      fireEvent.click(screen.getByRole('button', { name: /^メイン口座にする/ }));
      const ach = layer('ach') as HTMLElement;
      expect(ach.querySelectorAll('i')).toHaveLength(0); // 紙吹雪 0
      expect(ach.style.getPropertyValue('--ach-ms')).toBe('1200ms'); // 短い（1.2 秒）
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('申し込み済みの再押下・コース変更（A-24・I-24）', () => {
  it('同じコースの「申し込み中」は押せない。上位コースは条件がそろうと「このコースに変える（デモ用）」になる', async () => {
    mountFan('?p=6'); // 預金 120,000円・メイン口座あり → 前方の席まで申し込める
    passStart();
    await closeGiftAfterFx();
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
    expect(meter().getAttribute('aria-label')).toContain('支援者75人');
    api.joined += 1; // ほかの端末が 1 人申し込んだ
    await tick(4000);
    expect(meter().getAttribute('aria-label')).toContain('支援者76人');
  });

  it('発表者の reset を検知すると 74 人に戻り、「未申し込み」になって、同じコースを押し直して申し込める', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    await tick(3000);
    expect(meter().getAttribute('aria-label')).toContain('支援者75人');
    api.reset();
    await tick(6000); // 次の取得で、resetAt の変化を見つける（3 秒前後）
    expect(meter().getAttribute('aria-label')).toContain('支援者74人');
    expect(screen.getByText('まだチケットと特典は入手できていません！')).toBeTruthy();
    click(/^次のアクション/);
    fireEvent.click(screen.getByRole('button', { name: /^通常の席に申し込む/ }));
    await tick(3000);
    expect(api.joined).toBe(1);
    expect(meter().getAttribute('aria-label')).toContain('支援者75人');
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

  it('事務所向けで熊本市の会場を選ぶと、まだ選び直していないはじめの画面の市が、熊本市になる（A-17・I-110）', async () => {
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
    expect(btn('熊本市').getAttribute('aria-pressed')).toBe('true');
  });
});
