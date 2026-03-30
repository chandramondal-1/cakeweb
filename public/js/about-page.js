(function () {
  const { initNavigation, initReveal, setText } = window.TVBShared;
  const { siteData } = window.TVBData;

  async function initAboutPage() {
    initNavigation();

    const site = siteData;
    setText("[data-brand-name]", site.brand.name);
    setText("[data-brand-tagline]", site.brand.tagline);
    setText("[data-location-text]", site.brand.location);
    setText("[data-hours-text]", site.brand.hours);
    document.querySelectorAll("[data-maps-link]").forEach((node) => {
      node.href = site.brand.mapsUrl;
    });

    initReveal();
  }

  initAboutPage().catch((error) => {
    console.error(error);
  });
})();
