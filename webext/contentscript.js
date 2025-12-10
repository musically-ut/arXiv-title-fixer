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
        runForCurrentPage(); // Fetch the title again if not available
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

  function requestPaperTitle(paperId) {
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage(
        { action: "fetch-paper-title", paperId: paperId },
        function (response) {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          if (!response) {
            reject(new Error("No response from background worker."));
            return;
          }
          if (response.error) {
            reject(new Error(response.error));
            return;
          }
          resolve(response.xmlText);
        }
      );
    });
  }

  function requestPage(url) {
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage(
        { action: "fetch-url", url: url },
        function (response) {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          if (!response) {
            reject(new Error("No response from background worker."));
            return;
          }
          if (response.error) {
            reject(new Error(response.error));
            return;
          }
          resolve(response.body);
        }
      );
    });
  }

  function extractTitleFromXml(xmlText) {
    try {
      var parsed = new DOMParser().parseFromString(xmlText, "application/xml");
      var title = parsed.querySelector("entry > title");
      return title ? title.textContent.trim() : TITLE_PLACEHOLDER;
    } catch (err) {
      warn("Failed to parse XML response", err);
      return TITLE_PLACEHOLDER;
    }
  }

  function parseHtml(htmlString) {
    return new DOMParser().parseFromString(htmlString, "text/html");
  }

  function getMetaCitationTitle(doc) {
    var meta = doc.querySelector('meta[name="citation_title"]');
    return meta ? meta.content : null;
  }

  // arXiv handlers
  function setTitleForArxivPdf() {
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
      requestPaperTitle(paperId)
        .then(function (xmlText) {
          var title = extractTitleFromXml(xmlText);
          paperTitle = title || TITLE_PLACEHOLDER;
          exponentialBackoff(paperTitle, initialTimeout);
        })
        .catch(function (e) {
          warn("Unable to fetch paper data from arXiv API.", e);
        });
    }
  }

  function setTitleForArxivAbs() {
    var title =
      document.querySelector(".title") || document.querySelector("h1.title");
    var paperTitleText = title ? title.innerText : TITLE_PLACEHOLDER;
    addTitleToHead(paperTitleText);
  }

  // OpenReview handlers
  function extractOpenReviewTitle(doc) {
    var metaTitle = getMetaCitationTitle(doc);
    if (metaTitle) {
      return metaTitle.trim();
    }
    var header = doc.querySelector("h2.note_content_title");
    if (header) {
      return header.textContent.trim();
    }
    return null;
  }

  function setTitleForOpenReviewAbs() {
    var title = extractOpenReviewTitle(document) || TITLE_PLACEHOLDER;
    paperTitle = title;
    addTitleToHead(title);
  }

  function setTitleForOpenReviewPdf() {
    var searchParams = new URLSearchParams(window.location.search);
    var forumId = searchParams.get("id");
    if (!forumId) {
      warn("No OpenReview id found in PDF URL.");
      return;
    }
    var forumUrl =
      "https://openreview.net/forum?id=" + encodeURIComponent(forumId);
    requestPage(forumUrl)
      .then(function (htmlText) {
        var doc = parseHtml(htmlText);
        var title = extractOpenReviewTitle(doc) || TITLE_PLACEHOLDER;
        paperTitle = title;
        exponentialBackoff(title, initialTimeout);
      })
      .catch(function (err) {
        warn("Unable to fetch OpenReview forum page.", err);
      });
  }

  // ACL Anthology handlers
  function extractAclTitle(doc) {
    var metaTitle = getMetaCitationTitle(doc);
    if (metaTitle) {
      return metaTitle.trim();
    }
    var pageTitle = doc.querySelector("#title");
    if (pageTitle) {
      return pageTitle.textContent.trim();
    }
    return null;
  }

  function setTitleForAclAbs() {
    var title = extractAclTitle(document) || TITLE_PLACEHOLDER;
    paperTitle = title;
    addTitleToHead(title);
  }

  function setTitleForAclPdf() {
    var pdfUrl = window.location.href;
    var absUrl = pdfUrl.replace(/\.pdf(\?.*)?$/, "/");
    requestPage(absUrl)
      .then(function (htmlText) {
        var doc = parseHtml(htmlText);
        var title = extractAclTitle(doc) || TITLE_PLACEHOLDER;
        paperTitle = title;
        exponentialBackoff(title, initialTimeout);
      })
      .catch(function (err) {
        warn("Unable to fetch ACL Anthology page.", err);
      });
  }

  function runForCurrentPage() {
    var host = window.location.hostname;
    var pathComponents = window.location.pathname.split("/");
    log({ host: host, pathComponents: pathComponents });

    if (host.indexOf("arxiv.org") !== -1) {
      if (
        (pathComponents.length > 0 &&
          pathComponents[pathComponents.length - 1].endsWith(".pdf")) ||
        (pathComponents.length > 1 && pathComponents[1] === "pdf")
      ) {
        setTitleForArxivPdf();
      } else {
        setTitleForArxivAbs();
      }
      return;
    }

    if (host.indexOf("openreview.net") !== -1) {
      if (window.location.pathname.indexOf("/pdf") === 0) {
        setTitleForOpenReviewPdf();
      } else {
        setTitleForOpenReviewAbs();
      }
      return;
    }

    if (host.indexOf("aclanthology.org") !== -1) {
      if (window.location.pathname.endsWith(".pdf")) {
        setTitleForAclPdf();
      } else {
        setTitleForAclAbs();
      }
    }
  }

  runForCurrentPage();
})();
