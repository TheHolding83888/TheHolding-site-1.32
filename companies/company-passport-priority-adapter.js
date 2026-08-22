/* The Holding · Company Passport priority adapter · v0.1.0
 * Presentation only. Promotes the existing APR field to the first metadata row
 * in every standard Company Passport. No rate calculation, source, methodology,
 * Stable Passport, Rewards, Reporting or execution-authority changes.
 */
(() => {
  'use strict';
  if (window.__TH_COMPANY_PASSPORT_PRIORITY_ADAPTER__) return;

  let queued = false;

  function promoteApr() {
    let moved = 0;
    document.querySelectorAll('.ib-item[data-nm] .ipx-apr-field').forEach(apr => {
      const grid = apr.parentElement;
      if (!grid || !grid.classList.contains('ipx-grid')) return;
      if (grid.firstElementChild !== apr) {
        grid.insertBefore(apr, grid.firstElementChild);
        moved += 1;
      }
      apr.dataset.thPassportPriority = 'primary-rate';
    });
    return moved;
  }

  function queuePromote() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      promoteApr();
    });
  }

  function start() {
    promoteApr();
    const observer = new MutationObserver(queuePromote);
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true
    });
    window.__TH_COMPANY_PASSPORT_PRIORITY_ADAPTER__ = {
      version: '0.1.0-apr-before-registry',
      promoteApr
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
