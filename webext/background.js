// webext/background.js
(function () {
  "use strict";

  // Function to update the action button based on URL
  function updateActionButton(tabId, url) {
    if (url && url.startsWith("https://arxiv.org/pdf/")) {
      chrome.action.enable(tabId);
    } else {
      chrome.action.disable(tabId);
    }
  }

  // Listen for tab activation
  chrome.tabs.onActivated.addListener(function (activeInfo) {
    chrome.tabs.get(activeInfo.tabId, function (tab) {
      updateActionButton(tab.id, tab.url);
    });
  });

  // Listen for tab updates
  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status === "complete") {
      updateActionButton(tabId, tab.url);
    }
  });

  // Handle action button clicks
  chrome.action.onClicked.addListener(function (tab) {
    chrome.tabs.sendMessage(tab.id, { action: "update-page-title" });
  });
})();
