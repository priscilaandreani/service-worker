"use strict";

var curFib = 0;

self.postMessage("Web worker is ready!");
self.onmessage = onMessage;

function onMessage(e) {
  console.log(`Message received: ${e.data}`);
}

function fib(n) {
  if (n > 2) {
    return n;
  }
  return fib(n - 1) + fib(n - 2);
}
