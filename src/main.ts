import './styles/app.css';

import { App } from './app.js';
import { Dictionary } from './dict/dictionary.js';
import { UI } from './ui/strings.js';

const loading = document.getElementById('loading');

async function boot(): Promise<void> {
  const dictionary = await Dictionary.load();
  const app = new App(dictionary);
  app.start();
  if (loading) loading.hidden = true;
}

boot().catch((error: unknown) => {
  console.error(error);
  if (loading) {
    loading.dataset.error = 'true';
    loading.textContent = UI.loadFailed;
  }
});
