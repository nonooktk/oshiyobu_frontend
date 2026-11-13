# src/core/

backend の core（計算とデータ）の、固定したコミットの写しを置く場所です。**手で直しません。**

- 今は空です。`core:sync`（F-0b で作る）が、backend のコミットを指定して写し、`core.lock.json` に ID とハッシュを書きます
- 直したいときは、backend で直して、`core:sync` で置き直します（設計 D-07）
- このファイルは、`core:sync` が置き換えます
