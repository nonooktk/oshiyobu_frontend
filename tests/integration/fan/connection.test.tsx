// ファン向けの、サーバーが止まっている・遅いときと、遅れて読む塊が読めないときの画面（上層: A-59・A-60・I-46・I-52・I-55・I-94・I-120・I-25・I-30・I-21）。
// 共有の部品（メーターの仕組み）は本物で、サーバーだけ偽物（FakeApi）。画面は通信を待たない。
import { describe, expect, it, vi } from 'vitest';
import { PREFETCH_IMAGES, PREFETCH_PLAN } from '../../../src/fan/art/registry';
import { configurePrefetch } from '../../../src/shared/prefetch';
import {
  act,
  api,
  btn,
  click,
  closeGiftAfterFx,
  fireEvent,
  layer,
  mountFan,
  passStart,
  screen,
  setupFanTest,
  tick,
  within,
} from './helpers';

setupFanTest();

const meter = () => screen.getByRole('img', { name: /^支援者\d+人、最低人数/ });
const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.dynamicImportSettled();
  });
};

describe('サーバーが止まっている・遅いとき（N-09・N-21・N-23）', () => {
  it('サーバーが止まっていても、はじめの画面が初期値で出て、エラーを出さず、申し込むと端末の中で 75 人に進む（A-59・A-60・I-46・I-52）', async () => {
    api.down = true;
    mountFan('?p=4');
    expect(screen.getByRole('heading', { name: '推しを選ぶ' })).toBeTruthy();
    passStart();
    expect(meter().getAttribute('aria-label')).toContain('支援者75人');
    await closeGiftAfterFx();
    await tick(20000);
    expect(meter().getAttribute('aria-label')).toContain('支援者75人'); // 最後に取れた値（なければ初期値）のまま
    expect(screen.queryByText(/エラー|失敗|通信/)).toBeNull();
  });

  it('応答が 10 秒かかっても、画面は待たずに進む（I-94）', async () => {
    api.latency = 10000;
    mountFan('?p=4');
    passStart();
    expect(meter().getAttribute('aria-label')).toContain('支援者75人');
    await tick(700);
    expect(layer('fx')?.textContent).toContain('80%'); // 演出も、サーバーを待たずに出る
  });

  it('止まっているあいだに申し込んだ分は、戻ったときに 1 回だけ数えられ、自分の分が二重にならない（A4・I-55）', async () => {
    api.down = true;
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    await tick(30000);
    expect(api.joined).toBe(0);
    api.down = false;
    for (let i = 0; i < 6; i++) await tick(5000);
    expect(api.joined).toBe(1);
    expect(meter().getAttribute('aria-label')).toContain('支援者75人');
  });
});

describe('遅れて読む塊がすべて読めなくても、主な流れは最後まで通る（I-120）', () => {
  it('はじめの画面 → ホーム → 次のアクション → SNSで広める → 特典 3/3 → 感謝が出る', async () => {
    configurePrefetch({
      images: PREFETCH_IMAGES,
      plan: PREFETCH_PLAN,
      chunks: {
        'fan-pages': () => Promise.reject(new Error('読めない')),
        'fan-layers': () => Promise.reject(new Error('読めない')),
      },
    });
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    click(/^次のアクション/);
    click(/^SNSで広める/);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    fireEvent.click(btn('X'));
    await tick(400 + 2300);
    fireEvent.click(within(layer('gift') as HTMLElement).getByRole('button', { name: '閉じる' }));
    fireEvent.click(within(layer('share') as HTMLElement).getByRole('button', { name: '閉じる' }));
    await tick(2000 + 700 + 2300);
    fireEvent.click(within(layer('gift') as HTMLElement).getByRole('button', { name: '閉じる' }));
    expect(layer('thanks')).not.toBeNull();
    expect(open).not.toHaveBeenCalled(); // 共有で、外のサイトは開かない
  });
});

describe('申し込みをやめる・コースの札・支援の状況（I-25・I-21・I-30）', () => {
  it('やめるとき、サーバーへ取り消しの要求は送らない（決定 3）。送ったのは申し込みの 1 回だけ', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    await tick(3000);
    click('メニュー');
    await settle();
    click('申し込みをやめる');
    await settle();
    fireEvent.click(
      within(layer('sheet') as HTMLElement).getByRole('button', { name: '申し込みをやめる' }),
    );
    await tick(5000);
    expect(api.posts()).toHaveLength(1);
    expect(api.log.filter((r) => !['GET', 'POST'].includes(r.method))).toHaveLength(0);
    expect(api.joined).toBe(1); // サーバーの人数は減らない
  });

  it('成立したあと（93 人）は、確認のシートに「戻る」だけが出る（SP-78）', async () => {
    api.joined = 19; // ほかの端末が 19 人（画面は 74 + 19 = 93 人で成立）
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    await tick(4000);
    click('メニュー');
    await settle();
    click('申し込みをやめる');
    await settle();
    const sheet = layer('sheet') as HTMLElement;
    expect(within(sheet).getByText('成立したあとの取り消しは、今後の対応範囲です。')).toBeTruthy();
    expect(within(sheet).queryByRole('button', { name: '申し込みをやめる' })).toBeNull();
    expect(within(sheet).getByRole('button', { name: '戻る' })).toBeTruthy();
  });

  it('人物 4 が前方の席を目指しているとき、応援コースは、通常の席だけ「申し込む」・前方の席は「目指すコースにしています」・ほかは「目指すコースにする」（I-21）', async () => {
    mountFan('?p=4');
    click('次へ');
    click('次へ');
    const front = screen
      .getAllByRole('button')
      .find((b) => b.hasAttribute('aria-pressed') && (b.textContent ?? '').includes('前方の席'));
    fireEvent.click(front as HTMLElement);
    click('このコースを目指して始める');
    click('メニュー');
    await settle();
    click(/^応援コース/);
    await settle();
    expect(screen.getAllByRole('button', { name: '申し込む' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '目指すコースにしています' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '目指すコースにする' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: '口座と預金へ' })).toHaveLength(3);
  });

  it('支援の状況: 74 人の内訳（福岡県 60・久留米市 43 が地元・佐賀県 7・熊本県 5・そのほか 2）と、申し込み後の 75 人（I-30）', async () => {
    mountFan('?p=4');
    click('次へ');
    click('次へ');
    click('この内容で申し込む');
    await tick(700 + 2600);
    click('閉じる');
    click('メニュー');
    await settle();
    click(/^支援の状況/);
    await settle();
    const table = screen.getByRole('table');
    const text = table.textContent ?? '';
    // 申し込み後（75 人）: 地元の市に +1（久留米市 44・福岡県 61）
    expect(text).toContain('福岡県61人');
    expect(text).toContain('久留米市地元44人');
    expect(text).toContain('佐賀県7人');
    expect(text).toContain('熊本県5人');
    expect(text).toContain('そのほか2人');
  });
});
