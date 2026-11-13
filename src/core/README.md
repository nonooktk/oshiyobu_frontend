# src/core/

backend の core（計算とデータ）の、固定したコミットの写しです。**自動で置かれたファイルです。手で直しません。**

- 直したいときは、backend で直して、`npm run core:sync` で置き直します（設計 D-07）
- 手で直すと、`npm run core:check` が落ちます（CI も落ちます）
- このファイルは、`core:sync` が置き換えます
