// プランを上げたときに贈る特典の素材（追加の画像・5秒の動画・20秒の動画）の置き場。
// 素材（自作か CC0 のもの）が届いたら、ここに 1 行ずつ足す。無い間は、画面が「準備中」の仮の表示を出す。
// 動画は、音なし・画面の中で再生する（<video muted playsInline>）。外から読み込まない（G-16）。
import type { ArtistId, CourseId } from '../../core';

export type RewardMedia = { src: string; alt: string };

/** 推し → プラン → 素材。素材が無い組は、仮の表示になる。 */
export const REWARD_MEDIA: Readonly<
  Partial<Record<ArtistId, Partial<Record<CourseId, RewardMedia>>>>
> = {};

export const rewardMediaOf = (artist: ArtistId, plan: CourseId): RewardMedia | null =>
  REWARD_MEDIA[artist]?.[plan] ?? null;
