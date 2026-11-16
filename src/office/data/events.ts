// 実在の過去の公演（表示用）。足すときの決まりは、README.md と docs/守ること.md の G-30。
// 1 件ごとに、出典の URL（https://）と、確かめた日（YYYY-MM-DD）が要る。出演者は、公開の告知にある芸名・団体名だけ。
//
// 2026-11-15 に追加（P3 の第 1 段: venues.ts の会場ごとに、新しい順に 5 件まで）。
// 元は public/simulator.html の公演のデータ（2026-11-12 時点）。出典のページを開き、日付と出演者が載っていることを
// 確かめた行だけを置いた。出演者の名前は、出典のページに載っている書き方に合わせた。
// 置いていない公演（確かめられなかったもの）:
// - メディキット県民文化センター イベントホールの公演: 出典が PDF で、中の字を読めなかった
// - DRUM Be-1 の 2026-11-07: 出典のページの字（Shift_JIS）を読めず、出演者を確かめられなかった
// - BRICK BLOCK の 2026-08-08: 出典がお知らせで、年の記載が無く、開かれたかどうかも書かれていなかった
// - Event Space R BASE の 2026-09-27: 出典の会場の欄が「RAG.G / R BASE」の 2 会場で、R BASE の公演と言い切れなかった
// 公演の日程表のページ（DRUM・WHIPPING POST・CIB の月ごとの表など）は、時がたつと中身が入れ替わることがある。
// 出典が開けなくなった・値が違っていた行は、外す（README.md の 7）。
//
// 2026-11-16 に追加: 久留米シティプラザ Cボックス（FUK-019）の 5 件。出典は久留米シティプラザの公式の PDF。
// 担当者が PDF を目で開き、会場（Cボックス）・日付・出演者・公演名が載っていることを確かめた。
// 「第41回 音の森ピアノコンサート」は、simulator.html では 2025-08-03 だが、PDF では 2025-08-12（PDF に合わせた）。
import type { PastEvent } from './types';

const CHECKED = '2026-11-15';
/** Cボックスの 5 件を確かめた日 */
const CHECKED_CBOX = '2026-11-16';
const CBOX_PDF_2025_08 = 'https://kurumecityplaza.jp/static/pdf/202508_schedule.pdf';
const CBOX_PDF_2024 =
  'https://kurumecityplaza.jp/uploads/ckeditor/attachments/3301/kcppapper20240329_A4_web.pdf';
const CBOX_PDF_2023 =
  'https://kurumecityplaza.jp/uploads/ckeditor/attachments/2859/kcppapper20230531_web.pdf';

