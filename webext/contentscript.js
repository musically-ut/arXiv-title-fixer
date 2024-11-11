/* global chrome */
(function () {
  "use strict";

  const DEBUG = false;
  const _logName = "arXiv Titler: ";
  const TITLE_PLACEHOLDER = "Unknown title.";
  let paperTitle = null;

  function log() {
    if (DEBUG) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift(_logName);
      /* eslint-disable no-console */
      console.log.apply(console, args);
      /* eslint-enable no-console */
    }
  }

  function warn() {
    if (DEBUG) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift(_logName);
      /* eslint-disable no-console */
      console.log.apply(console, args);
      /* eslint-enable no-console */
    }
  }

  function getPaperTitleFromResponse(feed) {
    var title = feed.querySelector("entry > title");
    log("Title:", title);
    return title ? title.textContent.trim() : TITLE_PLACEHOLDER;
  }

  function addTitleToDocument(titleText) {
    document.title = titleText;
  }

  function addTitleToHead(paperTitle) {
    var title = document.createElement("title");
    title.appendChild(document.createTextNode(paperTitle));

    var head = null;
    if (document.head) {
      warn("Document already had <head> element.");
      Array.prototype.slice
        .call(document.head.children)
        .forEach(function (child) {
          if (child.nodeName.toLowerCase() === "title") {
            document.head.removeChild(child);
          }
        });
      document.head.appendChild(title);
    } else {
      head = document.createElement("head");
      head.appendChild(title);
      var html = document.body.parentElement;
      html.insertBefore(head, document.body);
    }

    addTitleToDocument(paperTitle);
  }

  // Message listener
  chrome.runtime.onMessage.addListener(function (
    request,
    sender,
    _sendResponse
  ) {
    if (request.action === "update-page-title") {
      log("Running on-message.");
      if (paperTitle) {
        addTitleToHead(paperTitle);
      } else {
        setTitleForPdf(); // Fetch the title again if not available
      }
    }
  });

  /* With the settings, stretchFactor = 1.5 and initialTimeout = 100, the plugin
   * will be run ~ 25 times.
   */
  var stretchFactor = 1.5,
    initialTimeout = 100;

  function exponentialBackoff(paperTitle, timeout) {
    setTimeout(function () {
      addTitleToHead(paperTitle);
      // If the paper hasn't loaded after 15 minutes, just give up.
      if (timeout < 900000) {
        log("Running for timeout: ", timeout);
        exponentialBackoff(paperTitle, stretchFactor * timeout);
      }
    }, timeout);
  }

  function setTitleForPdf() {
    var paperId = null;

    try {
      var pathComponents = window.location.pathname.split("/");
      var pdfName = pathComponents[pathComponents.length - 1];
      paperId = /([^v]*)(v[0-9]*)?(\.pdf)?/.exec(pdfName)[1];
      log("Paper ID:", paperId);
    } catch (e) {
      warn("Could not get submission ID. Error: ", e);
    }

    if (paperId !== null) {
      var xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            try {
              paperTitle = getPaperTitleFromResponse(xhr.responseXML);
              exponentialBackoff(paperTitle, initialTimeout);
            } catch (e) {
              warn("Unable to determine title of paper. Error: ", e);
            }
          } else {
            warn("Cannot handle response with status ", xhr.status);
          }
        }
      };

      xhr.onerror = function () {
        warn("Unable to fetch paper data from arXiv API.");
      };

      xhr.open("GET", "https://export.arxiv.org/api/query?id_list=" + paperId);
      xhr.responseType = "document";
      xhr.send();
    }
  }

  function setTitleForAbs() {
    var paperTitle;
    var titleElements = document.getElementsByClassName("title");
    if (titleElements.length > 0) {
      paperTitle = titleElements[0].innerText;
    } else {
      warn("Unable to find a title element in the page.");
      paperTitle = TITLE_PLACEHOLDER;
    }
    addTitleToHead(paperTitle);
  }

  var pathComponents = window.location.pathname.split("/");
  log({ pathComponents });
  if (
    (pathComponents.length > 0 &&
      pathComponents[pathComponents.length - 1].endsWith(".pdf")) ||
    (pathComponents.length > 1 && pathComponents[1] === "pdf")
  ) {
    setTitleForPdf();
  } else {
    setTitleForAbs();
  }
})();
