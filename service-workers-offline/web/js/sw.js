"use strict";

const version = 2;
var isOnline = true;
var isLoggedIn = false;

self.addEventListener("install", onInstall);
self.addEventListener("activate", onActivate);
self.addEventListener("message", onMessage);

main().catch(console.error);

async function main() {
  console.log(`Service Worker (${version}) is starting...`);
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
  console.log(`Service Worker (${version}) is activated.`);
}
