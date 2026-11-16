// 「動作確認用のデモ画面です」の表示（ファン向け）。画面・演出・特典・感謝・下から出るシートの全部で、いまの札「デモ用の架空データ」と並ぶ。
import { describe, expect, it, vi } from 'vitest';
import {
  act,
  click,
  closeGiftAfterFx,
  layer,
  mountFan,
  openNextPage,
  fundAndApply,
  passStart,
  screen,
  setupFanTest,
  within,
  joinFromPlans,
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
    joinFromPlans();
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
});
