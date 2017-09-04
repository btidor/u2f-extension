(function() {
  'use strict';

  const OLD_EXTENSION_ID = 'kmendfapggjehodndflmmgagdbamhnfd';
  const NEW_EXTENSION_ID = 'jnhbfcokdhpfagldfpiaficnpnadkoma';

  const oldRuntimePort = chrome.runtime.connect(OLD_EXTENSION_ID,
    {'includeTlsChannelId': true});

  const getIframePort = function(callback) {
    // Create the iframe
    var iframeOrigin = 'chrome-extension://' + NEW_EXTENSION_ID;
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
        console.error('[u2f-touchid] First event on iframe port was not "ready"');
      }
    };
    channel.port1.addEventListener('message', ready);
    channel.port1.start();

    iframe.addEventListener('load', function() {
      // Deliver the port to the iframe and initialize
      iframe.contentWindow.postMessage('init', iframeOrigin, [channel.port2]);
    });
  };

  const inject = function(newIframePort) {
    // Multiplex requests and responses across the ports.
    var reqId = -1;
    var outstanding = {};
    const sendMessageWithCallback = function(message_, callback) {
      console.warn(message_);
      var message = Object.assign({}, message_);
      outstanding[reqId] = {
        originalId: message['requestId'],
        callback: callback,
      }
      message['requestId'] = reqId;
      reqId = reqId - 1;
      oldRuntimePort.postMessage(message);
      newIframePort.postMessage(message);
    }

    const handleResponse = function(data) {
      const reqId = data['requestId'];
      if (!reqId || !outstanding[reqId]) {
        // already handled
        return;
      }
      data['requestId'] = outstanding[reqId].originalId;
      const callback = outstanding[reqId].callback;
      delete outstanding[reqId];
      callback(data);
    };

    oldRuntimePort.onMessage.addListener(handleResponse);
    newIframePort.addEventListener('message', function(message) {
      handleResponse(message.data);
    });

    // Intercept calls to sendMessage(OLD_EXTENSION_ID, ...) and proxy them to
    // our extension.
    const sendMessage_ = chrome.runtime.sendMessage;
    chrome.runtime.sendMessage = function(...args) {
      if (args.length >= 2 && args[0] == OLD_EXTENSION_ID) {
        const message = args[1];
        const callback = args.slice(-1)[0];
        if (!(callback instanceof Function)) {
          callback = function(message) {};
        }

        sendMessageWithCallback(message, callback);
        return;
      } else {
        return sendMessage_(...args);
      }
    };

    // Intercept calls to connect(OLD_EXTENSION_ID, ..) and proxy them to our
    // extension.
    const connect_ = chrome.runtime.connect;
    chrome.runtime.connect = function(...args) {
      if (args.length > 1 && args[0] == OLD_EXTENSION_ID) {
        var listeners = [];
        // TODO: use `prototype` instead?
        var fakePort = {
          name: OLD_EXTENSION_ID,
          disconnect: function() {
            fakePort.close();
          },
          onDisconnect: {
            // not supported
            addListener: function(listener) {},
          },
          onMessage: {
            addListener: function(listener) {
              listeners.push(listener);
            },
          },
          postMessage: function(message) {
            sendMessageWithCallback(message, function(response) {
              listeners.forEach(function(listener) {
                listener(response);
              });
            });
          },
        }
        return fakePort;
      } else {
        return connect_(...args);
      }
    };
  }

  if (document.body) {
    getIframePort(inject);
  } else {
    window.addEventListener('load', function() {
      getIframePort(inject);
    });
  }
}());
