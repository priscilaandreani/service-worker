"use strict";

var curFib = 0;

// self.postMessage("Web worker is ready!");
self.onmessage = onMessage;

function onMessage(e) {
  getNextFib();
}

function getNextFib() {
  var fibNum = fib(curFib);
  self.postMessage({ idx: curFib, fib: fibNum });
  curFib++;
  setTimeout(getNextFib, 0);
}

function fib(n) {
  if (n < 2) {
    return n;
  }
  return fib(n - 1) + fib(n - 2);
}
