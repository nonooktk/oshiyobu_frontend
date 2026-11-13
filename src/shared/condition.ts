import { useMemo } from 'react';
import { conditionOf } from '../core';
import type { Condition, VenueId } from '../core';
import { useLinkedOffice } from './link';
import type { LinkedOffice } from './link';

/**
 * いま出す条件（到達ライン・必要人数・最低人数ほか）。
 * 事務所向けから届いた選択は、**同じ会場を出しているときだけ**反映する（決定 14）。
 * 申し込み・達成・特典は、ここでは取り直さない（条件の数字だけを取り替える）。
 */
export function effectiveCondition(venueId: VenueId, linked: LinkedOffice | null): Condition {
  if (linked !== null && linked.selection.venueId === venueId) {
    return conditionOf(venueId, {
      costs: linked.selection.costs,
      minPeople: linked.selection.minPeople,
    });
  }
  return conditionOf(venueId);
}

/** ファン向け: いま出している会場（venueId）の条件。連動で届いた選択を、同じ会場のときだけ反映する */
export function useEffectiveCondition(venueId: VenueId): Condition {
  const linked = useLinkedOffice();
  return useMemo(() => effectiveCondition(venueId, linked), [venueId, linked]);
}
