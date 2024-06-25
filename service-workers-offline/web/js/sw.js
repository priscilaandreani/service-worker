"use strict";

const version = 6;
var isOnline = true;
var isLoggedIn = false;
var cacheName = `ramblings-${version}`;

var urlsToCache = {
  // urls as clients will request them
  loggedOut: [
    "/",
    "/about",
    "/contact",
    "/404",
    "/login",
    "/offline",
    "/js/blog.js",
    "/js/home.js",
    "/js/login.js",
    "/js/add-post.js",
    "/css/style.css",
    "/images/logo.gif",
    "/images/offline.png",
  ],
};

self.addEventListener("install", onInstall);
self.addEventListener("activate", onActivate);
self.addEventListener("message", onMessage);
self.addEventListener("fetch", onFetch);

main().catch(console.error);

async function main() {
  console.log(`Service Worker (${version}) is starting...`);
  await clearCaches();
  await cacheLoggedOutFiles();
  await sendMessage({ requestStatusUpdate: true });
}

async function onInstall(e) {
  console.log(`Service Worker (${version}) installed.`);
  self.skipWaiting();
}

async function sendMessage(msg) {
  var allClients = await clients.matchAll({ includeUncontrolled: true });
  return Promise.all(
    allClients.map(function clientMsg(client) {
      var channel = new MessageChannel();
      channel.port1.onmessage = onMessage;
      return client.postMessage(msg, [channel.port2]);
    })
  );
}

function onActivate(e) {
  console.log(`Service Worker (${version}) activated.`);
  e.waitUntil(handleActivation()); // wait until the promise is resolved, even if the browser is closed
}

function onMessage({ data }) {
  if (data.statusUpdate) {
    ({ isOnline, isLoggedIn } = data.statusUpdate);
    console.log(
      `Service Worker (${version}) status update, isOnline: ${isOnline}, isLoggedIn: ${isLoggedIn}`
    );
  }
}

async function handleActivation() {
  await clients.claim(); // take control of the all the pages immediately
  await cacheLoggedOutFiles(/* forcedRelod=*/ true);
  console.log(`Service Worker (${version}) is activated.`);
}

async function cacheLoggedOutFiles(forceReload = false) {
  var cache = await caches.open(cacheName);

  return Promise.all(
    urlsToCache.loggedOut.map(async function requestFile(url) {
      try {
        let res;
        if (!forceReload) {
          res = await cache.match(url);
          if (res) {
            return res;
          }
        }

        let fetchOptions = {
          method: "GET",
          cache: "no-cache", // dont use the browser cache
          credentials: "omit",
        };

        res = await fetch(url, fetchOptions);
        if (res.ok) {
          await cache.put(url, res); // you almost always wanna do a clone on that response
        }
      } catch {}
    })
  );
}

async function clearCaches() {
  var cacheNames = await caches.keys();
  var oldCacheNames = cacheNames.filter(function matchOldCache(cacheName) {
    if (/^ramblings-\d+$/.test(cacheName)) {
      let [, cacheVersion] = cacheName.match(/^ramblings-(\d+)$/);
      cacheVersion = cacheVersion != null ? Number(cacheVersion) : cacheVersion;
      return cacheVersion > 0 && cacheVersion != version;
    }
  });

  return Promise.all(
    oldCacheNames.map(function deleteCache(cacheName) {
      return caches.delete(cacheName);
    })
  );
}

function onFetch(e) {
  e.respondWith(router(e.request));
}

async function router(req) {
  var url = new URL(req.url);
  var reqURL = url.pathname;
  var cache = await caches.open(cacheName);

  //same site URL
  if (url.origin == location.origin) {
    // are we making an API request?
    if (/^\/api\/.+$/.test(reqURL)) {
      let res;

      if (isOnline) {
        try {
          let fetchOptions = {
            method: req.method,
            headers: req.headers,
            credentials: "same-origin",
            cache: "no-cache",
          };

          res = await fetch(req.url, fetchOptions);
          if (res.ok) {
            if (req.method == "GET") {
              await cache.put(reqURL, res.clone());
            }
            return res;
          }
        } catch (err) {}
      }

      res = await cache.match(reqURL);

      if (res) {
        return res;
      }

      return notFoundResponse();
    }

    // are we requesting a page?
    else if (req.headers.get("Accept").includes("text/html")) {
      // login-aware requests?
      if (/ˆ\/(?:login|logout|add-post)$/.test(reqURL)) {
        //TODO
      }
      // otherwise, just use "network-and-cache"
      else {
        let res;

        if (isOnline) {
          try {
            let fetchOptions = {
              mehtod: req.method,
              headers: req.headers,
              cache: "no-cache",
            };

            res = await fetch(req.url, fetchOptions);

            if (res && res.ok) {
              if (!res.headers.get("X-Not-Found")) {
                await cache.put(reqURL, res.clone());
              }
              return res;
            }
          } catch (err) {}
        }

        // fetch failed, so try use cache

        res = await cache.match(reqURL);
        if (res) {
          return res;
        }

        //otherwise, return an offline-friendly page
        return cache.match("/offline");
      }
    }
    // all others files use "cache-first"
    else {
      let res;

      if (res) {
        return res;
      } else {
        if (isOnline) {
          try {
            let fetchOptions = {
              method: req.method,
              headers: req.headers,
              cache: "no-cache",
            };

            res = await fetch(req.url, fetchOptions);
            if (res && res.ok) {
              await cache.put(reqURL, res.clone());
              return res;
            }
          } catch (err) {}
        }
        //otherwise, force a network level 404 response
        return notFoundResponse();
      }
    }
  }
}

function notFoundResponse() {
  return new Response("", {
    status: 404,
    statusText: "Not Found",
  });
}
