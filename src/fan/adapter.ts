// 共有の部品（`src/shared/`。F-0b が作る。レーン間の I/F は設計 D-35）をファン向けが使う入り口（1 か所）。
// 【仮】本物が dev に入るまでは、`_stub/shared.ts` の仮の実装を使う。入ったら、import の向き先だけを替える。
export {
  getDeviceId,
  joinPerformance,
  needImage,
  requestMeterFetch,
  startPrefetch,
  stubResetImages,
  stubResetMeters,
  stubSetServerJoined,
  useEffectiveCondition,
  useImageState,
  useLinkedOffice,
  useSharedMeter,
} from './_stub/shared';
export type {
  ImageState,
  MeterFetchReason,
  MeterStatus,
  OfficeSelection,
  SharedMeter,
} from './_stub/shared';
