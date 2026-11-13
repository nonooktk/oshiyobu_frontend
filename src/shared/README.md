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
requestMeterFetch('open' | 'course-select' | 'performance-changed'); // 取得の契機（D-18 の規則 8）
onMeterReset(() => { /* 自分の加算・擬似の仲間の加算を消す */ });
```

- `joined` は、サーバーの申し込みの件数（0 から。開始人数は含まない）。表示する人数は、core の
  `displayedCount(condition.start, { serverJoined: meter.joined, counted: meter.mineCounted, joined: 申し込み済みか, pseudoFriends })` で出します
- `resetEpoch` が増えたら reset があったので、「自分の加算・擬似の仲間の加算」を消します（達成した行動・開いた特典・呼んだ仲間・口座・演出の済みは変えません。D-18 の規則 10）。`mineCounted` は内側で false に戻ります。reset のあとは、同じコースをもう一度押せます（`joinPerformance` を呼び直す）
- 取得の契機: ① ファン向けを開いた直後に `requestMeterFetch('open')`（0〜1 秒のゆらぎ）② 3/3 に入ったとき `'course-select'` ③ 推し・市を選び直したとき `'performance-changed'`。④ ホーム以降は `useSharedMeter` が 2 秒おきに取る。どの契機も、前の取得の開始から 1.8 秒未満では送りません。公演が分かる前（`useSharedMeter` を呼ぶ前）の依頼は、覚えておいて、公演が分かったら取ります
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

## 決まり

- `src/shared/**` を変えたら、下の「更新履歴」に 1 行書きます（F-2 の担当が取り込むため）
- 新しい色を足しません。通信は `meter/` の中だけです

## 更新履歴

- F-0b 第 2 の区切り: 共有メーターを実物にした（`meter/client.ts`・`engine.ts`・`config.ts`。取得の契機 4 つ・下限 1.8 秒・待ち 8 秒・遅れた応答も使う・申し込みの再送・reset の検知・古い連番の捨て）。`useSharedMeter` に `{ poll: false }`、発表者用に `resetSharedMeter`・`checkApiHealth` を追加。`public/simulator.html`（script は元のまま。ハッシュで固定）と `public/assets/logo-wide.png` を配置。`vite.config.ts` に preconnect の差し込み、ESLint に `fetch` の禁止（`meter/` の中だけ許可）、`.prettierignore` に `public/simulator.html` を追加

- F-0b 第 1 の区切り: `core:sync`・`core:check` と `src/core/`（backend 1dff053）／`device`・`persona`・`link`・`condition`・`meter`（スタブ）・`prefetch`・`mount` の `ErrorBoundary` を追加。`package.json` に zustand と `core:sync`・`core:check`、`tsconfig.app.json` に node の型（テスト用）、ESLint に `src/**` の `process`・`Buffer` の禁止と `_` 始まりの未使用引数の許可、`ci.yml` に `core:check` を追加
- F-1: `src/office/`・`src/presenter/` を実装（`src/shared/` の変更: `meter/index.ts` に `API_CONFIGURED` を追加。F-2 への影響なし）。`vite.config.ts`・`package.json` の変更なし。`src/assets/img/artist-*.webp`（5 組の丸い絵。192px の WebP）と、元絵 `assets-src/artist-*.jpg` を追加（F-3 の `npm run images` で置き換える）
