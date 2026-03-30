(function () {
  const { escapeHtml, initNavigation, initReveal, routeUrl, setText } = window.TVBShared;
  const { siteData } = window.TVBData;

  function stars(count) {
    return "★★★★★".slice(0, Number(count || 0));
  }

  async function initReviewsPage() {
    initNavigation();
    setText("[data-brand-name]", siteData.brand.name);
    setText("[data-brand-tagline]", siteData.brand.tagline);

    document.querySelector("[data-review-stats]").innerHTML = (siteData.reviewStats || [])
      .map(
        (item) => `
          <article class="metric-card">
            <strong>${escapeHtml(item.value)}</strong>
            <span>${escapeHtml(item.label)}</span>
          </article>
        `
      )
      .join("");

    const reviews = siteData.reviews || [];
    const filters = ["All", ...new Set(reviews.map((review) => review.occasion))];
    const filterNode = document.querySelector("[data-review-filters]");
    const gridNode = document.querySelector("[data-review-grid]");
    let activeFilter = "All";

    const render = () => {
      gridNode.innerHTML = reviews
        .filter((review) => activeFilter === "All" || review.occasion === activeFilter)
        .map(
          (review) => `
            <article class="review-card review-card--customer" data-reveal>
              <div class="review-avatar">${escapeHtml(review.initials)}</div>
              <div class="review-rating">${stars(review.rating)} <span>${escapeHtml(review.date)}</span></div>
              <h3>${escapeHtml(review.title)}</h3>
              <p>${escapeHtml(review.body)}</p>
              <div class="review-meta">
                <span class="tagline-chip">${escapeHtml(review.occasion)}</span>
                <span class="pill">${escapeHtml(review.category)}</span>
              </div>
              <strong>${escapeHtml(review.name)}</strong>
            </article>
          `
        )
        .join("");
      initReveal();
    };

    filterNode.innerHTML = filters
      .map(
        (item, index) => `
          <button type="button" data-filter="${escapeHtml(item)}" class="${index === 0 ? "is-active" : ""}">
            ${escapeHtml(item)}
          </button>
        `
      )
      .join("");

    filterNode.querySelectorAll("[data-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;
        filterNode.querySelectorAll("[data-filter]").forEach((node) => {
          node.classList.toggle("is-active", node === button);
        });
        render();
      });
    });

    render();
  }

  initReviewsPage().catch((error) => {
    console.error(error);
  });
})();
