import packageJson from "./package.json" with { type: "json" };

const raw = {
  VERSION: packageJson.version,
  NAME: packageJson.name,
  DISPLAY_NAME: packageJson.displayName,
  AUTHOR: packageJson.author ?? "",
  HTML_TITLE: packageJson.displayName,
  /** 每次 vite build 时写入，供关于页展示 */
  BUILD_TIME: new Date().toISOString(),
};

const define = Object.fromEntries(
  Object.entries(raw).map(([k, v]) => [`__${k}__`, JSON.stringify(v)]),
);

export { raw, define };