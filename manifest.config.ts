import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "BeeHeader",
  version: "1.0.0",
  description: "Lightweight HTTP header editor. A clean ModHeader alternative.",
  permissions: [
    "storage",
    "tabs",
    "declarativeNetRequest",
    "declarativeNetRequestWithHostAccess",
  ],
  host_permissions: ["*://*/*"],
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  action: {
    default_popup: "src/ui/popup/index.html",
    default_title: "BeeHeader",
    default_icon: {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png",
    },
  },
  content_scripts: [
    {
      matches: ["https://beeheader.com/s*", "https://www.beeheader.com/s*"],
      js: ["src/content/index.ts"],
      run_at: "document_start",
    },
  ],
  icons: {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
  },
  web_accessible_resources: [],
  declarative_net_request: { rule_resources: [] },
});
