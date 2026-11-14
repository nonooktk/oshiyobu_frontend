# src/shared/

3 ページ（事務所向け・ファン向け・発表者用）で共有する部分です。持ち主は F-0 の担当（ポリゴン）で、F-2 の担当へ引き継ぎます（常に 1 人。設計 D-35）。
**F-2・F-1 は、ここを直さず、変えたいときはコーディネーターに頼みます。**

## 使い方（レーン間の I/F。設計 D-35）

「いま」の列が **スタブ** の所は、型と動きはこのまま、中身を実物に替えます（F-2 から見た型と動きは変えません）。第 2 の区切りで、スタブは無くなりました（共有メーターは実物）。

| I/F | ファイル | いま | 使い方 |
| --- | --- | --- | --- |
| 端末の番号 | `device.ts` | 実物 | `getDeviceId()`。localStorage の `oshiyobu.v1.device` に 1 つだけ残る。使えなければメモリの番号 |
| 人物 | `persona.ts` | 実物 | `getPersona()` が、`?p=1〜15` か端末の番号から人物を返す。`getPersonaPerformance(persona)` で、初めの公演 ID と会場 |
| 同じ端末の連動 | `link.ts` | 実物 | 下の「連動」 |
| いま出す条件 | `condition.ts` | 実物 | `useEffectiveCondition(venueId)`。いま出している会場の条件。事務所向けの選択は、同じ会場のときだけ反映（決定 14） |
| 共有メーター | `meter/index.ts` | 実物（接続先が未設定なら、サーバーなしで動く） | 下の「共有メーター」 |
| 先読み・遅れて読む画面 | `prefetch.tsx` | 実物（試験の途中） | 下の「先読み」 |
| ルートの受け皿 | `mount.tsx` | 実物 | `mountPage` が `ErrorBoundary` で包む。各ページは何もしなくてよい |
| 札 | `components/DemoBadge.tsx` | 実物 | `<DemoBadge className? />`。全画面に出す。消さない |

core（計算とデータ）は `src/core/`（backend の写し。手で直さない）から `import { conditionOf, ... } from '../core'` で使います。画面に出す人数・成立の判定は、`displayedCount`・`supportStatus` などを使い、画面の側で同じ式を書きません。

### 連動（`link.ts`。設計 D-44）

```ts
// 事務所向け: 選択が変わるたびに呼ぶ（100 ms でまとめて送る）。起動直後にも 1 回呼ぶ
publishOffice({ venueId, costs, minPeople }); // minPeople は手で決めていなければ null
broadcastResetAll(); // 「デモを最初に戻す」

// ファン向け
const linked = useLinkedOffice(); // { selection, receivedAt } か null。届くたびに描き直す
useEffect(() => onResetAll(resetFan), []); // resetFan は F-2 が作る（人物の初期値に戻す）。共有メーターには触らない
```

- 開く順は、事務所向け（`/`）が先、ファン向け（`/fan/`）があと。ファン向けが起動時に hello を送り、事務所向けが選択を返します
- 起動直後に先に描くのは人物の値です。連動の返事が 300 ms 以内に来て（`receivedAt` と起動時刻の差で判断）、まだ選び直していなければ、初めの値（市）を取り替えます（F-2 が行う）
- BroadcastChannel が使えなくても、エラーにしません（連動しないだけ）

### 共有メーター（`meter/index.ts`。設計 D-17・D-18・D-41）

```ts
const meter = useSharedMeter(performanceId);                  // { joined, status, mineCounted, resetEpoch }。ホーム以降で呼ぶ（2 秒おきに取る）
const meter = useSharedMeter(performanceId, { poll: false }); // 値を読むだけの画面（はじめの画面）。2 秒おきには取らない
joinPerformance(performanceId);                               // 申し込み。すぐ戻る。失敗しても例外を投げない。再送は内側
requestMeterFetch('open' | 'course-select' | 'performance-changed', performanceId?); // 取得の契機（D-18 の規則 8）。公演を渡すと、その公演を取る
onMeterReset(() => { /* 自分の加算・擬似の仲間の加算を消す */ });
```

- `joined` は、サーバーの申し込みの件数（0 から。開始人数は含まない）。表示する人数は、core の
  `displayedCount(condition.start, { serverJoined: meter.joined, counted: meter.mineCounted, joined: 申し込み済みか, pseudoFriends })` で出します
