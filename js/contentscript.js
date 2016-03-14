(function () {
'use strict';

var DEBUG = false;
var _logName = 'arXiv Titler: ';

function log() {
    if (DEBUG) {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(_logName);
        console.log.apply(console, args);
    }
}

function warn() {
    if (DEBUG) {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(_logName);
        console.log.apply(console, args);
    }
}

function getPaperTitle(feed) {
    var paperTitle = null;
    Array.prototype.slice.call(feed.children).forEach(function (child) {
        if (child.nodeName.toLowerCase() === 'entry') {
            var entry = child;
            Array.prototype.slice.call(entry.children).forEach(function (field) {
                if (field.nodeName.toLowerCase() === 'title') {
                    var title = field;
                    paperTitle = title.childNodes[0].wholeText;
                }
            });
        }
    });

    return (paperTitle === null) ? "Unknown title." : paperTitle;
}

function addTitleToHead(paperTitle) {
    var title = document.createElement('title');
    title.appendChild(document.createTextNode(paperTitle));

    var head = null;
    if (document.head) {
        warn('Document already had <head> element.');
        Array.prototype.slice.call(document.head.children).forEach(function (child) {
            if (child.nodeName.toLowerCase() === 'title') {
                document.head.removeChild(child);
            }
        });
        document.head.appendChild(title);
    } else {
        head = document.createElement('head');
        head.appendChild(title);
        var html = document.body.parentElement;
        html.insertBefore(head, document.body);
    }
}

var paperId = null;

try {
    var pathComponents = window.location.pathname.split('/');
    var pdfName = pathComponents[pathComponents.length - 1];
    paperId = /([^v]*)(v[0-9]*)?\.pdf/.exec(pdfName)[1];
} catch(e) {
    warn("Could not get submission ID. Error: ", e);
}

chrome.runtime.onMessage.addListener(function () {
    log('Got message!');
});

var stretchFactor = 1.5,
    initialTimeout = 100;

/* With the settings, stretchFactor = 1.5 and initialTimeout = 100, the plugin
 * will be run ~ 25 times.
 */
function exponentialBackoff(paperTitle, timeout) {
    setTimeout(function () {
        addTitleToHead(paperTitle);
        // If the paper hasn't loaded after 15 minutes, just give up.
        if (timeout < 900000) {
            exponentialBackoff(paperTitle, stretchFactor * timeout);
        }
    }, timeout);
}

if (paperId !== null) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var paperTitle = getPaperTitle(xhr.responseXML.childNodes[0]);
                    exponentialBackoff(paperTitle, 100);
                    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
                        log('Running on-message.');
                        addTitleToHead(paperTitle);
                    });
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

    xhr.open("GET", "http://export.arxiv.org/api/query?id_list=" + paperId);
    xhr.responseType = "document";
    xhr.send();
}})();
