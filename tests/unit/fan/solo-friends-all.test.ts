// ひとり体験の「申し込む → 仲間を呼ぶ」が、選べる全部の公演・全部の人物・全部のコースで、必ず成立に届くことの総当たり。
//   ① core の関数だけで、全 60 公演（5 組 × 会場 12）× 4 コース
//   ② ストアの操作で、人物 15 通り × 画面から選べる公演（5 組 × 9 市の既定の会場）× 4 コース
// 成立に届かない組み合わせがあれば、無理に合わせず、ここで落とす（報告して判断を仰ぐ）。
// 起動条件: 検査したケースの数が、組み合わせの数と一致すること（0 件で通る空振りを防ぐ）
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ARTISTS,
  COURSES,
  PERFORMANCE_IDS,
  PERSONA_COUNT,
  canApply,
  conditionOf,
  performanceIdOf,
} from '../../../src/core';
import type { ArtistId, CourseId, VenueId } from '../../../src/core';
import { FAN_VENUE_ID } from '../../../src/fan/domain/state';
import { initialFan } from '../../../src/fan/domain/state';
import { courseOf, friendsToClinch, viewOf } from '../../../src/fan/domain/view';
import { harness } from './helpers';

const ARTIST_IDS = ARTISTS.map((a) => a.id);
const COURSE_IDS = COURSES.map((c) => c.id);
const NO_METER = { serverJoined: 0, counted: false } as const;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('① core の関数だけで、全 60 公演 × 4 コース', () => {
  it('公演の数が 60 件（5 組 × 会場 12）', () => {
    expect(PERFORMANCE_IDS).toHaveLength(60);
  });

  it('申し込んだあと、仲間を呼べば、全部の公演・コースで成立に届く。人数は会場の席数を超えない', () => {
    const unreached: string[] = [];
    let cases = 0;
    for (const pid of PERFORMANCE_IDS) {
      const venueId = pid.split(':')[1] as VenueId;
      const cond = conditionOf(venueId);
      for (const courseId of COURSE_IDS) {
        cases += 1;
        const fan = { ...initialFan(4), course: courseId };
        const add = friendsToClinch(fan, cond, NO_METER);
        if (add === null) {
          unreached.push(`${pid}/${courseId}: 届かない`);
          continue;
        }
        const status = viewOf({ ...fan, friends: add }, cond, NO_METER).status;
        const ok = status.established && status.supporters <= cond.venue.cap;
        if (!ok) unreached.push(`${pid}/${courseId}: ${JSON.stringify(status)}`);
      }
    }
    expect(cases).toBe(PERFORMANCE_IDS.length * COURSE_IDS.length);
    expect(unreached).toEqual([]);
  });

  it('申し込む前（まだ数えていない）の状態でも、足す人数の計算は落ちない', () => {
    for (const pid of PERFORMANCE_IDS) {
      const cond = conditionOf(pid.split(':')[1] as VenueId);
      expect(friendsToClinch(initialFan(4), cond, NO_METER)).not.toBeNull();
    }
  });
});

describe('② ストアの操作で、人物 15 通り × 5 組（久留米市に固定）× 4 コース', () => {
  /** はじめる（推し活定期）→ 条件（メイン口座・預金）がそろうまで積む → 申し込む → 仲間を呼ぶ */
  function run(personaNo: number, artistId: ArtistId, courseId: CourseId) {
    const h = harness(personaNo, { solo: true });
    h.a.startPick('oshi', artistId);
    h.a.startPick('seat', courseId);
    h.a.startNext();
    h.a.startNext(); // 2/2 の「このコースを目指して始める」
    h.a.runAcct('teiki', 'home');
    const k = () => courseOf(h.view().cond, courseId);
    if (k().mainAccount) h.a.runAcct('main', 'home');
    const gap = Math.max(0, k().deposit - h.state().acct.deposit);
    if (gap > 0) h.a.runAcct('deposit', 'home', gap);
    expect(canApply(k(), h.state().acct.deposit, h.state().acct.pay)).toBe(true);
    h.a.homePrimary(); // 主のボタン「申し込む」
    vi.advanceTimersByTime(10_000);
    const applied = h.state().course === courseId;
    h.a.closeGift(); // 申し込みの称賛と特典 1/3 の絵のあと、ホームの主のボタン「仲間を呼ぶ」を押す
    h.a.callFriends();
    vi.advanceTimersByTime(10_000);
    const result = { applied, status: h.view().status, state: h.state(), cond: h.view().cond };
    h.store.dispose();
    return result;
  }

  it('申し込んで仲間を呼ぶと、必ず成立に届く（人数は最低人数以上・席数以下。金額は到達ライン以上）', () => {
    const failures: string[] = [];
    let cases = 0;
    for (let personaNo = 1; personaNo <= PERSONA_COUNT; personaNo += 1) {
      for (const artistId of ARTIST_IDS) {
        for (const courseId of COURSE_IDS) {
          cases += 1;
          const r = run(personaNo, artistId, courseId);
          const label = `人物${personaNo}/${performanceIdOf(artistId, FAN_VENUE_ID)}/${courseId}`;
          if (!r.applied) failures.push(`${label}: 申し込めなかった`);
          else if (!r.status.established) failures.push(`${label}: 成立に届かない`);
          else if (r.status.supporters > r.cond.venue.cap) failures.push(`${label}: 席数を超えた`);
          else if (r.state.friends < 1) failures.push(`${label}: 仲間が増えていない`);
        }
      }
    }
    expect(cases).toBe(PERSONA_COUNT * ARTIST_IDS.length * COURSE_IDS.length);
    expect(failures).toEqual([]);
  });
});