- `resetEpoch` が増えたら reset があったので、「自分の加算・擬似の仲間の加算」を消します（達成した行動・開いた特典・呼んだ仲間・口座・演出の済みは変えません。D-18 の規則 10）。`mineCounted` は内側で false に戻ります。reset のあとは、同じコースをもう一度押せます（`joinPerformance` を呼び直す）
- 取得の契機: ① ファン向けを開いた直後に `requestMeterFetch('open')`（0〜1 秒のゆらぎ）② 3/3 に入ったとき `'course-select'`（はじめの画面で選び直して、まだ確定していない公演は、`performanceId` で渡す。見ている公演は古いままのことがある。G2-04）③ 推し・市を選び直したとき `'performance-changed'`。④ ホーム以降は `useSharedMeter` が 2 秒おきに取る。どの契機も、前の取得の開始から 1.8 秒未満では送りません。公演が分かる前（`useSharedMeter` を呼ぶ前）の依頼は、覚えておいて、公演が分かったら取ります
- 隠れている間・回線が切れている間は取りません（戻ったら 1 回すぐ）。失敗が続くと 2 → 4 → 8 → 10 秒と間隔を空け、止めません。待ちは 8 秒で、遅れて届いた応答も使います
- 画面の部品から `fetch` を呼びません（ESLint が止めます）。通信は `src/shared/meter/` の中だけです
- **接続先**: ビルド時の環境変数 `VITE_API_BASE`（例: `https://api.example.test`）で渡します。**未設定なら、サーバーなしで動きます**（`joined` は 0、`status` は `offline`、通信しない）。設定してビルドすると、ファン向けの HTML に `preconnect` が入ります
- `status`（`offline`・`connecting`・`ok`・`failing`）は、ファン向けの画面に出しません（発表者用の画面で使う）
- 発表者用の画面（F-1）: `resetSharedMeter(合言葉)` が、原因ごとの結果（`ok`・`unauthorized`・`not_configured`・`timeout`・`network`・`error`）を返します。`checkApiHealth()` が、生存確認の応答時間を返します

### 先読み・遅れて読む画面（`prefetch.tsx`。設計 D-40）

```ts
// 起動のとき 1 回。絵の ID → URL、推しごとの先読みの順、遅れて読む塊
configurePrefetch({
  images: { 'tech0-full-2': tech0Full2Url, /* ... */ },
  plan: { tech0: ['tech0-full-2', 'tech0-full-3'], krs48: ['krs48-wide'] },
  chunks: { 'fan-pages': () => import('./pages'), 'fan-layers': () => import('./layers') },
});
startPrefetch(artistId);        // performance.mark('oshiyobu:ready') の 1 秒後に呼ぶ
needImage(id, 'high');          // 特典が開くときに呼ぶ
const state = useImageState(id); // 'ready' | 'loading' | 'missing'。missing なら、代わりの絵を出す（空白の枠を出さない）
<ChunkBoundary<PagesModule> name="fan-pages" frame={<枠 />}>{(m) => <m.MenuPage />}</ChunkBoundary>
```

- 先読みは、1 つずつ・低い優先度で、推しの絵 → 塊（`chunks` に書いた順）の順。API の通信が飛んでいる間は始めません
- `loadChunk(name)` は、失敗したら 2・4・8・16 秒後、以後 30 秒おきに再試行します（止めません。エラーの文言も白い画面も出しません）
- `ChunkBoundary` は、塊が来るまで `frame`（枠と操作）を出し、来たら中身を埋めます。中身の描画で例外が出ても `frame` を残し、1 秒後に描き直します

## 絵の名前と置き場（F-3。`npm run images`）

絵は、元絵（`assets-src/`。配信しない）から、表示の大きさに縮めた WebP を `src/assets/img/` に作ります（一覧と幅・品質・上限は `scripts/images-config.mjs`）。**F-2 は、`assets-src/` の元絵を直接 import せず、次の WebP を使います**（元の JPG は 1 枚 600〜780 KB で、N-20 の 300 KB に収まりません）。

