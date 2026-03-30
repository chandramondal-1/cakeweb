(function () {
  const {
    escapeHtml,
    initNavigation,
    initReveal,
    queryParam,
    routeUrl,
    setText,
    showToast
  } = window.TVBShared;
  const { siteData } = window.TVBData;
  const { getRememberedCustomerPhone, joinMembership } = window.TVBStore;

  async function initOffersPage() {
    initNavigation();
    setText("[data-brand-name]", siteData.brand.name);
    setText("[data-brand-tagline]", siteData.brand.tagline);
    document.querySelector("[data-offers-headline]").textContent = siteData.offersPage.headline;
    document.querySelector("[data-membership-copy]").textContent = siteData.membership.tagline;

    document.querySelector("[data-offer-cards]").innerHTML = (siteData.offersPage.cards || [])
      .map(
        (card) => `
          <article class="card" data-accent="gold">
            <strong class="tagline-chip">${escapeHtml(card.badge)}</strong>
            <h3>${escapeHtml(card.title)}</h3>
            <p>${escapeHtml(card.copy)}</p>
          </article>
        `
      )
      .join("");

    document.querySelector("[data-coupon-grid]").innerHTML = (siteData.checkout?.coupons || [])
      .map(
        (coupon) => `
          <article class="coupon-card">
            <strong>${escapeHtml(coupon.code)}</strong>
            <p>${escapeHtml(coupon.description)}</p>
            <span>${escapeHtml(coupon.audience)}</span>
          </article>
        `
      )
      .join("");

    document.querySelector("[data-tier-grid]").innerHTML = (siteData.membership?.tiers || [])
      .map(
        (tier) => `
          <article class="card tier-card">
            <strong class="tagline-chip">${escapeHtml(tier.name)}</strong>
            <h3>${escapeHtml(tier.highlight)}</h3>
            <p>Starts at ${escapeHtml(String(tier.minPoints))} points.</p>
            <ul class="admin-list">
              ${tier.perks.map((perk) => `<li>${escapeHtml(perk)}</li>`).join("")}
            </ul>
          </article>
        `
      )
      .join("");

    document.querySelector("[data-membership-benefits]").innerHTML = (siteData.membership?.benefits || [])
      .map((benefit) => `<li>${escapeHtml(benefit)}</li>`)
      .join("");

    const form = document.querySelector("[data-membership-form]");
    const rememberedPhone = queryParam("phone") || getRememberedCustomerPhone();
    if (rememberedPhone) {
      form.phone.value = rememberedPhone;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const response = await joinMembership({
          name: form.name.value,
          phone: form.phone.value,
          email: form.email.value
        });
        const strip = document.querySelector("[data-membership-strip]");
        strip.classList.remove("hidden");
        document.querySelector("[data-membership-strip-title]").textContent = response.customer.member.active
          ? "Membership active"
          : "Membership updated";
        document.querySelector("[data-membership-strip-copy]").textContent = response.message;
        showToast(response.message);
      } catch (error) {
        showToast(error.message);
      }
    });

    initReveal();
  }

  initOffersPage().catch((error) => {
    console.error(error);
  });
})();
