// 事務所向け（/）の 4 象限に、象限の名前と人数が出ること（要件 R-11・受け入れ V-06）。人数は core の値と照合する
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demandOf } from '../../src/core';
import { App } from '../../src/office/App';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { QUAD_NAMES, QUAD_ORDER } from '../../src/office/text/labels';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const pickBase = () => {
  fireEvent.click(screen.getByRole('button', { name: /^久留米市を選ぶ/ }));
  fireEvent.click(screen.getByRole('button', { name: /久留米シティプラザ Cボックス/ }));
};

describe('事務所向けの 4 象限（名前と人数）', () => {
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

  it('4 つの象限の名前と、core の人数が出る（右上は見込みと同じ）', () => {
    render(<App />);
    pickBase();
    const demand = demandOf('tech0', '久留米市');
    for (const key of QUAD_ORDER) {
      expect(screen.getByText(QUAD_NAMES[key])).toBeTruthy();
      const want = key === 'hotRich' ? demand.expected : demand.people[key];
      expect(screen.getByTestId(`quad-${key}`).textContent).toBe(`${want}人`);
    }
    expect(screen.getByTestId('quad-hotRich').textContent).toBe(
      screen.getByTestId('expected').textContent,
    );
  });
});
