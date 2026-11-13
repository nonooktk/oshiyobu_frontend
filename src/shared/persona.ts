import { personaByNo, personaPerformanceId, personaVenueId, resolvePersonaNo } from '../core';
import type { PerformanceId, Persona, VenueId } from '../core';
import { getDeviceId } from './device';

/**
 * この端末の人物（1〜15）。`/fan/?p=番号` の指定が有効ならそれ、なければ端末の番号から決める（設計 D-19）。
 * 保存しない。端末の番号が変わらない限り、何度呼んでも同じ人物。
 */
export function getPersona(search: string = globalThis.location?.search ?? ''): Persona {
  const param = new URLSearchParams(search).get('p');
  return personaByNo(resolvePersonaNo(getDeviceId(), param));
}

/** 人物の公演 ID と会場（地元の市の既定の会場）。ファン向けの初めの公演 */
export function getPersonaPerformance(persona: Persona): {
  readonly performanceId: PerformanceId;
  readonly venueId: VenueId;
} {
  return { performanceId: personaPerformanceId(persona), venueId: personaVenueId(persona) };
}
