(function () {
  const {
    assetUrl,
    formatCurrency,
    initNavigation,
    initReveal,
    routeUrl,
    setText
  } = window.TVBShared;
  const { menuData, siteData } = window.TVBData;

  function menuCard(item) {
    return `
      <article class="menu-card card" data-item-card data-tags="${item.tags.join(" ").toLowerCase()}">
        <div class="menu-card__image">
          <img src="${assetUrl(item.image)}" alt="${item.name}" loading="lazy">
        </div>
        <div class="menu-card__top">
          <div>
            <span class="tagline-chip">${item.unit}</span>
            <h3>${item.name}</h3>
          </div>
          <div class="menu-card__price">${formatCurrency(item.price)}</div>
        </div>
        <p>${item.description}</p>
        <div class="menu-card__meta">
          ${item.tags.map((tag) => `<span class="menu-tag">${tag}</span>`).join("")}
        </div>
        <div class="button-row">
          <a class="button button-primary" href="${routeUrl(`/order?item=${item.id}`)}">Order now</a>
        </div>
      </article>
    `;
  }

  function applyBrand(site) {
    setText("[data-brand-name]", site.brand.name);
    setText("[data-brand-tagline]", site.brand.tagline);
    setText("[data-phone-text]", site.brand.phoneDisplay);
    document.querySelectorAll("[data-phone-link]").forEach((node) => {
      node.href = `tel:+${site.brand.phoneRaw}`;
    });
  }

  async function initMenuPage() {
    initNavigation();

    const site = siteData;
    const menuGroups = menuData;

    applyBrand(site);
    document.querySelector("[data-menu-hero]").textContent = `${site.brand.name} Menu`;
    document.querySelector("[data-menu-copy]").textContent =
      "Explore cakes, pastries, coffee, mocktails, cookies, puffs, sandwiches, and quick cafe meals in one polished menu.";

    const groupsNode = document.querySelector("[data-menu-groups]");
    groupsNode.innerHTML = menuGroups
      .map(
        (group) => `
          <section class="menu-group" data-category="${group.slug}">
            <div class="menu-group__header">
              <div>
                <span class="eyebrow">${group.title}</span>
                <h2>${group.title}</h2>
              </div>
              <p class="lead-copy">${group.description}</p>
            </div>
            <div class="menu-grid">
              ${group.items.map(menuCard).join("")}
            </div>
          </section>
        `
      )
      .join("");

    const filterRow = document.querySelector("[data-menu-filters]");
    filterRow.innerHTML = `
      <button class="is-active" data-filter="all" type="button">All</button>
      ${menuGroups
        .map((group) => `<button type="button" data-filter="${group.slug}">${group.title}</button>`)
        .join("")}
    `;

    const search = document.querySelector("[data-menu-search]");
    const filters = Array.from(filterRow.querySelectorAll("button"));
    const sections = Array.from(document.querySelectorAll("[data-category]"));

    let activeFilter = "all";

    const update = () => {
      const query = search.value.trim().toLowerCase();

      sections.forEach((section) => {
        const matchesFilter = activeFilter === "all" || section.dataset.category === activeFilter;
        let visibleCards = 0;

        section.querySelectorAll("[data-item-card]").forEach((card) => {
          const haystack = card.textContent.toLowerCase();
          const matchesSearch = !query || haystack.includes(query);
          const visible = matchesFilter && matchesSearch;
          card.classList.toggle("hidden", !visible);

          if (visible) {
            visibleCards += 1;
          }
        });

        section.classList.toggle("hidden", visibleCards === 0);
      });
    };

    filters.forEach((button) => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;
        filters.forEach((item) => item.classList.toggle("is-active", item === button));
        update();
      });
    });

    search.addEventListener("input", update);
    initReveal();
  }

  initMenuPage().catch((error) => {
    console.error(error);
  });
})();
