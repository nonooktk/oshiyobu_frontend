// ファン向けの、サーバーが止まっている・遅いときと、遅れて読む塊が読めないときの画面（上層: A-59・A-60・I-46・I-52・I-55・I-94・I-120・I-25・I-30・I-21）。
// 共有の部品（メーターの仕組み）は本物で、サーバーだけ偽物（FakeApi）。画面は通信を待たない。
import { describe, expect, it, vi } from 'vitest';
import { getAppStore } from '../../../src/fan/store/FanProvider';
import {
  act,
  api,
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

/** 内部の人数は、画面の文ではなく、ストアの状態で確かめる（ファン向けの画面に人数を出さないため。G-08） */
const supporters = () => getAppStore().view().status.supporters;
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
    expect(supporters()).toBe(75);
    await closeGiftAfterFx();
    await tick(20000);
    expect(supporters()).toBe(75); // 最後に取れた値（なければ初期値）のまま
    expect(screen.queryByText(/エラー|失敗|通信/)).toBeNull();
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
    expect(supporters()).toBe(75);
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
});
