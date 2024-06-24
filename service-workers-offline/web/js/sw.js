"use strict";

const version = 1;

self.addEventListener("install", onInstall);
self.addEventListener("activate", onActivate);

main().catch(console.error);

async function main() {
  console.log(`Service Worker (${version}) is starting...`);
}

async function onInstall(e) {
  console.log(`Service Worker (${version}) installed.`);
  self.skipWaiting();
}

function onActivate(e) {
  console.log(`Service Worker (${version}) activated.`);
  e.waitUntil(handleActivation()); // wait until the promise is resolved, even if the browser is closed
}

async function handleActivation() {
  await clients.claim(); // take control of the all the pages immediately
  console.log(`Service Worker (${version}) is activated.`);
}
