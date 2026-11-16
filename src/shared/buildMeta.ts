/**
 * 构建时由 Vite define 注入的扩展元信息（见 define.config.ts）。
 */
export const APP_VERSION = import.meta.env.VITE_APP_VERSION;
export const DISPLAY_NAME = import.meta.env.VITE_DISPLAY_NAME;
export const AUTHOR = import.meta.env.VITE_AUTHOR;
export const BUILD_TIME = import.meta.env.VITE_BUILD_TIME;