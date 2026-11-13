// 3 ページの一覧（HTML の入り口と、読み込む main.tsx）。ページを足したら、ここに足す。
// HTML の検査（html-entries）と、配信の設定の検査（static-web-app-config）が、同じ一覧を使う
export const PAGES = [
  { html: '/index.html', entry: '/src/office/main.tsx' },
  { html: '/fan/index.html', entry: '/src/fan/main.tsx' },
  { html: '/presenter/index.html', entry: '/src/presenter/main.tsx' },
] as const;
