import { boot } from 'quasar/wrappers';
const beeJsUrl = new URL(
  '../../../node_modules/@ethersphere/bee-js/dist/index.browser.min.js',
  import.meta.url
).href;

let beeJsLoading: Promise<void> | null = null;

function loadBeeJs(): Promise<void> {
  if (window.BeeJs) {
    return Promise.resolve();
  }
  if (beeJsLoading) {
    return beeJsLoading;
  }
  beeJsLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = beeJsUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load bee-js browser bundle'));
    document.head.appendChild(script);
  });
  return beeJsLoading;
}

export default boot(async () => {
  await loadBeeJs();
});
