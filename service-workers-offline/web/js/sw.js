"use strict";

var version = 7;
var isOnline = true;
var isLoggedIn = false;
var cacheName = `ramblings-${version}`;
var allPostsCaching = false;

var urlsToCache = {
  loggedOut: [
    "/",
    "/about",
    "/contact",
    "/404",
    "/login",
    "/offline",
    "/css/style.css",
    "/js/blog.js",
    "/js/home.js",
    "/js/login.js",
    "/js/add-post.js",
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
            return;
          }
        }

        let fetchOptions = {
          method: "GET",
          cache: "no-store",
          credentials: "omit",
        };
        res = await fetch(url, fetchOptions);
        if (res.ok) {
          return cache.put(url, res);
        }
      } catch (err) {}
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

async function sendMessage(msg) {
  var allClients = await clients.matchAll({ includeUncontrolled: true });
  return Promise.all(
    allClients.map(function sendTo(client) {
      var chan = new MessageChannel();
      chan.port1.onmessage = onMessage;
      return client.postMessage(msg, [chan.port2]);
    })
  );
}

function onMessage({ data }) {
  if ("statusUpdate" in data) {
    ({ isOnline, isLoggedIn } = data.statusUpdate);
    console.log(
      `Service Worker (v${version}) status update... isOnline:${isOnline}, isLoggedIn:${isLoggedIn}`
    );
  }
}

async function router(req) {
  var url = new URL(req.url);
  var reqURL = url.pathname;
  var cache = await caches.open(cacheName);

  // request for site's own URL?
  if (url.origin == location.origin) {
    // are we making an API request?
    if (/^\/api\/.+$/.test(reqURL)) {
      let fetchOptions = {
        credentials: "same-origin",
        cache: "no-store",
      };
      let res = await safeRequest(
        reqURL,
        req,
        fetchOptions,
        /*cacheResponse=*/ false,
        /*checkCacheFirst=*/ false,
        /*checkCacheLast=*/ true,
        /*useRequestDirectly=*/ true
      );
      if (res) {
        if (req.method == "GET") {
          await cache.put(reqURL, res.clone());
        }
        // clear offline-backup of successful post?
        else if (reqURL == "/api/add-post") {
          await idbKeyval.del("add-post-backup");
        }
        return res;
      }

      return notFoundResponse();
    }
    // are we requesting a page?
    else if (req.headers.get("Accept").includes("text/html")) {
      // login-aware requests?
      if (/^\/(?:login|logout|add-post)$/.test(reqURL)) {
        let res;

        if (reqURL == "/login") {
          if (isOnline) {
            let fetchOptions = {
              method: req.method,
              headers: req.headers,
              credentials: "same-origin",
              cache: "no-store",
              redirect: "manual",
            };
            res = await safeRequest(reqURL, req, fetchOptions);
            if (res) {
              if (res.type == "opaqueredirect") {
                return Response.redirect("/add-post", 307);
              }
              return res;
            }
            if (isLoggedIn) {
              return Response.redirect("/add-post", 307);
            }
            res = await cache.match("/login");
            if (res) {
              return res;
            }
            return Response.redirect("/", 307);
          } else if (isLoggedIn) {
            return Response.redirect("/add-post", 307);
          } else {
            res = await cache.match("/login");
            if (res) {
              return res;
            }
            return cache.match("/offline");
          }
        } else if (reqURL == "/logout") {
          if (isOnline) {
            let fetchOptions = {
              method: req.method,
              headers: req.headers,
              credentials: "same-origin",
              cache: "no-store",
              redirect: "manual",
            };
            res = await safeRequest(reqURL, req, fetchOptions);
            if (res) {
              if (res.type == "opaqueredirect") {
                return Response.redirect("/", 307);
              }
              return res;
            }
            if (isLoggedIn) {
              isLoggedIn = false;
              await sendMessage("force-logout");
              await delay(100);
            }
            return Response.redirect("/", 307);
          } else if (isLoggedIn) {
            isLoggedIn = false;
            await sendMessage("force-logout");
            await delay(100);
            return Response.redirect("/", 307);
          } else {
            return Response.redirect("/", 307);
          }
        } else if (reqURL == "/add-post") {
          if (isOnline) {
            let fetchOptions = {
              method: req.method,
              headers: req.headers,
              credentials: "same-origin",
              cache: "no-store",
            };
            res = await safeRequest(
              reqURL,
              req,
              fetchOptions,
              /*cacheResponse=*/ true
            );
            if (res) {
              return res;
            }
            res = await cache.match(isLoggedIn ? "/add-post" : "/login");
            if (res) {
              return res;
            }
            return Response.redirect("/", 307);
          } else if (isLoggedIn) {
            res = await cache.match("/add-post");
            if (res) {
              return res;
            }
            return cache.match("/offline");
          } else {
            res = await cache.match("/login");
            if (res) {
              return res;
            }
            return cache.match("/offline");
          }
        }
      }
      // otherwise, just use "network-and-cache"
      else {
        let fetchOptions = {
          method: req.method,
          headers: req.headers,
          cache: "no-store",
        };

        let res = await safeRequest(
          reqURL,
          req,
          fetchOptions,
          /*cacheResponse=*/ false,
          /*checkCacheFirst=*/ false,
          /*checkCacheLast=*/ true
        );

        if (res) {
          if (!res.headers.get("X-Not-Found")) {
            await cache.put(reqURL, res.clone());
          } else {
            await cache.delete(reqURL);
          }
          return res;
        }

        // otherwise, return an offline-friendly page
        return cache.match("/offline");
      }
    }
    // all other files use "cache-first"
    else {
      let fetchOptions = {
        method: req.method,
        headers: req.headers,
        cache: "no-store",
      };
      let res = await safeRequest(
        reqURL,
        req,
        fetchOptions,
        /*cacheResponse=*/ true,
        /*checkCacheFirst=*/ true
      );
      if (res) {
        return res;
      }

      // otherwise, force a network-level 404 response
      return notFoundResponse();
    }
  }
}

function notFoundResponse() {
  return new Response("", {
    status: 404,
    statusText: "Not Found",
  });
}

async function safeRequest(
  reqURL,
  req,
  options,
  cacheResponse = false,
  checkCacheFirst = false,
  checkCacheLast = false,
  useRequestDirectly = false
) {
  var cache = await caches.open(cacheName);
  var res;

  if (checkCacheFirst) {
    res = await cache.match(reqURL);
    if (res) {
      return res;
    }
  }

  if (isOnline) {
    try {
      if (useRequestDirectly) {
        res = await fetch(req, options);
      } else {
        res = await fetch(req.url, options);
      }

      if (res && (res.ok || res.type == "opaqueredirect")) {
        if (cacheResponse) {
          await cache.put(reqURL, res.clone());
        }
        return res;
      }
    } catch (err) {}
  }

  if (checkCacheLast) {
    res = await cache.match(reqURL);
    if (res) {
      return res;
    }
  }
}