| 用途 | ファイル（`src/assets/img/`） | 幅 | 大きさ | 使う場所・読む時期（設計 D-40） |
| --- | --- | --- | --- | --- |
| 推しの丸い絵（5 組） | `artist-tech0.webp`・`artist-krs48.webp`・`artist-rijicho.webp`・`artist-terao.webp`・`artist-heisei.webp` | 192 | 7.7〜14 KB | ピル・見出し・共有カード。**最初の画面で読む** |
| ロゴ | `logo-wide.webp`（136×48 の 2 倍）・`logo-mark.webp`（32×32 の 2 倍） | 272・64 | 3.9 KB・1.0 KB | 最初の画面 |
| 推しの大きい絵（tech0 は 3 枚） | `tech0-full-1-768.webp`・`tech0-full-2-768.webp`・`tech0-full-3-768.webp` | 768 | 97〜99 KB | はじめの画面・ホーム・コースのカード・特典。**`-1` だけ最初の画面。`-2`・`-3` は先読み** |
| 推しの大きい絵（ほかの 3 組） | `krs48-full-768.webp`・`rijicho-full-768.webp`・`terao-full-768.webp` | 768 | 57〜89 KB | 最初の画面で、その人の推しの 1 枚 |
| 特典の絵（ほかの 3 組） | `krs48-full-1152.webp`・`rijicho-full-1152.webp`・`terao-full-1152.webp` | 1152 | 110〜173 KB | 特典の 3 段階（1 枚を切り抜いて広げる）。**先読み** |
| 平成の俺 | `heisei-full.webp`（元の大きさ 384px） | 384 | 34 KB | ホーム・特典・カード。先読みは無い |

- 取り込み方: `import tech0Full1 from '../assets/img/tech0-full-1-768.webp'`（Vite が、ハッシュつきの URL にする）。`configurePrefetch` の `images` に ID と URL を、`plan` に推しごとの先読みの順を渡します（tech0: `-2`・`-3` の順／krs48・riji・terao: `*-1152`／heisei: 絵の先読みなし）
- tech0 の 3 枚は、品質を 62・58・52 に下げて 100 KB に収めています（D-40 の「軽くする順」①）。絵を差し替えたら `npm run images` を実行します。
- ビルドのあとの `npm run check:budget` が、絵の上限と、元絵の形式（jpg・png）のまま配っていないことを検査します。**CI の `verify` では警告だけ**ですが、**配備（`deploy.yml`）では `--strict-images` でエラー**になります。F-2 が WebP に移るまで、ファン向けは jpg を配る警告が出ます（今の dev では 11 件）

## 決まり

- `src/shared/**` を変えたら、下の「更新履歴」に 1 行書きます（F-2 の担当が取り込むため）
- 新しい色を足しません。通信は `meter/` の中だけです

## 更新履歴

- F-0b 第 2 の区切り: 共有メーターを実物にした（`meter/client.ts`・`engine.ts`・`config.ts`。取得の契機 4 つ・下限 1.8 秒・待ち 8 秒・遅れた応答も使う・申し込みの再送・reset の検知・古い連番の捨て）。`useSharedMeter` に `{ poll: false }`、発表者用に `resetSharedMeter`・`checkApiHealth` を追加。`public/simulator.html`（script は元のまま。ハッシュで固定）と `public/assets/logo-wide.png` を配置。`vite.config.ts` に preconnect の差し込み、ESLint に `fetch` の禁止（`meter/` の中だけ許可）、`.prettierignore` に `public/simulator.html` を追加

- F-0b 第 1 の区切り: `core:sync`・`core:check` と `src/core/`（backend 1dff053）／`device`・`persona`・`link`・`condition`・`meter`（スタブ）・`prefetch`・`mount` の `ErrorBoundary` を追加。`package.json` に zustand と `core:sync`・`core:check`、`tsconfig.app.json` に node の型（テスト用）、ESLint に `src/**` の `process`・`Buffer` の禁止と `_` 始まりの未使用引数の許可、`ci.yml` に `core:check` を追加
- F-1: `src/office/`・`src/presenter/` を実装（`src/shared/` の変更: `meter/index.ts` に `API_CONFIGURED` を追加。F-2 への影響なし）。`vite.config.ts`・`package.json` の変更なし。`src/assets/img/artist-*.webp`（5 組の丸い絵。192px の WebP）と、元絵 `assets-src/artist-*.jpg` を追加（F-3 の `npm run images` で置き換える）
- F-0b の追加: 共有メーターが、429 の `Retry-After` を尊重して間隔を空け、409（上限）の申し込みは送信済みとして再送しない（I-49）。`useSharedMeter`・`joinPerformance` の型と動きは変わらない
- F-3: `package.json` に sharp・@playwright/test・`images`・`check:budget`・`check:csp`・`e2e`、`vite.config.ts` に CSP の接続先を足すプラグイン、`public/staticwebapp.config.json` に CSP、`eslint.config.js` と `tsconfig.app.json`（e2e）、`src/core/` を backend 049f6c0（版 0.2.0）に更新。`src/shared/meter/client.ts` が、新しい API のエラー名と、読めない Retry-After を扱う（型と動きは変わらない）。`src/assets/img/` の WebP を作り直し（名前は上の表）
