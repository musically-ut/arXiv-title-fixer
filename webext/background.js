// webext/background.js
(function () {
  "use strict";

  const API_BASE = "https://export.arxiv.org/api/query?id_list=";

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

  async function fetchPaperTitle(paperId) {
    const response = await fetch(API_BASE + encodeURIComponent(paperId));
    if (!response.ok) {
      throw new Error("Request failed: " + response.status);
    }
    const xmlText = await response.text();
    return xmlText;
  }

  // Handle CORS-sensitive requests in the background so the content script can stay simple.
  chrome.runtime.onMessage.addListener(function (
    message,
    _sender,
    sendResponse
  ) {
    if (message.action === "fetch-paper-title" && message.paperId) {
      fetchPaperTitle(message.paperId)
        .then(function (xmlText) {
          sendResponse({ xmlText: xmlText });
        })
        .catch(function (err) {
          sendResponse({
            error: err && err.message ? err.message : String(err),
          });
        });
      return true; // Keep the message channel open for async response.
    }
    return undefined;
  });
})();
