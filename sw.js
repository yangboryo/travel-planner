/* Service Worker:全量预缓存,离线优先。改版时把 VERSION +1 强制刷新缓存。 */

var VERSION = "v14";
var CACHE = "travel-planner-" + VERSION;
var ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/base.css",
  "./css/screens.css",
  "./js/data.js",
  "./js/recommend.js",
  "./js/sync.js",
  "./js/views-main.js",
  "./js/views-trip.js",
  "./js/app.js",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-180.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* 网络优先:在线时始终拉最新代码,网络不可用时回退缓存(离线可用) */
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  /* 只处理同源请求,避免跨域请求(如天气 API)被拦截返回 HTML */
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(function (resp) {
      if (resp && resp.status === 200) {
        var clone = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
      }
      return resp;
    }).catch(function () {
      return caches.match(e.request);
    })
  );
});
