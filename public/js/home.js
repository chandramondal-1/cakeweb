(function () {
  const {
    assetUrl,
    formatCurrency,
    initCountdown,
    initNavigation,
    initReveal,
    routeUrl,
    setText
  } = window.TVBShared;
  const { menuData, siteData } = window.TVBData;

  function flattenMenu(menuGroups) {
    return menuGroups.flatMap((group) =>
      group.items.map((item) => ({
        ...item,
        category: group.title,
        categorySlug: group.slug
      }))
    );
  }

  function menuCard(item) {
    return `
      <article class="menu-card card" data-reveal>
        <div class="menu-card__image">
          <img src="${assetUrl(item.image)}" alt="${item.name}" loading="lazy">
        </div>
        <div class="menu-card__top">
          <div>
            <span class="tagline-chip">${item.category}</span>
            <h3>${item.name}</h3>
          </div>
          <div class="menu-card__price">${formatCurrency(item.price)}</div>
        </div>
        <p>${item.description}</p>
        <div class="menu-card__meta">
          ${item.tags.slice(0, 3).map((tag) => `<span class="menu-tag">${tag}</span>`).join("")}
        </div>
        <div class="button-row">
          <a class="button button-primary" href="${routeUrl(`/order?item=${item.id}`)}">Order this</a>
          <a class="button button-secondary" href="${routeUrl("/menu")}">Explore more</a>
        </div>
      </article>
    `;
  }

  function applyBrand(site) {
    setText("[data-brand-name]", site.brand.name);
    setText("[data-brand-tagline]", site.brand.tagline);
    setText("[data-location-text]", site.brand.location);
    setText("[data-hours-text]", site.brand.hours);
    setText("[data-phone-text]", site.brand.phoneDisplay);

    document.querySelectorAll("[data-maps-link]").forEach((node) => {
      node.href = site.brand.mapsUrl;
    });

    document.querySelectorAll("[data-phone-link]").forEach((node) => {
      node.href = `tel:+${site.brand.phoneRaw}`;
    });
  }

  function initBuilder() {
    const form = document.querySelector("[data-builder-form]");
    if (!form) {
      return;
    }

    const shapeSelect = form.querySelector("[name='shape']");
    const flavourSelect = form.querySelector("[name='flavour']");
    const creamSelect = form.querySelector("[name='cream']");
    const sizeSelect = form.querySelector("[name='size']");
    const themeSelect = form.querySelector("[name='theme']");
    const messageInput = form.querySelector("[name='message']");
    const toppingInputs = Array.from(form.querySelectorAll("input[name='toppings']"));
    const cakeVisual = document.querySelector("[data-preview-cake]");
    const previewLayers = Array.from(document.querySelectorAll("[data-preview-layer]"));
    const frostingNodes = Array.from(document.querySelectorAll("[data-preview-frosting]"));
    const topper = document.querySelector("[data-preview-topper]");
    const note = document.querySelector("[data-preview-note]");
    const themeNote = document.querySelector("[data-preview-theme-note]");
    const toppingsNote = document.querySelector("[data-preview-toppings-note]");
    const price = document.querySelector("[data-preview-price]");
    const continueLink = document.querySelector("[data-builder-link]");
    const shapeBadge = document.querySelector("[data-preview-shape-badge]");
    const themeBadge = document.querySelector("[data-preview-theme-badge]");
    const toppingBadge = document.querySelector("[data-preview-topping-badge]");

    const basePrices = {
      "0.5 kg": 699,
      "1 kg": 1199,
      "1.5 kg": 1599,
      "2 kg": 1999
    };

    const titleCase = (value) =>
      String(value || "")
        .split(" ")
        .filter(Boolean)
        .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1))
        .join(" ");

    const update = () => {
      const shape = shapeSelect.value;
      const flavour = flavourSelect.value;
      const cream = creamSelect.value;
      const size = sizeSelect.value;
      const theme = themeSelect.value;
      const message = messageInput.value.trim();
      const toppings = toppingInputs
        .filter((input) => input.checked)
        .map((input) => input.value);

      cakeVisual.dataset.shape = shape;

      previewLayers.forEach((layer) => {
        layer.dataset.flavour = flavour;
      });

      frostingNodes.forEach((node) => {
        node.dataset.cream = cream;
      });

      topper.textContent = message || titleCase(theme) || "The Vanilla Bean";
      note.textContent =
        toppings.length > 0
          ? `${titleCase(shape)} | ${size} | ${flavour} | ${cream}`
          : `${titleCase(shape)} | ${size} | ${flavour} | ${cream}`;
      themeNote.textContent = `${titleCase(theme)} | ${message || "no message yet"}`;
      toppingsNote.textContent = toppings.length ? toppings.join(", ") : "No toppings selected";
      shapeBadge.textContent = titleCase(shape);
      themeBadge.textContent = titleCase(theme);
      toppingBadge.textContent = `${toppings.length} topping${toppings.length === 1 ? "" : "s"}`;

      const estimated = (basePrices[size] || 699) + toppings.length * 40;
      price.textContent = `${formatCurrency(estimated)} estimated`;

      const params = new URLSearchParams({
        custom: "1",
        shape,
        size,
        flavour,
        cream,
        theme,
        message
      });

      continueLink.href = routeUrl(`/order?${params.toString()}`);
    };

    form.addEventListener("input", update);
    update();
  }

  async function initHome() {
    initNavigation();

    const site = siteData;
    const menuGroups = menuData;

    applyBrand(site);

    document.querySelector("[data-hero-title]").textContent = site.brand.heroTitle;
    document.querySelector("[data-hero-subtitle]").textContent = site.brand.heroSubtitle;
    document.querySelector("[data-delivery-note]").textContent = site.brand.deliveryNote;

    document.querySelector("[data-stats]").innerHTML = site.stats
      .map(
        (item) => `
          <article class="stat-card" data-reveal>
            <strong>${item.value}</strong>
            <span>${item.label}</span>
          </article>
        `
      )
      .join("");

    document.querySelector("[data-categories]").innerHTML = site.categoryHighlights
      .map(
        (item) => `
          <article class="card" data-accent="${item.accent}" data-reveal>
            <span class="tagline-chip">${item.priceNote}</span>
            <h3>${item.title}</h3>
            <p>${item.description}</p>
          </article>
        `
      )
      .join("");

    const menuItems = flattenMenu(menuGroups);
    const sellers = site.bestSellerIds
      .map((id) => menuItems.find((item) => item.id === id))
      .filter(Boolean);

    document.querySelector("[data-best-sellers]").innerHTML = sellers.map(menuCard).join("");

    document.querySelector("[data-process]").innerHTML = site.process
      .map(
        (item) => `
          <article class="process-card" data-reveal>
            <span class="process-card__step">${item.step}</span>
            <h3>${item.title}</h3>
            <p>${item.copy}</p>
          </article>
        `
      )
      .join("");

  document.querySelector("[data-reviews]").innerHTML = site.reviews
    .map(
      (item) => `
        <article class="review-card" data-reveal>
          <div class="review-card__icon">${item.initials || "VB"}</div>
          <div>
            <h3>${item.title}</h3>
            <p>${item.body}</p>
            <div class="review-meta">
              <span class="pill">${item.occasion || "Celebration"}</span>
              <span class="pill">${item.name || "Guest"}</span>
            </div>
          </div>
        </article>
      `
    )
    .join("");

    document.querySelector("[data-gallery]").innerHTML = site.gallery
      .slice(0, 6)
      .map(
        (item) => `
          <article class="gallery-card" data-reveal>
            <img src="${assetUrl(item.image)}" alt="${item.label}" loading="lazy">
            <div class="gallery-card__copy">
              <span class="tagline-chip">${item.label}</span>
              <h3>${item.caption}</h3>
            </div>
          </article>
        `
      )
      .join("");

  document.querySelector("[data-blog]").innerHTML = site.blog
    .map(
      (item) => `
        <article class="blog-card card" data-reveal>
          <strong class="tagline-chip">${item.tag}</strong>
          <h3>${item.title}</h3>
          <p>${item.excerpt}</p>
          <div class="review-meta">
            <span class="pill">${item.readTime || "Read"}</span>
          </div>
          <div class="button-row">
            <a class="button button-secondary" href="${routeUrl(`/blog?slug=${item.slug}`)}">Read article</a>
          </div>
        </article>
      `
    )
    .join("");

    document.querySelector("[data-faq]").innerHTML = site.faqs
      .map(
        (item) => `
          <details class="faq-item" data-reveal>
            <summary>${item.question}<span>+</span></summary>
            <p>${item.answer}</p>
          </details>
        `
      )
      .join("");

    document.querySelector("[data-offer-headline]").textContent = site.offers.headline;
    document.querySelector("[data-offer-subline]").textContent = site.offers.subline;
    initCountdown(site.offers.countdownTarget, document.querySelector("[data-offer-countdown]"));
    initBuilder();
    initReveal();
  }

  initHome().catch((error) => {
    console.error(error);
  });
})();
