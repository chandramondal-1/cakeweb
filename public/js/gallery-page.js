(function () {
  const { assetUrl, initNavigation, initReveal, setText } = window.TVBShared;
  const { siteData } = window.TVBData;

  async function initGalleryPage() {
    initNavigation();

    const site = siteData;
    setText("[data-brand-name]", site.brand.name);
    setText("[data-brand-tagline]", site.brand.tagline);

    const filtersNode = document.querySelector("[data-gallery-filters]");
    const galleryNode = document.querySelector("[data-gallery-grid]");
    const types = ["all", ...new Set(site.gallery.map((item) => item.type))];
    let activeFilter = "all";

    filtersNode.innerHTML = types
      .map(
        (type, index) => `
          <button type="button" data-filter="${type}" class="${index === 0 ? "is-active" : ""}">
            ${type === "all" ? "All moments" : type}
          </button>
        `
      )
      .join("");

    const render = () => {
      galleryNode.innerHTML = site.gallery
        .filter((item) => activeFilter === "all" || item.type === activeFilter)
        .map(
          (item) => `
            <article class="gallery-card" data-reveal>
              <img src="${assetUrl(item.image)}" alt="${item.label}" loading="lazy">
              <div class="gallery-card__copy">
                <span class="tagline-chip">${item.label}</span>
                <h3>${item.caption}</h3>
                <p>${item.type}</p>
              </div>
            </article>
          `
        )
        .join("");

      initReveal();
    };

    filtersNode.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;
        filtersNode
          .querySelectorAll("button")
          .forEach((node) => node.classList.toggle("is-active", node === button));
        render();
      });
    });

    render();
  }

  initGalleryPage().catch((error) => {
    console.error(error);
  });
})();
