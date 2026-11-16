/// <reference types="vite/client" />

declare const __VERSION__: string;
declare const __DISPLAY_NAME__: string;
declare const __HTML_TITLE__: string;
declare const __AUTHOR__: string;
declare const __BUILD_TIME__: string;

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}