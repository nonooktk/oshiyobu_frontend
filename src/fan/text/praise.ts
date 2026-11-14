// 称賛のことば（行動の直後に出す演出の文）。形は「あなたがしたこと → それで何が進んだか」。
// 褒めるのは利用者の行動だけ（G-04）。人数・達成率・金額の数字は言わない（G-08）。
// 演出の中では、title ＝ 大きい文字、small ＋ sub ＝ 褒めることばのカード（small が「したこと」、sub が「進んだこと」）。
export type Praise = { title: string; small: string; sub: string };

/** 申し込んだ直後。段階が上がったとき（stage）は、上がった先の名前で伝える。 */
export const PRAISE_JOIN_SMALL = '申し込みありがとう。あなたの一歩で、';
export const praiseJoinStage = (stageName: string): Praise => ({
  title: `${stageName}！`,
  small: PRAISE_JOIN_SMALL,
  sub: `${stageName}まで来ました`,
});
export const PRAISE_JOIN: Praise = {
  title: 'ナイス！',
  small: PRAISE_JOIN_SMALL,
  sub: '熱が高まりました',
};

/** 申し込んだ直後に、そのまま成立に届いたとき（人数も金額もそろった公演）。 */
export const PRAISE_JOIN_FEVER: Praise = {
  title: 'FEVER！',
  small: '申し込みありがとう。',
  sub: 'あなたの声が届いて、開催が決まりました',
};

/** SNS に投稿した直後（ゲージは動かさない）。 */
export const PRAISE_SHARE: Praise = {
  title: '広がった！',
  small: '投稿してくれてありがとう。',
  sub: '応援が広がっています',
};

/** 成立のあとに、仲間に知らせた直後。 */
export const PRAISE_NOTIFY: Praise = {
  title: '届いた！',
  small: '知らせてくれてありがとう。',
  sub: 'あなたの声が、仲間に届きました',
};

/** 仲間を呼んだ直後（ゲージが伸びている最中）。 */
export const PRAISE_FRIEND: Praise = {
  title: '届いた！',
  small: '仲間を呼んでくれてありがとう。',
  sub: 'あなたの声が届いて、熱が高まっています',
};

/** FEVER の瞬間（仲間を呼んで、開催が決まった）。 */
export const PRAISE_FEVER: Praise = {
  title: 'FEVER！',
  small: '仲間を呼んでくれてありがとう。',
  sub: 'あなたの声が届いて、開催が決まりました',
};
