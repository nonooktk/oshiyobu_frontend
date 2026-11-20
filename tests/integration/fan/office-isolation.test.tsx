// 事務所向けの操作は、ファン向けの体験を変えない（統括の決定 2026-11-14）。
// 事務所向け（/）は、フロントの担当者が作り直す。最低人数や費用の扱いが変わっても、ファン向けの「申し込む → 仲間を呼ぶ」で
// 必ず成立に届く決まり（G-02）が崩れないよう、ファン向けは、事務所向けの選択（会場・費用・最低人数）を読まない。
// ファン向けは、久留米市・既定の会場に固定で、core の既定の条件だけを使う。「デモを最初に戻す」の連動だけは、残す。
// 事務所向けの画面の中の動き（判定・提案・シミュレーターへの入口）は、tests/integration/office.test.tsx が見る。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, within } from '@testing-library/react';
import { App as OfficeApp } from '../../../src/office/App';
import { initialOfficeState, officeStore } from '../../../src/office/store';
import { conditionOf } from '../../../src/core';
import type { Condition } from '../../../src/core';
import { FAN_VENUE_ID } from '../../../src/fan/domain/state';
import { getAppStore } from '../../../src/fan/store/FanProvider';
import { LINK_CHANNEL_NAME } from '../../../src/shared/link';
import { setMeterEngineForTest } from '../../../src/shared/meter';
import { createMeterEngine } from '../../../src/shared/meter/engine';
import { FakeChannel } from '../../helpers/fakeChannel';
import { act, fireEvent, mountFan, screen, setupFanTest, tick } from './helpers';

setupFanTest();

beforeEach(() => {
  officeStore.setState(initialOfficeState());
  FakeChannel.reset();
  vi.stubGlobal('BroadcastChannel', FakeChannel);
  setMeterEngineForTest(createMeterEngine({ apiBase: '', random: () => 0.5 }));
});

/** ファン向けの成立の条件を決める値（会場・到達ライン・必要人数・最低人数・初めの支援者・チケットの金額） */
const key = (c: Condition) => ({
  venueId: c.venueId,
  line: c.line,
  need: c.need,
  min: c.min,
  start: c.start,
  price: c.price,
});
const base = conditionOf(FAN_VENUE_ID);
const fanCond = (): Condition => getAppStore().view().cond;

/** 事務所向けのページを、ファン向けとは別の入れ物に描く（同じ端末の別のタブの代わり）。操作は、その入れ物の中だけ。 */
function mountOffice() {
  const { container } = render(<OfficeApp />);
  const o = within(container);
  return {
    o,
    choose: (city: string) =>
      fireEvent.click(o.getByRole('button', { name: new RegExp(`^${city}を選ぶ`) })),
    pickVenue: (name: RegExp) => fireEvent.click(o.getByRole('button', { name })),
    openAdjust: () => fireEvent.click(o.getByText('条件を調整')),
    type: (label: string, value: string) =>
      fireEvent.change(o.getByLabelText(label), { target: { value } }),
  };
}

/** 事務所向けで、ファン向けと同じ会場（久留米市・Cボックス）の、費用と最低人数を変える。変えれば、判定の数字は変わる。 */
function changeSameVenue(office: ReturnType<typeof mountOffice>) {
  office.choose('久留米市');
  office.pickVenue(/久留米シティプラザ Cボックス/);
  office.openAdjust();
  office.type('会場費', '160000'); // +100,000円
  office.type('最低人数', '80');
}

/**
 * 昔の事務所向けが、選択が変わるたびに、同じ端末の別のタブへ送っていたメッセージ（会場・費用・最低人数）を、別の接続から送る。
 * いまの事務所向けは送らない。同じページの中の接続には、自分のメッセージは届かないので、別の接続を使って、別のタブの代わりにする。
 */
function sendLegacySelection(): void {
  const s = officeStore.getState();
  if (s.venueId === null) throw new Error('事務所向けで、会場を選んでから呼びます');
  const channel = new FakeChannel(LINK_CHANNEL_NAME);
  act(() => {
    channel.postMessage({
      type: 'office',
      selection: { venueId: s.venueId, costs: s.costs, minPeople: s.minHand },
    });
  });
}

describe('事務所向けで、会場・費用・最低人数を変えても、ファン向けの条件と流れは変わらない', () => {
  it('同じ会場（久留米市・Cボックス）の費用と最低人数を変えても、ファン向けの条件は、core の既定のまま', async () => {
    mountFan('?p=4');
    expect(key(fanCond())).toEqual(key(base));
    const office = mountOffice();
    changeSameVenue(office);
    sendLegacySelection(); // 昔の連動なら、ここでファン向けに届いた
    // 事務所向けの判定は、変えた条件で動いている（会場費 +100,000円 → 到達ライン 761,112円・最低人数 80 人）
    // 2026-11-20、Issue #53 の統括の了承（案 X）で、事務所向けの到達ラインに手数料 10% を含めた（N-13）。
    // 到達ライン ＝ ⌈（費用 380,000 ＋ 利益 305,000）÷ 0.9⌉。元は 750,000円。ファン向けの条件の期待値は変えていない
    expect(office.o.getByTestId('line').textContent).toBe('761,112円');
    expect(office.o.getByTestId('rule').textContent).toContain('80人');
    await tick(1000); // 以前の連動が送っていた間（100 ms）を、十分に過ぎる
    expect(key(fanCond())).toEqual(key(base)); // ファン向けの条件は、変わらない
    expect(fanCond().line).toBe(650_000);
    expect(fanCond().min).toBe(93);
  });

  it('別の会場（熊本市）を選んでも、ファン向けは久留米市・Cボックスのまま', async () => {
    mountFan('?p=4');
    const office = mountOffice();
    office.choose('熊本市');
    office.pickVenue(/Restaurant Bar CIB/);
    sendLegacySelection();
    await tick(1000);
    expect(fanCond().venueId).toBe(FAN_VENUE_ID);
    act(() => getAppStore().actions.startNext());
    expect(screen.getByText(/会場: 久留米シティプラザ Cボックス/)).toBeTruthy();
  });
});

describe('事務所向けは、選択をファン向けへ送らない。昔の形のメッセージが届いても、ファン向けは読まない', () => {
  /** 同じ名前の、観測用の接続（届いたメッセージを集める） */
  function listen(): unknown[] {
    const seen: unknown[] = [];
    const spy = new FakeChannel(LINK_CHANNEL_NAME);
    spy.addEventListener('message', (event) => seen.push(event.data));
    return seen;
  }
  const typeOf = (m: unknown): unknown => (m as { type?: unknown }).type;

  it('事務所向けで会場・費用・最低人数を変えても、選択のメッセージは、1 件も流れない', async () => {
    const seen = listen();
    const office = mountOffice();
    changeSameVenue(office);
    await tick(1000);
    expect(seen.filter((m) => typeOf(m) === 'office')).toEqual([]);
  });

  it('「デモを最初に戻す」の連動は、残っている。事務所向けで押すと、resetAll が、同じ端末の別のタブへ流れる', async () => {
    const seen = listen();
    const office = mountOffice();
    fireEvent.click(office.o.getByRole('button', { name: 'デモを最初に戻す' }));
    await tick(10);
    expect(seen.map(typeOf)).toContain('resetAll');
    // 受け取った側（ファン向け）が、はじめの画面に戻る動きは、tests/integration/fan/flow.test.tsx が確かめる
  });
});
