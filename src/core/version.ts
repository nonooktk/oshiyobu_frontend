// core の版。数字・計算・データ・API の応答の形を変えたら、上げる。
// frontend は、この版と backend のコミット ID を core.lock.json に固定して取り込む（設計 D-07）。
// API の GET /healthz が、この値を coreVersion として返す。
export const CORE_VERSION = '0.2.0';
