(function() {
  'use strict';

  const NATIVE_EXTENSION_ID = 'kmendfapggjehodndflmmgagdbamhnfd';
  const CUSTOM_EXTENSION_ID = 'jnhbfcokdhpfagldfpiaficnpnadkoma';

  const getIframePort = function(callback) {
    // Create the iframe
    var iframeOrigin = 'chrome-extension://' + CUSTOM_EXTENSION_ID;
    var iframe = document.createElement('iframe');
    iframe.src = iframeOrigin + '/u2f-comms.html';
    iframe.setAttribute('style', 'display:none');
    document.body.appendChild(iframe);

    var channel = new MessageChannel();
    var ready = function(message) {
      if (message.data == 'ready') {
        channel.port1.removeEventListener('message', ready);
        callback(channel.port1);
      } else {
        console.error('First event on iframe port was not "ready"');
      }
    };
    channel.port1.addEventListener('message', ready);
    channel.port1.start();

    iframe.addEventListener('load', function() {
      // Deliver the port to the iframe and initialize
      iframe.contentWindow.postMessage('init', iframeOrigin, [channel.port2]);
    });
  };

  const inject = function(port) {
    const sendMessage_ = chrome.runtime.sendMessage;
    chrome.runtime.sendMessage = function(...args) {
      console.warn(["sendMessage(", ...args]);

      if (args.length > 0 && args[0] == NATIVE_EXTENSION_ID) {
        console.warn("*");
        // HACK: the 2-argument case is more complicated than this

        // HACK: don't send the message, just run the callback
        args[2]({});
        return Promise.resolve();
      } else {
        return sendMessage_(...args);
      }
    };

    const connect_ = chrome.runtime.connect;
    chrome.runtime.connect = function(...args) {
      console.warn(["connect(", ...args]);

      if (args.length > 1 && args[0] == NATIVE_EXTENSION_ID) {
        console.warn("*");
        var channel = new MessageChannel();
        port.addEventListener('message', function(msg) {
          console.warn("POM");
          console.warn(msg);
          channel.port1.postMessage(msg.data);
        });
        port.start();

        channel.port1.addEventListener('message', function(msg) {
          console.warn("1OM");
          console.warn(msg);
          port.postMessage(msg.data);
        });
        channel.port1.start();

        channel.port2.onMessage = {};
        channel.port2.onMessage.addListener = function(l) {
          channel.port2.addEventListener('message', function(msg) {
            l(msg.data);
          });
          channel.port2.start();
        }
        return channel.port2;
      } else {
        return connect_(...args);
      }
    };
  }

  getIframePort(inject);
}());
