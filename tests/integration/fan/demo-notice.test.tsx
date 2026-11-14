// 「動作確認用のデモ画面です」の表示（ファン向け）。画面・演出・特典・感謝・下から出るシートの全部で、いまの札「デモ用の架空データ」と並ぶ。
import { describe, expect, it, vi } from 'vitest';
import {
  act,
  btn,
  click,
  closeGiftAfterFx,
  fireEvent,
  layer,
  mountFan,
  openNextPage,
  fundAndApply,
  passStart,
  screen,
  setupFanTest,
  tick,
  within,
} from './helpers';

setupFanTest();

const NOTICE = '動作確認用のデモ画面です';
const BADGE = 'デモ用の架空データ';
const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.dynamicImportSettled();
  });
};
const notices = () => screen.getAllByText(NOTICE).length;

describe('ファン向けの全画面', () => {
  it('はじめの画面 2 つ・ホーム・次のアクション・メニューと詳細の画面に、1 つずつ出る。札は、これまでどおり 1 つ', async () => {
    mountFan('?p=4');
    expect(notices()).toBe(1);
    click('次へ');
    expect(notices()).toBe(1);
    click('このコースを目指して始める');
    fundAndApply();
    expect(notices()).toBe(1);
    await closeGiftAfterFx();
    openNextPage(); // ホームの主のボタンは行動そのものなので、いまできること の一覧は、ストアの操作で開く
    expect(notices()).toBe(1);
    click('‹ ホーム');
    click('メニュー');
    await settle();
    expect(notices()).toBe(1);
    for (const title of [
      '貢献',
      '口座と預金',
      '応援コース',
      '支援の状況',
      'しくみ',
      '推し・条件の変更',
      '情報の扱い',
    ]) {
      click(new RegExp(`^${title}`));
      await settle();
      expect(notices(), title).toBe(1);
      expect(screen.getAllByText(BADGE), title).toHaveLength(1);
      click('‹ メニュー');
    }
  });

  it('演出・特典の絵・感謝のメッセージの層にも、札と並んで出る', async () => {
    mountFan('?p=4');
    passStart();
    await tick(650);
    expect(layer('fx')?.textContent).toContain(NOTICE);
    expect(layer('fx')?.textContent).toContain(BADGE);
    await tick(2600);
    expect(layer('gift')?.textContent).toContain(NOTICE);
    expect(layer('gift')?.textContent).toContain(BADGE);
    // 感謝（3 つ目の特典の絵を閉じた直後）
    await tick(10);
    fireEvent.click(within(layer('gift') as HTMLElement).getByRole('button', { name: '閉じる' }));
    click(/^SNSに投稿する（任意）/);
    fireEvent.click(btn('X'));
    // 投稿した直後の称賛の演出にも、札が並んで出る
    expect(layer('fx')?.textContent).toContain(NOTICE);
    expect(layer('fx')?.textContent).toContain(BADGE);
    await tick(2600 + 2300);
    fireEvent.click(within(layer('gift') as HTMLElement).getByRole('button', { name: '閉じる' }));
    fireEvent.click(within(layer('share') as HTMLElement).getByRole('button', { name: '閉じる' }));
    click(/^仲間を呼ぶ/); // ホームの主のボタン（共有のシートは経由しない）
    expect(layer('share')).toBeNull();
    await tick(1200 + 2300);
    fireEvent.click(within(layer('gift') as HTMLElement).getByRole('button', { name: '閉じる' }));
    expect(layer('thanks')?.textContent).toContain(NOTICE);
    expect(layer('thanks')?.textContent).toContain(BADGE);
  });

  it('短い称賛の札の最中も、札が出ている', async () => {
    mountFan('?p=4');
    click('次へ');
    fireEvent.click(
      screen
        .getAllByRole('button')
        .find(
          (b) => b.hasAttribute('aria-pressed') && (b.textContent ?? '').includes('前方の席'),
        ) as HTMLElement,
    );
    click('このコースを目指して始める');
    click(/^推し活定期をはじめる/); // ホームの主のボタン
    click(/^メイン口座にする/);
    // 短い称賛の札の最中も、ページの札 2 枚が出ている（札は、全画面を覆わないので、隠れない）
    expect(layer('ach')).not.toBeNull();
    expect(notices()).toBe(1);
    expect(screen.getAllByText(BADGE)).toHaveLength(1);
  });

  it('下から出るシート（引き継ぎ・申し込みをやめる確認）の中にも、札と並んで出る', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    click('メニュー');
    await settle();
    click('申し込みをやめる');
    await settle();
    const cancel = layer('sheet') as HTMLElement;
    expect(within(cancel).getAllByText(NOTICE)).toHaveLength(1);
    expect(within(cancel).getAllByText(BADGE)).toHaveLength(1);
    click('やめない（戻る）');
    await settle();
    click(/^推し・条件の変更/);
    await settle();
    click('KRS48');
    click('この条件に変える（デモ用）');
    await settle();
    const carry = layer('sheet') as HTMLElement;
    expect(within(carry).getAllByText(NOTICE)).toHaveLength(1);
  });

  it('共有のシートの中にも、札 2 枚が出る（P-01）', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    click(/^SNSに投稿する（任意）/);
    const share = layer('share') as HTMLElement;
    expect(within(share).getAllByText(NOTICE)).toHaveLength(1);
    expect(within(share).getAllByText(BADGE)).toHaveLength(1);
  });
});
