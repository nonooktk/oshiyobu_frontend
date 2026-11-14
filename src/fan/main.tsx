import { mountPage } from '../shared/mount';
import { App } from './App';

// ファン向けだけ、書体を差し替える（tokens.css の :root[data-page='fan']）。描く前に、根の要素へ付ける
document.documentElement.dataset.page = 'fan';

mountPage(App);