export const PAST_EVENTS: readonly PastEvent[] = [
  // Music hall Fragile（FUK-020）
  {
    venueId: 'FUK-020',
    artist: '太田大地',
    date: '2026-11-10',
    title: 'LIVECATIONS！',
    sourceUrl: 'https://www.music-hall-fragile.com/live/index.html',
    checkedOn: CHECKED,
  },
  {
    venueId: 'FUK-020',
    artist: 'RINA AIUCHI',
    date: '2026-11-08',
    title: 'R-box Vol.40.5 ミーグリLIVE',
    sourceUrl: 'https://www.music-hall-fragile.com/live/index.html',
    checkedOn: CHECKED,
  },
  {
    venueId: 'FUK-020',
    artist: 'Kinuyo',
    date: '2026-11-07',
    title: 'Kinuyo Live Tour 2026',
    sourceUrl: 'https://www.music-hall-fragile.com/live/index.html',
    checkedOn: CHECKED,
  },
  // DRUM Be-1（FUK-012）
  {
    venueId: 'FUK-012',
    artist: 'LM.C',
    date: '2026-11-08',
    title: 'LM.C 20th Anniversary Tour -The Best Shows Ever!!-',
    sourceUrl: 'https://www.live-drum.com/sche_b1.cgi',
    checkedOn: CHECKED,
  },
  {
    venueId: 'FUK-012',
    artist: "Damian Hamada's Creatures",
    date: '2026-11-06',
    title: 'TOUR 666',
    sourceUrl: 'https://www.live-drum.com/sche_b1.cgi',
    checkedOn: CHECKED,
  },
  {
    venueId: 'FUK-012',
    artist: 'NIGHTMARE',
    date: '2026-11-04',
    title: 'NIGHTMARE TOUR 2026',
    sourceUrl: 'https://www.live-drum.com/sche_b1.cgi',
    checkedOn: CHECKED,
  },
  {
    venueId: 'FUK-012',
    artist: 'THE FRANK VOX',
    date: '2026-11-03',
    title: 'VOX LETTER TOUR 2026',
    sourceUrl: 'https://www.live-drum.com/sche_b1.cgi',
    checkedOn: CHECKED,
  },
  // DRUM SON（FUK-016）
  {
    venueId: 'FUK-016',
    artist: 'kein',
    date: '2026-11-08',
    title: 'kein LIVE 2026「Iustitia sine misericordia」',
    sourceUrl: 'https://www.live-drum.com/sche_son.cgi',
    checkedOn: CHECKED,
  },
  {
    venueId: 'FUK-016',
    artist: 'kein',
    date: '2026-11-07',
    title: 'kein LIVE 2026「Iustitia sine misericordia」',
    sourceUrl: 'https://www.live-drum.com/sche_son.cgi',
    checkedOn: CHECKED,
  },
  {
    venueId: 'FUK-016',
    artist: 'RAZOR',
    date: '2026-11-01',
    title: '10th ANNIVERSARY ONEMAN TOUR X - tenth -',
    sourceUrl: 'https://www.live-drum.com/sche_son.cgi',
    checkedOn: CHECKED,
  },
  // LIVE&BAR WHIPPING POST（FUK-018）
  {
    venueId: 'FUK-018',
    artist: 'SHUDO&RUDIES',
    date: '2026-11-08',
    title: 'SHUDO&RUDIES Presents. WE BLEED THE SAME',
    sourceUrl: 'https://www.whipping-post.info/schedule',
    checkedOn: CHECKED,
  },
  {
    venueId: 'FUK-018',
    artist: 'ラフィンノーズ',
    date: '2026-10-31',
    title: '2026冬のワチュロウパーティ!',
    sourceUrl: 'https://www.whipping-post.info/rireki',
    checkedOn: CHECKED,
  },
  {
    venueId: 'FUK-018',
    artist: 'めっちゃ冒険するタイプーズ／孔雀／ビートライガー／Nop-Nog crew',
    date: '2026-10-18',
    title: 'ULTRA VOX',
    sourceUrl: 'https://www.whipping-post.info/rireki',
    checkedOn: CHECKED,
  },
  {
    venueId: 'FUK-018',
    artist: '恥骨／TAKURAMI／惡AI意',
    date: '2026-09-05',
    title: 'TYSONS Presents. BUTCHERY GIG Vol,8',
    sourceUrl: 'https://www.whipping-post.info/rireki',
    checkedOn: CHECKED,
  },
  {
    venueId: 'FUK-018',
    artist: '歩暖／RATTLEHEAD／MOTHERDRAIN／HYDROPHOBIA／RoyalLine',
    date: '2026-08-22',
    title: 'LIVE&BAR WHIPPING POST 13 YEAR ANNIVERSARY EVENT',
    sourceUrl: 'https://www.whipping-post.info/rireki',
    checkedOn: CHECKED,
  },
  // Live HEAVEN（KGS-001）
  {
    venueId: 'KGS-001',
    artist: 'ナカノアツシ',
    date: '2026-06-20',
    title: 'ナカノアツシの47都道府県ツアー鹿児島編〜ACO JET〜',
    sourceUrl: 'https://www.kagoshima-sr.jp/schedule/2026%E5%B9%B4/6%E6%9C%88/',
    checkedOn: CHECKED,
  },
  {
    venueId: 'KGS-001',
    artist: 'NSP 平賀和人／ゆりえ／円山天使',
    date: '2026-06-05',
    sourceUrl: 'https://www.kagoshima-sr.jp/schedule/2026%E5%B9%B4/6%E6%9C%88/',
    checkedOn: CHECKED,
  },
  {
    venueId: 'KGS-001',
    artist: 'ワタナベシンゴ（THE BOYS&GIRLS）／Tonto／ゆーか',
    date: '2025-10-30',
    title: 'Acoustic Live "SANMA"',
    sourceUrl: 'https://www.kagoshima-sr.jp/schedule/2025%E5%B9%B4/10%E6%9C%88/',
    checkedOn: CHECKED,
  },
  {
    venueId: 'KGS-001',
    artist: '宇徳敬子',
    date: '2025-10-04',
    title: '宇徳敬子 Acoustic Live 2025～Alone Together～IN 鹿児島',
    sourceUrl: 'https://www.kagoshima-sr.jp/schedule/2025%E5%B9%B4/10%E6%9C%88/',
    checkedOn: CHECKED,
  },
  {
    venueId: 'KGS-001',
    artist: 'パーティー／ファーストコンタクト／きゃなえともう一人',
    date: '2024-09-23',
    title: 'THE KAGONMANZAI',
    sourceUrl: 'https://www.kagoshima-sr.jp/schedule/2024%E5%B9%B4/9%E6%9C%88/',
    checkedOn: CHECKED,
  },
  // Restaurant Bar CIB（KMM-002）
  {
    venueId: 'KMM-002',
    artist: 'ゆあさみちる',
    date: '2026-11-07',
    title: '夜の音楽室～出張編・秋～',
    sourceUrl: 'https://cib-co.jp/eventcalendar/',
    checkedOn: CHECKED,
  },
  {
    venueId: 'KMM-002',
    artist: 'MALTA',
    date: '2026-11-04',
    title: 'MALTA Hit&Run Special Live!',
    sourceUrl: 'https://cib-co.jp/eventcalendar/',
    checkedOn: CHECKED,
  },
  {
    venueId: 'KMM-002',
    artist: '浜端ヨウヘイ',
    date: '2026-11-03',
    title: '浜端ヨウヘイ LIVE TOUR 2026 "HERE AND THERE" in 熊本',
    sourceUrl: 'https://cib-co.jp/eventcalendar/',
    checkedOn: CHECKED,
  },
  {
    venueId: 'KMM-002',
    artist: '88flavors',
    date: '2026-10-31',
    title: '47都道府県を再びめぐる旅 2026・PLEASURE ! ! !',
    sourceUrl: 'https://cib-co.jp/eventcalendar/?ym=202610',
    checkedOn: CHECKED,
  },
  {
    venueId: 'KMM-002',
    artist: '伊藤大輔',
    date: '2026-10-28',
    title: 'Voice Solo 20周年記念ツアー',
    sourceUrl: 'https://cib-co.jp/eventcalendar/?ym=202610',
    checkedOn: CHECKED,
  },
  // BRICK BLOCK（OIT-004）
  {
    venueId: 'OIT-004',
    artist: 'Trio The Glory',
    date: '2026-11-11',
    sourceUrl: 'https://www.b-block.net/brickblock_live/8804/',
    checkedOn: CHECKED,
  },
  {
    venueId: 'OIT-004',
    artist: '近藤房之助',
    date: '2026-11-06',
    sourceUrl: 'https://www.b-block.net/brickblock_live/8573/',
    checkedOn: CHECKED,
  },
  {
    venueId: 'OIT-004',
    artist: 'VOICE',
    date: '2026-11-05',
    title: 'VOICE 33 Anniversary tour in 大分',
    sourceUrl: 'https://www.b-block.net/brickblock_live/8572/',
    checkedOn: CHECKED,
  },
  {
    venueId: 'OIT-004',
    artist: 'ゆあさみちる',
    date: '2026-11-02',
    title: 'ゆあさみちる大分公演 ～ジャズみ～',
    sourceUrl: 'https://www.b-block.net/brickblock_live/8570/',
    checkedOn: CHECKED,
  },
  // Event Space R BASE（SAG-003）
  {
    venueId: 'SAG-003',
    artist: '清水ひろたか／pepe伊藤',
    date: '2026-10-19',
    title: '黄金のギターを弾く男とブラジルの男 LIVE 2026',
    sourceUrl: 'https://t-a-music.wixsite.com/b-shuffle/2026%E5%B9%B4-10%E6%9C%88',
    checkedOn: CHECKED,
  },
  // 久留米シティプラザ Cボックス（FUK-019）
  {
    venueId: 'FUK-019',
    artist: '落語教育委員会',
    date: '2025-08-22',
    title: '久留米で落語の会',
    sourceUrl: CBOX_PDF_2025_08,
    checkedOn: CHECKED_CBOX,
  },
  {
    venueId: 'FUK-019',
    artist: '戒重守（office音の森）',
    date: '2025-08-12',
    title: '第41回 音の森ピアノコンサート',
    sourceUrl: CBOX_PDF_2025_08,
    checkedOn: CHECKED_CBOX,
  },
  {
    venueId: 'FUK-019',
    artist: '石原海',
    date: '2024-11-30',
    title: '『重力の光：祈りの記録篇』',
    sourceUrl: CBOX_PDF_2024,
    checkedOn: CHECKED_CBOX,
  },
  {
    venueId: 'FUK-019',
    artist: '木ノ下裕一',
    date: '2024-07-27',
    title: '『ひらたい古典』',
    sourceUrl: CBOX_PDF_2024,
    checkedOn: CHECKED_CBOX,
  },
  {
    venueId: 'FUK-019',
    artist: '神里雄大／岡崎藝術座',
    date: '2023-09-02',
    title: '『イミグレ怪談』',
    sourceUrl: CBOX_PDF_2023,
    checkedOn: CHECKED_CBOX,
  },
];
