// 人物 15 通りの「この人が体験すること」を、1 人ずつ 4 コースに対して確かめる（上層: I-77・A-56・A-57。期待は仕様 SP-64 の表）。
// 札の言い方は、応援コースのカードの「自分の状態」の札と同じ（SP-27）。
import { describe, expect, it } from 'vitest';
import {
  PERSONAS,
  canApply,
  conditionOf,
  performanceIdOf,
  personaByNo,
  personaNoFromParam,
  personaPerformanceId,
  personaVenueId,
} from '../../../src/core';
import { needTag } from '../../../src/fan/domain/view';

const OK = '✓';
// 4 コース（通常の席・前方の席・特別コース・最上位コース）の、自分の状態の札
const EXPECT: Record<number, [string, string, string, string]> = {
  1: [
    'あと 5,000円',
    'あと 85,000円・メイン口座',
    'あと 285,000円・メイン口座',
    'あと 985,000円・メイン口座',
  ],
  2: [OK, 'あと 72,000円・メイン口座', 'あと 272,000円・メイン口座', 'あと 972,000円・メイン口座'],
  3: [OK, 'あと 38,000円・メイン口座', 'あと 238,000円・メイン口座', 'あと 938,000円・メイン口座'],
  4: [OK, 'あと 10,000円・メイン口座', 'あと 210,000円・メイン口座', 'あと 910,000円・メイン口座'],
  5: [OK, 'あと 5,000円', 'あと 205,000円', 'あと 905,000円'],
  6: [OK, OK, 'あと 180,000円', 'あと 880,000円'],
  7: [OK, 'メイン口座がまだです', 'あと 120,000円・メイン口座', 'あと 820,000円・メイン口座'],
  8: [OK, OK, OK, 'あと 680,000円'],
  9: [OK, OK, OK, OK],
  10: [OK, 'あと 52,000円・メイン口座', 'あと 252,000円・メイン口座', 'あと 952,000円・メイン口座'],
  11: [OK, OK, 'あと 60,000円', 'あと 760,000円'],
  12: [OK, 'あと 10,000円', 'あと 210,000円', 'あと 910,000円'],
  13: [OK, 'メイン口座がまだです', 'メイン口座がまだです', 'あと 680,000円・メイン口座'],
  14: [
    'あと 11,000円',
    'あと 91,000円・メイン口座',
    'あと 291,000円・メイン口座',
    'あと 991,000円・メイン口座',
  ],
  15: [OK, OK, OK, 'あと 600,000円'],
};

describe('人物 15 通りの体験（I-77）', () => {
  it.each(Array.from({ length: 15 }, (_, i) => i + 1))(
    '人物 %i が 4 コースに対して体験すること',
    (no) => {
      const persona = personaByNo(no);
      const cond = conditionOf(personaVenueId(persona));
      const tags = cond.courses.map((k) =>
        canApply(k, persona.depositYen, persona.mainAccount)
          ? OK
          : needTag(k, persona.depositYen, persona.mainAccount),
      );
      expect(tags).toEqual(EXPECT[no]);
    },
  );

  it('1〜9 は基準の公演 tech0:cbox。10〜15 は、互いに違う別の公演（I-72）', () => {
    const pids = PERSONAS.map((p) => personaPerformanceId(p));
    expect(pids.slice(0, 9).every((id) => id === performanceIdOf('tech0', 'cbox'))).toBe(true);
    expect(pids.slice(9)).toEqual([
      'krs48:FUK-012',
      'krs48:KMM-002',
      'riji:cbox',
      'riji:SAG-003',
      'terao:NGS-001',
      'heisei:MYZ-004',
    ]);
  });

  it('会場の価格が違う市では、前方の席の金額が変わる（福岡市 6,000円 → 18,000円）。預金の条件は同じ（I-73）', () => {
    const fukuoka = conditionOf(personaVenueId(personaByNo(10)));
    const cbox = conditionOf(personaVenueId(personaByNo(4)));
    expect(fukuoka.courses[1]?.price).toBe(18000);
    expect(cbox.courses[1]?.price).toBe(21000);
    expect(fukuoka.courses.map((k) => k.deposit)).toEqual(cbox.courses.map((k) => k.deposit));
  });

  it('`?p=` の指定は、1〜15 だけ受ける。範囲外・数字でない・小数・空は無視する（I-69）', () => {
    expect(personaNoFromParam('7')).toBe(7);
    for (const bad of ['0', '16', 'abc', '1.5', '', 'auto', null, undefined]) {
      expect(personaNoFromParam(bad)).toBeUndefined();
    }
  });
});
