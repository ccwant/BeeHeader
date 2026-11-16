/**
 * Share-page bridge — keeps BEE_HEADER_* protocol for beeheader.com compatibility.
 */
window.addEventListener(
  "message",
  (event) => {
    if (event.source !== window) return;
    const msg = (event.data || {}) as { type?: string; h?: unknown[] };

    if (msg.type === "BEE_HEADER_PING") {
      window.postMessage({ type: "BEE_HEADER_ACK" }, "*");
      return;
    }

    if (msg.type === "BEE_HEADER_IMPORT" && Array.isArray(msg.h)) {
      void chrome.runtime
        .sendMessage({ action: "importSharedKV", data: { h: msg.h } })
        .then((res) => {
          window.postMessage({ type: "BEE_HEADER_RESULT", success: !!res?.success }, "*");
        })
        .catch((e: Error) => {
          window.postMessage(
            { type: "BEE_HEADER_RESULT", success: false, error: e?.message },
            "*",
          );
        });
    }
  },
  false,
);
