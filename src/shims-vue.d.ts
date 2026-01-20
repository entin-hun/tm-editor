/* eslint-disable */

/// <reference types="vite/client" />
/// <reference path="./types/bee-js-browser.d.ts" />

// Mocks all files ending in `.vue` showing them as plain Vue instances
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module 'bee-js-browser?url' {
  const url: string;
  export default url;
}

declare global {
  interface Window {
    BeeJs?: {
      Bee: new (url: string, options?: unknown) => any;
    };
  }
}
