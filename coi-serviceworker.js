/*! coi-serviceworker v0.1.7 - Guido Zuidhof, licensed under MIT */
/* Adds COOP/COEP headers via a service worker so crossOriginIsolated
   (and therefore SharedArrayBuffer, required by ffmpeg.wasm) works on
   static hosts like GitHub Pages that can't set custom response headers. */
let coepCredentialless = false;
const FFMPEG_CACHE = "d4nzxml-ffmpeg-cache-v1";
/** Anything matching this is large (~25-30MB) and version-pinned in the
 *  URL (e.g. /core-mt@0.11.0/), so it's safe to cache forever and skip
 *  re-downloading on every visit. */
const isFfmpegAsset = (url) => /unpkg\.com\/@ffmpeg\/core@/.test(url);

if (typeof window === 'undefined') {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

  self.addEventListener("message", (ev) => {
    if (!ev.data) return;
    if (ev.data.type === "deregister") {
      self.registration
        .unregister()
        .then(() => self.clients.matchAll())
        .then(clients => clients.forEach(client => client.navigate(client.url)));
    } else if (ev.data.type === "coepCredentialless") {
      coepCredentialless = ev.data.value;
    }
  });

  self.addEventListener("fetch", function (event) {
    const r = event.request;
    if (r.cache === "only-if-cached" && r.mode !== "same-origin") return;

    /* ── cache-first for ffmpeg-core (js/wasm/worker) ── */
    if (isFfmpegAsset(r.url)) {
      event.respondWith(
        caches.open(FFMPEG_CACHE).then(async (cache) => {
          const cached = await cache.match(r.url);
          if (cached) return cached;
          const fresh = await fetch(r, { mode: "cors" });
          if (fresh && fresh.status === 200) cache.put(r.url, fresh.clone());
          return fresh;
        }).catch(() => fetch(r))
      );
      return;
    }

    const request = (coepCredentialless && r.mode === "no-cors")
      ? new Request(r, { credentials: "omit" })
      : r;
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 0) return response;

          const newHeaders = new Headers(response.headers);
          newHeaders.set("Cross-Origin-Embedder-Policy", coepCredentialless ? "credentialless" : "require-corp");
          if (!coepCredentialless) newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");
          newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

          return new Response(response.body, { status: response.status, statusText: response.statusText, headers: newHeaders });
        })
        .catch((e) => console.error(e))
    );
  });
} else {
  (() => {
    const reloadedBySelf = window.sessionStorage.getItem("coiReloadedBySelf");
    window.sessionStorage.removeItem("coiReloadedBySelf");
    const coepDegrading = (reloadedBySelf == "coepdegrade");

    if (window.crossOriginIsolated !== false || !window.isSecureContext) return;

    if (!window.isSecureContext) {
      console.log("[coi] not in a secure context, skipping COOP/COEP registration.");
      return;
    }

    if (!navigator.serviceWorker) {
      console.error("[coi] Service worker registration unavailable.");
      return;
    }

    navigator.serviceWorker.register(window.document.currentScript.src).then(
      (registration) => {
        console.log("[coi] Service worker registered:", registration.scope);
        registration.addEventListener("updatefound", () => {
          window.sessionStorage.setItem("coiReloadedBySelf", "updatefound");
          window.location.reload();
        });
        if (registration.active && !navigator.serviceWorker.controller) {
          window.sessionStorage.setItem("coiReloadedBySelf", "notcontrolled");
          window.location.reload();
        }
      },
      (err) => console.error("[coi] Service worker registration failed:", err)
    );
  })();
}
