// 端末の番号と人物（設計 D-19・I-67〜I-78 のうち画面側の決め方）
import { beforeEach, describe, expect, it } from 'vitest';
import { personaByNo, personaNoOf } from '../../src/core';
import { forgetDeviceIdForTest, getDeviceId } from '../../src/shared/device';
import { getPersona, getPersonaPerformance } from '../../src/shared/persona';

describe('人物（/fan/?p= と端末の番号）', () => {
  beforeEach(() => {
    localStorage.clear();
    forgetDeviceIdForTest();
  });

  it('?p=4 で人物 4（基準の人物。tech0・久留米市・預金 90,000 円・メイン口座は未）', () => {
    const persona = getPersona('?p=4');
    expect(persona.no).toBe(4);
    expect(persona).toMatchObject({
      artistId: 'tech0',
      city: '久留米市',
      depositYen: 90000,
      mainAccount: false,
    });
  });

  it('?p=11 で人物 11（krs48・熊本市）。公演は、その市の既定の会場', () => {
    const persona = getPersona('?p=11');
    expect(persona).toMatchObject({ no: 11, artistId: 'krs48', city: '熊本市' });
    expect(getPersonaPerformance(persona)).toEqual({
      performanceId: 'krs48:KMM-002',
      venueId: 'KMM-002',
    });
  });

  it('人物 1〜9 の公演は、基準の公演 tech0:cbox', () => {
    for (let no = 1; no <= 9; no += 1) {
      expect(getPersonaPerformance(getPersona(`?p=${no}`)).performanceId).toBe('tech0:cbox');
    }
  });

  it.each(['?p=0', '?p=16', '?p=abc', '?p=', '?p=4.5', '?p=-1', '?p=%203', ''])(
    '範囲外・数字でない指定（%s）は無視して、端末の番号で決める',
    (search) => {
      expect(getPersona(search).no).toBe(personaNoOf(getDeviceId()));
    },
  );

  it('端末の番号が変わらない限り、何度でも同じ人物（再読み込みで変わらない）', () => {
    const first = getPersona('').no;
    forgetDeviceIdForTest();
    expect(getPersona('').no).toBe(first);
    expect(getPersona('')).toBe(personaByNo(first));
  });
});
