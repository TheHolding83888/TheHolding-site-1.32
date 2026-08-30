/* Realty v2.1 premium presentation layer.
   Stable v1.6 remains the only market/data controller. */
(() => {
  const brandMark = document.querySelector('.v20-brandmark');
  if (brandMark) brandMark.remove();

  const favicon = (domain) => `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(`https://${domain}`)}`;
  const physical = [
    ['realt.co', 'RealT'],
    ['www.lofty.ai', 'Lofty'],
    ['propy.com', 'Propy'],
    ['blocksquare.io', 'Blocksquare'],
    ['www.reental.co', 'Reental']
  ];
  const digital = [
    ['decentraland.org', 'Decentraland'],
    ['www.sandbox.game', 'The Sandbox'],
    ['otherside.xyz', 'Otherside'],
    ['somniumspace.com', 'Somnium'],
    ['www.voxels.com', 'Voxels']
  ];

  const hydrateLogos = (selector, brands) => {
    const rail = document.querySelector(selector);
    if (!rail) return;
    const items = [...rail.querySelectorAll(':scope > span')];
    items.forEach((item, index) => {
      const brand = brands[index];
      if (!brand) return;
      const [domain, label] = brand;
      item.innerHTML = `<i aria-hidden="true"><img src="${favicon(domain)}" alt="" width="64" height="64" loading="eager" referrerpolicy="no-referrer"></i><span>${label}</span>`;
      item.title = label;
    });
  };

  const run = () => {
    hydrateLogos('.v16-board.physical .v16-platforms', physical);
    hydrateLogos('.v16-board.digital .v16-platforms', digital);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})();
