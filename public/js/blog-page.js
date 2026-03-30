(function () {
  const {
    assetUrl,
    escapeHtml,
    formatDate,
    initNavigation,
    initReveal,
    queryParam,
    routeUrl,
    setText
  } = window.TVBShared;
  const { siteData } = window.TVBData;

  function articleLink(slug) {
    return routeUrl(`/blog?slug=${encodeURIComponent(slug)}`);
  }

  function renderList(posts) {
    const node = document.querySelector("[data-blog-list]");
    node.innerHTML = posts
      .map(
        (post) => `
          <article class="blog-card card" data-reveal>
            <img class="blog-thumb" src="${assetUrl(post.image)}" alt="${escapeHtml(post.title)}">
            <strong class="tagline-chip">${escapeHtml(post.tag)}</strong>
            <h3>${escapeHtml(post.title)}</h3>
            <p>${escapeHtml(post.excerpt)}</p>
            <div class="review-meta">
              <span class="pill">${escapeHtml(post.readTime)}</span>
              <span class="pill">${formatDate(post.publishedAt)}</span>
            </div>
            <div class="button-row">
              <a class="button button-secondary" href="${articleLink(post.slug)}">Read article</a>
            </div>
          </article>
        `
      )
      .join("");
  }

  function renderDetail(post, related) {
    document.querySelector("[data-blog-list-view]").classList.add("hidden");
    document.querySelector("[data-blog-detail-view]").classList.remove("hidden");

    document.querySelector("[data-blog-detail]").innerHTML = `
      <img class="post-hero" src="${assetUrl(post.image)}" alt="${escapeHtml(post.title)}">
      <span class="eyebrow">${escapeHtml(post.tag)}</span>
      <h1>${escapeHtml(post.title)}</h1>
      <div class="review-meta">
        <span class="pill">${escapeHtml(post.author)}</span>
        <span class="pill">${escapeHtml(post.readTime)}</span>
        <span class="pill">${formatDate(post.publishedAt)}</span>
      </div>
      <p class="lead-copy">${escapeHtml(post.excerpt)}</p>
      ${post.sections
        .map(
          (section) => `
            <section class="post-section">
              <h3>${escapeHtml(section.heading)}</h3>
              ${section.body.map((entry) => `<p>${escapeHtml(entry)}</p>`).join("")}
            </section>
          `
        )
        .join("")}
      <div class="post-tips">
        <h3>Quick takeaways</h3>
        <ul class="admin-list">
          ${post.tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("")}
        </ul>
      </div>
    `;

    document.querySelector("[data-blog-related]").innerHTML = related
      .map(
        (entry) => `
          <article class="post-mini">
            <strong>${escapeHtml(entry.title)}</strong>
            <p>${escapeHtml(entry.excerpt)}</p>
            <a href="${articleLink(entry.slug)}">Read next</a>
          </article>
        `
      )
      .join("");
  }

  async function initBlogPage() {
    initNavigation();
    setText("[data-brand-name]", siteData.brand.name);
    setText("[data-brand-tagline]", siteData.brand.tagline);

    const posts = siteData.blog || [];
    const slug = queryParam("slug");
    if (slug) {
      const post = posts.find((entry) => entry.slug === slug);
      if (post) {
        renderDetail(
          post,
          posts.filter((entry) => entry.slug !== slug).slice(0, 2)
        );
        initReveal();
        return;
      }
    }

    renderList(posts);
    initReveal();
  }

  initBlogPage().catch((error) => {
    console.error(error);
  });
})();
