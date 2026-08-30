/* Realty v2.2 premium presentation layer.
   Stable v1.6 remains the only market/data controller. */
(() => {
  /* Load the additive v2.2 presentation contract without touching market semantics. */
  document.body.classList.add('landing-v22');
  if (!document.querySelector('link[data-realty-v22]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = '/realty/assets/realty-shell-v22.css';
    css.dataset.realtyV22 = 'true';
    document.head.appendChild(css);
  }

  [
    '/realty/assets/demo/v22/hero-demo-exact.avif',
    '/realty/assets/demo/v22/physical-demo-exact.avif',
    '/realty/assets/demo/v22/digital-demo-exact.avif'
  ].forEach((href) => {
    if (document.querySelector(`link[rel="preload"][href="${href}"]`)) return;
    const preload = document.createElement('link');
    preload.rel = 'preload';
    preload.as = 'image';
    preload.type = 'image/avif';
    preload.href = href;
    document.head.appendChild(preload);
  });

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
