// 事務所向け（/）の強調で、4 象限の線を動かした変化は、強調・「前」・読み上げを出さない（#26 の統括の指摘 ②）。
// 線は数字を見比べながら動かすので、動かすたびに 4 枚のカードが光ると落ち着かない。記録（どの数字が変わったか）は残す。
// 推し・会場・費用を替えたときは、線の位置に関係なく出す
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/office/App';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const pickBase = () => {
  fireEvent.click(screen.getByRole('button', { name: /^久留米市を選ぶ/ }));
  fireEvent.click(screen.getByRole('button', { name: /久留米シティプラザ Cボックス/ }));
};
const moveLine = (value: string) =>
  fireEvent.change(screen.getByRole('slider', { name: '預金額' }), { target: { value } });
const isChanged = (testId: string) =>
  screen.getByTestId(testId).closest('[data-changed="true"]') !== null;
const noHighlight = () => {
  expect(document.querySelector('[data-changed="true"]')).toBeNull();
  expect(document.querySelector('[data-prev]')).toBeNull();
  expect(screen.getByTestId('change-live').textContent).toBe('');
};

describe('事務所向けの強調: 4 象限の線を動かしたとき', () => {
  beforeEach(() => {
    officeStore.setState(initialOfficeState());
    vi.stubGlobal('fetch', vi.fn());
    FakeChannel.reset();
    vi.stubGlobal('BroadcastChannel', FakeChannel);
    resetLinkForTest();
  });
  afterEach(() => {
    cleanup();
    resetLinkForTest();
    vi.unstubAllGlobals();
  });

  it('線を動かすと、4 枚のカードの人数は変わるが、強調・「前」・読み上げは出ない。記録は残す', () => {
    render(<App />);
    pickBase();
    const before = screen.getByTestId('quad-coolRich').textContent;
    moveLine('25');
    expect(screen.getByTestId('quad-coolRich').textContent).not.toBe(before);
    noHighlight();
    const { changes } = officeStore.getState();
    expect(changes.byLine).toBe(true);
    expect(changes.keys.length).toBeGreaterThan(0);
  });

  it('「初めの位置に戻す」でも、強調・「前」・読み上げは出ない', () => {
    render(<App />);
    pickBase();
    moveLine('25');
    fireEvent.click(screen.getByRole('button', { name: '初めの位置に戻す' }));
    noHighlight();
  });

  it('推しを替えたあとに線を動かすと、推しのときの強調は消える', () => {
    render(<App />);
    pickBase();
    fireEvent.click(screen.getByRole('button', { name: /KRS48/ }));
    expect(isChanged('expected')).toBe(true);
    moveLine('25');
    noHighlight();
  });

  it('線を動かしたあとでも、推しを替えたときは強調・「前」・読み上げを出す（4 枚のカードも）', () => {
    render(<App />);
    pickBase();
    moveLine('25');
    fireEvent.click(screen.getByRole('button', { name: /KRS48/ }));
    expect(isChanged('expected')).toBe(true);
    expect(isChanged('quad-hotRich')).toBe(true);
    expect(screen.getByTestId('change-live').textContent).toContain('見込み');
    expect(officeStore.getState().changes.byLine).toBe(false);
  });

  it('線を動かしたあとでも、会場を替えたときは、変わった数字を強調する', () => {
    render(<App />);
    pickBase();
    moveLine('25');
    fireEvent.click(screen.getByRole('button', { name: /RISE UP/ })); // キャパが違うので、上乗せが変わる
    expect(isChanged('uplift-total')).toBe(true);
    expect(screen.getByTestId('change-live').textContent).not.toBe('');
  });

  it('線を動かしたあとでも、費用を変えたときは、到達ラインを強調する', () => {
    render(<App />);
    pickBase();
    moveLine('25');
    fireEvent.click(screen.getByText('条件を調整'));
    fireEvent.change(screen.getByLabelText('会場費'), { target: { value: '200000' } });
    fireEvent.blur(screen.getByLabelText('会場費'));
    expect(isChanged('line')).toBe(true);
    expect(screen.getByTestId('change-live').textContent).not.toBe('');
  });
});
