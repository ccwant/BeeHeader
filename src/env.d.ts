/// <reference types="vite/client" />

declare const __VERSION__: string;
declare const __DISPLAY_NAME__: string;
declare const __HTML_TITLE__: string;
declare const __AUTHOR__: string;
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
  readonly VITE_DISPLAY_NAME: string;
  readonly VITE_AUTHOR: string;
  readonly VITE_BUILD_TIME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}