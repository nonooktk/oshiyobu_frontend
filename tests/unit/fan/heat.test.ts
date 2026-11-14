// 開催熱量（ファン向けの見せ方。統括の決定）: 人数の割合 → ゲージの長さ・段階・距離のことば。
// 画面には数字を出さない。ここでは、割合（p）を入れて、長さ・段階・ことばを確かめる。
import { describe, expect, it } from 'vitest';
import { conditionOf } from '../../../src/core';
import {
  DISTANCE_WORDS,
  STAGE_NAMES,
  gaugeOf,
  heatOf,
  type HeatStage,
} from '../../../src/fan/domain/heat';

/** 最低人数 100 人の公演で、支援者 n 人・成立でない（段階の境目を、見やすい数で確かめる） */
const at = (n: number, established = false) => heatOf({ supporters: n, established }, 100);

describe('段階の境目（統括の決定: 50%・70%・80%・成立）', () => {
  it.each([
    [0, 1],
    [49, 1],
    [50, 2],
    [69, 2],
    [70, 3],
    [79, 3],
    [80, 4],
    [99, 4],
    [100, 4], // 人数が届いても、金額が足りない（成立していない）ときは、FEVER 目前
  ] as [number, HeatStage][])('支援者 %i 人（最低人数 100 人）は、段階 %i', (n, stage) => {
    expect(at(n).stage).toBe(stage);
  });

  it('成立（人数と金額の両方）したときだけ、段階 5（FEVER）', () => {
    expect(at(100, true).stage).toBe(5);
    expect(at(80, false).stage).toBe(4);
  });

  it('最低人数が 0 以下でも、落ちない（段階 1）', () => {
    expect(heatOf({ supporters: 5, established: false }, 0).stage).toBe(1);
  });
});

describe('段階の名前と距離のことば（統括の決定: 案 A）', () => {
  it('名前は 点火／あたたまってきた／ヒートアップ／FEVER 目前／FEVER', () => {
    expect([1, 2, 3, 4, 5].map((s) => STAGE_NAMES[s as HeatStage])).toEqual([
      '点火',
      'あたたまってきた',
      'ヒートアップ',
      'FEVER 目前',
      'FEVER',
    ]);
  });

  it('距離のことばは、段階ごとに 1 つ', () => {
    expect([1, 2, 3, 4, 5].map((s) => DISTANCE_WORDS[s as HeatStage])).toEqual([
      'はじまったところ',
      'だんだん近づいてきた',
      'もう少し',
      'あと一歩',
      '開催が決まりました',
    ]);
  });

  it('名前にも、ことばにも、数字が入らない（FEVER 目前の「FEVER」だけが英字）', () => {
    for (const stage of [1, 2, 3, 4, 5] as HeatStage[]) {
      const heat = at(stage * 20, stage === 5);
      expect(`${heat.name}${heat.distance}`).not.toMatch(/\d|[０-９]/);
    }
  });
});

describe('ゲージの曲線（正比例にしない。終わりに近いほど速く伸びる）', () => {
  it('長さは p の 2 乗（統括の決定: 「中間」）', () => {
    expect(gaugeOf(0.5)).toBe(0.25);
    expect(gaugeOf(0.8)).toBeCloseTo(0.64, 10);
    expect(gaugeOf(1)).toBe(1);
  });

  it('正比例ではない（途中は、p より短い）。単調に伸びる', () => {
    for (const p of [0.1, 0.3, 0.5, 0.7, 0.9]) expect(gaugeOf(p)).toBeLessThan(p);
    const lengths = [0, 0.2, 0.4, 0.6, 0.8, 1].map(gaugeOf);
    expect([...lengths].sort((a, b) => a - b)).toEqual(lengths);
  });

  it('終わりに近いほど、同じ人数の増加で、ゲージが大きく伸びる', () => {
    const early = gaugeOf(0.3) - gaugeOf(0.2);
    const late = gaugeOf(0.9) - gaugeOf(0.8);
    expect(late).toBeGreaterThan(early);
  });

  it('p は 1 で止める（上限を超えても、長さは 1 を超えない）', () => {
    expect(gaugeOf(1.4)).toBe(1);
    expect(gaugeOf(-1)).toBe(0);
  });

  it('FEVER のときだけ満タン。人数だけ届いて金額が足りないときは、満タンにしない', () => {
    expect(at(100, true).fill).toBe(1);
    expect(at(100, false).fill).toBeLessThan(1);
    expect(at(99, false).fill).toBeLessThan(1);
  });

  it('星（次の段階の位置）は、次の境目の長さ。FEVER 目前の次は満タン、FEVER では無い', () => {
    expect(at(10).next).toBeCloseTo(gaugeOf(0.5), 10);
    expect(at(60).next).toBeCloseTo(gaugeOf(0.7), 10);
    expect(at(75).next).toBeCloseTo(gaugeOf(0.8), 10);
    expect(at(90).next).toBe(1);
    expect(at(100, true).next).toBeNull();
  });
});

describe('基準の公演（Tech0サステナアイドル × 久留米市 × Cボックス）の 3 時点', () => {
  const cond = conditionOf('cbox');
  const ofSupporters = (n: number, established: boolean) =>
    heatOf({ supporters: n, established }, cond.min);

  it('開いたとき（初めの支援者）は ヒートアップ、自分が申し込むと FEVER 目前、成立で FEVER', () => {
    expect(cond.start).toBe(74);
    expect(cond.min).toBe(93);
    expect(ofSupporters(74, false)).toMatchObject({ stage: 3, name: 'ヒートアップ' });
    expect(ofSupporters(75, false)).toMatchObject({ stage: 4, name: 'FEVER 目前' });
    expect(ofSupporters(93, true)).toMatchObject({ stage: 5, name: 'FEVER', fill: 1 });
  });

  it('申し込みの 1 人分で、ゲージは少しだけ伸びる（人数を逆算できる大きさではない）', () => {
    const before = ofSupporters(74, false).fill;
    const after = ofSupporters(75, false).fill;
    expect(after).toBeGreaterThan(before);
    expect(after - before).toBeLessThan(0.05);
  });
});
