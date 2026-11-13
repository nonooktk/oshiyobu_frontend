// 元絵（assets-src/）を、表示の大きさに縮めた WebP にして、src/assets/img/ に置く（設計 D-40）。
//   npm run images
// 絵を差し替えたら、これを実行する。出力の一覧は scripts/images-config.mjs。sharp が動かない環境では、統括に依頼する
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { ROOT } from './core-lib.mjs';
import { IMAGES } from './images-config.mjs';

const SRC = join(ROOT, 'assets-src');
const OUT = join(ROOT, 'src', 'assets', 'img');
mkdirSync(OUT, { recursive: true });

let total = 0;
for (const image of IMAGES) {
  const out = join(OUT, image.out);
  const pipeline = sharp(join(SRC, image.src));
  const meta = await pipeline.metadata();
  const width = Math.min(image.width ?? meta.width ?? 0, meta.width ?? 0);
  await pipeline
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: image.quality })
    .toFile(out);
  const bytes = statSync(out).size;
  total += bytes;
  const flag = bytes > image.maxBytes ? '  ← 上限（' + image.maxBytes + ' B）を超えています' : '';
  console.log(
    `${image.out.padEnd(26)} ${String(width).padStart(5)}px ${String(bytes).padStart(7)} B${flag}`,
  );
}
console.log(`合計 ${total} B（${IMAGES.length} 枚）`);
