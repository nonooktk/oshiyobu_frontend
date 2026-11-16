// ファン向けの基準の流れと、前方の席を目指す流れ（上層: A-15〜A-18・A-24〜A-27・A-34・A-35・A-40・A-41・A-45・A-46・I-23・I-24・I-74）。
// 通信は無い。共有メーターは、仮の I/F のメモリの値（サーバーへの申し込みの合図は、画面の人数に足されないことを確かめる）。
import { describe, expect, it, vi } from 'vitest';
import { getAppStore } from '../../../src/fan/store/FanProvider';
import { LINK_CHANNEL_NAME, createLink } from '../../../src/shared/link';
import { asBroadcastChannel, FakeChannel } from '../../helpers/fakeChannel';
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
  tick,
  setupFanTest,
  within,
} from './helpers';

setupFanTest();

/** ホームの熱量のゲージ（読み上げ用の文。人数・割合の数字は入らない。G-08） */
const meter = () => screen.getByRole('img', { name: /^開催熱量。/ });
/** 内部の人数は、画面の文ではなく、ストアの状態で確かめる（ファン向けの画面に人数を出さないため） */
const supporters = () => getAppStore().view().status.supporters;

describe('基準の流れ（人物 4・tech0・久留米市・Cボックス）', () => {
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

  it('メニューから「申し込みをやめる」まで 2 操作で届き、やめると 74 人に戻る。取り消しは送らない（A-45・A-46・I-25）', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    click('メニュー');
    await act(async () => {
      await import('../../../src/fan/pages/Pages');
    });
    click('参加をやめる');
    expect(screen.getByRole('heading', { name: '参加をやめますか？' })).toBeTruthy();
    await act(async () => {
      await import('../../../src/fan/layers/Sheets');
    });
    fireEvent.click(
      within(layer('sheet') as HTMLElement).getByRole('button', { name: '参加をやめる' }),
    );
    await tick(10);
    expect(supporters()).toBe(74);
    expect(
      screen.getAllByText(/参加をやめました。確保は解除され、負担は0円です。/).length,
    ).toBeGreaterThan(0);
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
    // 事務所向けは、もう選択を送らない（tests/integration/fan/office-isolation.test.tsx）。昔の版が送っていた形のメッセージが
    // 別の接続から届いても、ファン向けは読まない
    const office = new FakeChannel(LINK_CHANNEL_NAME);
    await act(async () => {
      office.postMessage({
        type: 'office',
        selection: {
          venueId: 'KMM-002',
          costs: { venue: 60000, prod: 100000, fee: 250000, travel: 120000, profit: 120000 },
          minPeople: null,
        },
      });
      vi.advanceTimersByTime(200);
    });
    click('次へ');
    expect(screen.getByText(/会場: 久留米シティプラザ Cボックス/)).toBeTruthy();
    expect(screen.queryByText(/熊本市/)).toBeNull();
  });
});
