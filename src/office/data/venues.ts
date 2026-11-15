// 実在の会場（表示用）。足すときの決まりは、README.md と docs/守ること.md の G-30。
// 1 件ごとに、出典の URL（https://）と、確かめた日（YYYY-MM-DD）が要る。損益・判定・需要の計算には使わない。
//
// 2026-11-15 に追加（P3 の第 1 段: 事務所向けの画面で選べる core の会場のうち、収支シミュレーターにある会場）。
// 元は public/simulator.html の会場のデータ（2026-11-12 時点）。出典のページを開き、会場の名前と収容人数が
// 載っていることを確かめた行だけを置いた。名前は、出典のページに載っている書き方に合わせた。
// 置いていない会場:
// - Ohana Cafe（NGS-001）: 出典（eplus）のページが開けず（503）、確かめられなかった
// Music hall Fragile（FUK-020）は、収容人数の出典（RAG MusicSpot）に旧名 SQUARE GARDEN で載っている。
// 公式サイト（https://www.music-hall-fragile.com/）のお知らせに「2026年1月、SQUARE GARDEN（スクエアガーデン）から」
// 「名称変更いたしました」とあることを、2026-11-15 に確かめて置いた。
import type { VenueRecord } from './types';

export const VENUE_RECORDS: readonly VenueRecord[] = [
  {
    id: 'FUK-020',
    name: 'Music hall Fragile',
    pref: '福岡県',
    city: '福岡市中央区',
    capacity: 50,
    capacityBasis:
      'テーブル席 50名（RAG MusicSpot の、旧名 SQUARE GARDEN のときの掲載値。二次情報。2026年1月に名称変更（公式サイト））',
    type: 'ライブハウス',
    sourceUrl: 'https://www.ragnet.co.jp/fukuoka-live-house/9',
    checkedOn: '2026-11-15',
    coreVenueId: 'FUK-020',
  },
  {
    id: 'FUK-012',
    name: 'DRUM Be-1',
    pref: '福岡県',
    city: '福岡市中央区',
    capacity: 300,
    capacityBasis: '収容 300人ほど（ticketjam の掲載値。二次情報）',
    type: 'ライブハウス',
    sourceUrl: 'https://ticketjam.jp/venues/1076',
    checkedOn: '2026-11-15',
    coreVenueId: 'FUK-012',
  },
  {
    id: 'FUK-016',
    name: 'DRUM SON',
    pref: '福岡県',
    city: '福岡市中央区',
    capacity: 180,
    capacityBasis: '180人ほど（RAG MusicSpot の掲載値。二次情報）',
    type: 'ライブハウス',
    sourceUrl: 'https://www.ragnet.co.jp/fukuoka-live-house/4',
    checkedOn: '2026-11-15',
    coreVenueId: 'FUK-016',
  },
  {
    id: 'FUK-018',
    name: 'LIVE&BAR WHIPPING POST',
    pref: '福岡県',
    city: '北九州市小倉北区',
    capacity: 120,
    capacityBasis: 'オールスタンディングで 120人（RAG MusicSpot の掲載値。二次情報）',
    type: 'ライブハウス',
    sourceUrl: 'https://www.ragnet.co.jp/fukuoka-live-house/2',
    checkedOn: '2026-11-15',
    coreVenueId: 'FUK-018',
  },
  {
    id: 'FUK-019',
    name: '久留米シティプラザ Cボックス',
    pref: '福岡県',
    city: '久留米市',
    capacity: 144,
    capacityBasis: '144席（Wikipedia の掲載値。二次情報）',
    type: '多目的',
    sourceUrl:
      'https://ja.wikipedia.org/wiki/%E4%B9%85%E7%95%99%E7%B1%B3%E3%82%B7%E3%83%86%E3%82%A3%E3%83%97%E3%83%A9%E3%82%B6',
    checkedOn: '2026-11-15',
    coreVenueId: 'cbox',
  },
  {
    id: 'KGS-001',
    name: 'Live HEAVEN',
    pref: '鹿児島県',
    city: '鹿児島市',
    capacity: 60,
    capacityBasis: '約 60席（公式サイト。2019年4月現在の記載）',
    type: 'ライブハウス',
    sourceUrl: 'https://www.kagoshima-sr.jp/live-hall/liveheaven/',
    checkedOn: '2026-11-15',
    coreVenueId: 'KGS-001',
  },
  {
    id: 'KMM-002',
    name: 'Restaurant Bar CIB',
    pref: '熊本県',
    city: '熊本市',
    capacity: 100,
    capacityBasis: '客席 60名（最大 100名）。シアター形式は最大 150名（公式サイト）',
    type: 'カフェ・バー',
    sourceUrl: 'https://cib-co.jp/',
    checkedOn: '2026-11-15',
    coreVenueId: 'KMM-002',
  },
  {
    id: 'MYZ-004',
    name: 'メディキット県民文化センター イベントホール',
    pref: '宮崎県',
    city: '宮崎市',
    capacity: 300,
    capacityBasis: '移動席で最大 300席（公式サイト）',
    type: 'ホール',
    sourceUrl: 'https://miyazaki-ac.jp/hall/event-hall/',
    checkedOn: '2026-11-15',
    coreVenueId: 'MYZ-004',
  },
  {
    id: 'OIT-004',
    name: 'ブリックブロック（Brickblock）',
    pref: '大分県',
    city: '大分市',
    capacity: 100,
    capacityBasis: 'テーブル席 100名（公式サイト）',
    type: 'ライブハウス',
    sourceUrl: 'https://www.b-block.net/rent_hall/',
    checkedOn: '2026-11-15',
    coreVenueId: 'OIT-004',
  },
  {
    id: 'SAG-003',
    name: 'Event Space R BASE',
    pref: '佐賀県',
    city: '佐賀市',
    capacity: 60,
    capacityBasis: '椅子のみ 60席／椅子とテーブル 48席（運営者のサイト）',
    type: 'その他',
    sourceUrl: 'https://t-a-music.wixsite.com/b-shuffle/eventspacerbase',
    checkedOn: '2026-11-15',
    coreVenueId: 'SAG-003',
  },
];
