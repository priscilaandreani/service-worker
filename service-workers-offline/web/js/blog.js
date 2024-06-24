(function Blog() {
  "use strict";

  var offlineIcon;
  var isOnline = "onLine" in navigator ? navigator.onLine : true;
  var isLoggedIn = /isLoggedIn=1/.test(document.cookie.toString() || "");

  var usingSW = "serviceWorker" in navigator;
  var swRegistration;
  var svcworker;

  document.addEventListener("DOMContentLoaded", ready, false);

  initServiceWorker().catch(console.error);

  // **********************************

  function ready() {
    offlineIcon = document.getElementById("connectivity-status");

    if (!isOnline) {
      offlineIcon.classList.remove("hidden");
    }

    window.addEventListener("online", () => {
      offlineIcon.classList.add("hidden");
      isOnline = true;
      sendStatusUpdate();
    });

    window.addEventListener("offline", () => {
      offlineIcon.classList.remove("hidden");
      isOnline = false;
      sendStatusUpdate();
    });
  }

  async function initServiceWorker() {
    swRegistration = await navigator.serviceWorker.register("/sw.js", {
      updateViaCache: "none",
    });

    svcworker =
      swRegistration.installing ||
      swRegistration.waiting ||
      swRegistration.active;

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      function onControllerChange() {
        svcworker = navigator.serviceWorker.controller;
        sendStatusUpdate(svcworker);
      }
    );

    navigator.serviceWorker.addEventListener("message", onSWMessage);
  }

  function onSWMessage(e) {
    var { data } = e;
    if (data.requestStatusUpdate) {
      console.log("Received status update request from service worker.");
      sendStatusUpdate(e.ports && e.ports[0]);
    }
  }

  function sendStatusUpdate(target) {
    sendSWMessage({ statusUpdate: { isOnline, isLoggedIn } }, target);
  }

  async function sendSWMessage(msg, target) {
    if (target) {
      target.postMessage(msg);
    } else if (svcworker) {
      svcworker.postMessage(msg);
    } else {
      //fallback
      navigator.serviceWorker.controller.postMessage(msg);
    }
  }
})();
