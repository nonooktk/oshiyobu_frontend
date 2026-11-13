// useSharedMeter（フック）。画面は、サーバーの人数を読むだけで、通信は仕組みの中（設計 D-41）
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMeterEngine } from '../../src/shared/meter/engine';
import { setMeterEngineForTest, useSharedMeter } from '../../src/shared/meter';
import { FakeApi } from '../helpers/fakeApi';

function Probe({ poll = true }: { poll?: boolean }) {
  const meter = useSharedMeter('tech0:cbox', { poll });
  return (
    <p>
      人数 {meter.joined}／{meter.status}
    </p>
  );
}

describe('useSharedMeter', () => {
  let api: FakeApi;
  beforeEach(() => {
    vi.useFakeTimers();
    api = new FakeApi();
    vi.stubGlobal('fetch', api.fetch);
    setMeterEngineForTest(
      createMeterEngine({
        apiBase: 'https://api.example.test',
        deviceId: () => 'device-aaaaaaaaaaaaaaaa',
        random: () => 0.5,
      }),
    );
  });
  afterEach(() => {
    cleanup();
    setMeterEngineForTest(null);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('取れた人数を出し、サーバーの変化に追いつく。取れるまでは初期値（0）で描く', async () => {
    api.joined = 9;
    render(<Probe />);
    expect(screen.getByText('人数 0／connecting')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2010);
    });
    expect(screen.getByText('人数 9／ok')).toBeTruthy();
    api.joined = 11;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2010);
    });
    expect(screen.getByText('人数 11／ok')).toBeTruthy();
  });

  it('画面を閉じたら、2 秒おきの取得を止める', async () => {
    const { unmount } = render(<Probe />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2010);
    });
    unmount();
    const before = api.gets().length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(api.gets()).toHaveLength(before);
  });

  it('poll: false の画面は、読むだけで、2 秒おきには取らない', async () => {
    render(<Probe poll={false} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(api.gets()).toHaveLength(0);
  });
});
