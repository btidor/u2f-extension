'use strict';

// Rather than take the risk of running a lot of code in a foreign context,
// we're going to selectively target the Google-provided U2F polyfill, which
// most sites use. By overriding the polyfill's EXTENSION_ID variable, we can
// re-use the polyfill's logic (the iFrame trampoline in particular) to
// communicate with our extension.

// Make sure window.u2f is defined
var u2f = u2f || {};

// Define EXTENSION_ID as a read-only property. Further attempts to assign a
// value to this field will be a no-op, and will not raise an error. Note that
// the polyfill uses strict mode, so assigning to a writable: false property
// would raise an error.
Object.defineProperty(u2f, 'EXTENSION_ID', {
  get: function() { return 'jnhbfcokdhpfagldfpiaficnpnadkoma'; },
  set: function(v) { return v; },
});

// Reset the polfyill's internal state, causing it to re-run port selection with
// our new EXTENSION_ID.
if (typeof u2f.port_ !== 'undefined') u2f.port_ = null;
