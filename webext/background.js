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

  // Handle action button clicks
  chrome.action.onClicked.addListener(function (tab) {
    chrome.tabs.sendMessage(tab.id, { action: "update-page-title" });
  });
})();
