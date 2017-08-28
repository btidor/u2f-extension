'use strict';

// Content scripts run in a separate context. In order to modify window.u2f, we
// need to inject our code into the DOM. https://stackoverflow.com/a/9636008
var s = document.createElement('script');
s.src = chrome.extension.getURL('u2f-injected-script.js');
(document.head||document.documentElement).appendChild(s);
s.onload = function() {
    s.remove();
};
