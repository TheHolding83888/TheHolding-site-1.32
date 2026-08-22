/* The Holding · Company public adapters bootstrap · v0.1
 * Keeps the legacy Company #010 adapter byte-for-byte in core and then loads
 * the global Rewards Received lifecycle presentation layer.
 */
(() => {
  'use strict';
  const load = src => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  load('/companies/company-010-public-adapter-core.js')
    .then(() => load('/companies/rewards-received-adapter.js'))
    .catch(err => console.error('[Company public adapters bootstrap]', err));
})();
