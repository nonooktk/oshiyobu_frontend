// 音源ファイル（G-04）。称賛の音のうち、次の 3 場面だけ、ファイルに差し替えられる。ほかの場面は、sound.ts の合成のまま。
//   join（申し込んだ瞬間）・friend（仲間を呼んだ瞬間）・fever（最後の演出＝開催決定）
// ファイルの置き場は public/sounds/ だけ。同じ場所の台帳（ledger.md）に、出どころ・作者・ライセンス（CC0 か自作）・確認日を書く。
// 台帳に無い音声ファイルと、上の 3 場面の外での使い方は、tests/guard/sound-files.test.ts が止める。
// 賭けを連想させる音は、合成にも、ファイルにも入れない（G-04。語の一覧は tests/guard/helpers.ts）。
// ファイルは、画面と同じ配信元から読む（外部の配信元は使わない。API でもない。CSP の connect-src 'self' の中）。
//
// 音を足すとき（B・C）: ① ファイルを public/sounds/ に置く ② 台帳に 1 行 ③ 下の対応表に 1 行。ほかは、変えない。

/** 音源ファイルに差し替えてよい場面（G-04）。この 3 つだけ */
export type FileCue = 'join' | 'friend' | 'fever';
/** 音源ファイルに差し替えてよい場面の一覧 */
export const FILE_CUES: readonly FileCue[] = ['join', 'friend', 'fever'];

export interface SoundFile {
  /** 配信される場所（public/sounds/ の下。画面と同じ配信元の絶対パス） */
  readonly url: string;
  /**
   * 音量（0〜1）。変換のとき、ファイルのピークを -1 dBFS 前後にそろえてあるので、この値が、そのまま出力のピークに近い。
   * 合成の音（1 つの音のピークが 0.1 まで）と大きく違わないように決める。
   */
  readonly gain: number;
}

export type SoundFileMap = Readonly<Partial<Record<FileCue, SoundFile>>>;

/**
 * 場面 → 音源ファイルの対応表。ここに無い場面は、合成の音を鳴らす（ファイルが届くまで、そのまま）。
 * join は A-join.mp3（台帳 public/sounds/ledger.md）。friend（B）・fever（C）は、ファイルが届いたら、1 行ずつ足す。
 */
export const SOUND_FILES: SoundFileMap = {
  join: { url: '/sounds/A-join.mp3', gain: 0.11 },
};

/**
 * 音源ファイルを、バイト列で読む。画面と同じ配信元から読む（API ではない）。
 * 読めなかったとき（通信の失敗・404 など）は失敗にする（壊れた中身を復号に渡さない）。呼ぶ側が、合成の音に切り替える。
 */
export async function fetchSoundBytes(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  // 画面には出ない文（呼ぶ側が握りつぶす）。書体の字の検査が、文字列の字を数えるので、ASCII で書く
  if (!response.ok) throw new Error(`sound file: HTTP ${response.status}`);
  return response.arrayBuffer();
}
