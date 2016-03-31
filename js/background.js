(function() {
'use strict';

chrome.runtime.onInstalled.addListener(function () {
    chrome.declarativeContent.onPageChanged.removeRules(undefined, function () {
        chrome.declarativeContent.onPageChanged.addRules([{
            conditions: [
                new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: {
                        hostEquals: 'arxiv.org',
                        pathPrefix: '/pdf'
                    }
                })
            ],
            actions: [ new chrome.declarativeContent.ShowPageAction() ]
        }]);
    });
});

chrome.pageAction.onClicked.addListener(function (tab) {
    chrome.tabs.sendMessage(tab.id, "update-page-title.");
});
})();
