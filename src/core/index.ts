// core の入口。frontend と API は、ここから公開されたものだけを使う。
export { CORE_VERSION } from './version';
export * from './types';

// データ
export { COST } from './data/costs';
export type { CostRow } from './data/costs';
export { CITIES, NEIGHBOR_PREFS, cityByName, cityIndex } from './data/cities';
export type { CityData } from './data/cities';
export { VENUES, venueById, venuesOf } from './data/venues';
export type { Venue } from './data/venues';
export { ARTISTS, artistById } from './data/artists';
export type { ArtistData, QuadKey } from './data/artists';
export { COURSES } from './data/courses';
export type { CourseDef, PriceRule, SlotsRule } from './data/courses';
export {
  AREA_OTHER_CITY_SPLIT,
  AREA_RATIOS,
  BASE_CITY,
  HOME_CITY,
  HOME_VENUE_ID,
  MAP_RADIUS,
  MILESTONE,
  RECRUITMENT_DEADLINE,
  TEIKI,
} from './data/constants';

// 計算
export {
  MAX_COST_YEN,
  costItems,
  costsOfTier,
  defaultMinPeople,
  lineOf,
  needOf,
} from './calc/cost';
export type { CostItem, CostValues } from './calc/cost';
export {
  conditionOf,
  courseOffersOf,
  defaultVenueIdOf,
  exceedsCapacity,
  startSupporters,
  upliftOf,
} from './calc/condition';
export type { Condition, ConditionInput, CourseOffer, Uplift, UpliftRow } from './calc/condition';
export { demandOf, levelOf, shortfallOf } from './calc/demand';
export type { Demand } from './calc/demand';
export {
  achievementPct,
  barFill,
  crossedMilestone,
  displayedCount,
  minPeopleGapYen,
  peopleLeft,
  supportStatus,
} from './calc/meter';
export type { MeterState, SupportState, SupportStatus } from './calc/meter';
export { parseCost, parseMinPeople } from './calc/parse';
export type { ParseResult } from './calc/parse';
export { canApply, depShort, mainShort, nextDepositTarget, restParts } from './calc/course';
export type { RestPart } from './calc/course';
export { REG_MAX, colorStep, metricValues, radiusOf } from './calc/map';
export type { ColorStep } from './calc/map';
export { areaFor } from './calc/area';
export type { AreaCity, AreaPref } from './calc/area';
export { PERSONAS, PERSONA_COUNT, PERSONA_DEFAULT_NO, personaByNo } from './data/personas';
export type { Persona } from './data/personas';
export {
  fnv1a32,
  personaNoFromParam,
  personaNoOf,
  personaPerformanceId,
  personaVenueId,
  resolvePersonaNo,
} from './calc/persona';
export { PERFORMANCE_IDS, isPerformanceId, performanceIdOf } from './schema/performance';
export {
  API_ERROR_CODES,
  DEVICE_ID_PATTERN,
  isValidDeviceId,
  parseApiErrorResponse,
  parseJoinResponse,
  parseMeterResponse,
  parseResetResponse,
} from './schema/meter';
export type {
  ApiErrorCode,
  ApiErrorResponse,
  JoinResponse,
  MeterResponse,
  ResetResponse,
} from './schema/meter';
