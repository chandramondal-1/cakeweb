(function () {
  const {
    escapeHtml,
    formatCurrency,
    formatDate,
    initNavigation,
    initReveal,
    normalizePhone,
    queryParam,
    routeUrl,
    setText,
    showToast
  } = window.TVBShared;
  const { siteData } = window.TVBData;
  const {
    getCustomerDashboard,
    getRememberedCustomerPhone,
    saveAddress
  } = window.TVBStore;

  function reorderLink(order, phone) {
    const params = new URLSearchParams();
    params.set("phone", normalizePhone(phone));

    if (order.selectedItem?.id) {
      params.set("item", order.selectedItem.id);
    }

    if (order.customCake) {
      params.set("custom", "1");
      params.set("size", order.customCake.size || "");
      params.set("flavour", order.customCake.flavour || "");
      params.set("cream", order.customCake.cream || "");
      params.set("theme", order.customCake.theme || "");
      params.set("message", order.customCake.message || "");
    }

    return routeUrl(`/order?${params.toString()}`);
  }

  function designLink(phone, designId) {
    const params = new URLSearchParams();
    params.set("phone", normalizePhone(phone));
    params.set("design", designId);
    return routeUrl(`/order?${params.toString()}`);
  }

  function renderMetrics(dashboard) {
    const metrics = document.querySelector("[data-dashboard-metrics]");
    metrics.innerHTML = `
      <article class="metric-card">
        <strong>${dashboard.totals.orders}</strong>
        <span>Total orders</span>
      </article>
      <article class="metric-card">
        <strong>${formatCurrency(dashboard.totals.spend)}</strong>
        <span>Total spend</span>
      </article>
      <article class="metric-card">
        <strong>${dashboard.totals.loyaltyPoints}</strong>
        <span>Loyalty points</span>
      </article>
      <article class="metric-card">
        <strong>${dashboard.totals.savedDesigns}</strong>
        <span>Saved cake designs</span>
      </article>
    `;
  }

  function renderMembership(dashboard) {
    const member = dashboard.customer.member || {};
    const preferredPayment =
      (siteData.checkout?.paymentMethods || []).find(
        (entry) => entry.id === dashboard.customer.preferredPaymentMethod
      )?.label || dashboard.customer.preferredPaymentMethod || "Not set";
    const perks = (dashboard.customer.tier?.perks || [])
      .map((perk) => `<li>${escapeHtml(perk)}</li>`)
      .join("");

    document.querySelector("[data-dashboard-tier]").textContent = dashboard.customer.tier?.name || "Classic";
    document.querySelector("[data-dashboard-tier-copy]").textContent = member.active
      ? `${siteData.membership.name} member since ${formatDate(member.joinedAt)}.`
      : "Join the membership from the offers page to unlock welcome points and referral rewards.";

    document.querySelector("[data-membership-card]").innerHTML = `
      <span class="eyebrow">Membership and rewards</span>
      <h3>${escapeHtml(siteData.membership.name)}</h3>
      <p class="lead-copy">${escapeHtml(siteData.membership.tagline)}</p>
      <div class="summary-list">
        <div class="summary-row">
          <span>Tier</span>
          <span>${escapeHtml(dashboard.customer.tier?.name || "Classic")}</span>
        </div>
        <div class="summary-row">
          <span>Referral code</span>
          <span>${escapeHtml(dashboard.customer.referralCode)}</span>
        </div>
        <div class="summary-row">
          <span>Preferred payment</span>
          <span>${escapeHtml(preferredPayment)}</span>
        </div>
      </div>
      <div class="divider"></div>
      <ul class="admin-list">${perks}</ul>
      <div class="button-row">
        <a class="button button-secondary" href="../offers/index.html">Manage membership</a>
      </div>
    `;
  }

  function renderAddresses(dashboard) {
    const addresses = dashboard.customer.addresses || [];
    const node = document.querySelector("[data-address-list]");

    if (!addresses.length) {
      node.innerHTML = `<p class="helper">No saved addresses yet. Save one below for faster checkout later.</p>`;
      return;
    }

    node.innerHTML = addresses
      .map(
        (address) => `
          <article class="address-card">
            <strong>${escapeHtml(address.label)}</strong>
            <p>${escapeHtml(address.addressLine)}</p>
            <span>${escapeHtml(address.landmark || "No landmark")}</span>
            ${address.isDefault ? `<span class="status-pill">Default</span>` : ""}
          </article>
        `
      )
      .join("");
  }

  function renderDesigns(dashboard) {
    const node = document.querySelector("[data-design-grid]");
    const designs = dashboard.customer.savedDesigns || [];

    if (!designs.length) {
      node.innerHTML = `
        <article class="card">
          <strong class="tagline-chip">No saved designs</strong>
          <h3>Create a new custom cake idea</h3>
          <p>Saved designs from the builder will appear here with a one-click reorder link.</p>
        </article>
      `;
      return;
    }

    node.innerHTML = designs
      .map(
        (design) => `
          <article class="card design-card">
            <strong class="tagline-chip">${escapeHtml(design.label)}</strong>
            <h3>${escapeHtml(design.size)} • ${escapeHtml(design.flavour)}</h3>
            <p>${escapeHtml(design.theme || "Custom theme")} • ${escapeHtml(design.layers || "1 layer")} • ${escapeHtml(design.cream || "cream finish")}</p>
            <div class="button-row">
              <a class="button button-secondary" href="${designLink(dashboard.phone, design.id)}">Use this design</a>
            </div>
          </article>
        `
      )
      .join("");
  }

  function renderOrders(dashboard) {
    const orders = dashboard.orders || [];
    const node = document.querySelector("[data-order-history]");

    if (!orders.length) {
      node.innerHTML = `<tr><td colspan="5">No orders yet. Place a new one to start your history.</td></tr>`;
      return;
    }

    node.innerHTML = orders
      .map(
        (order) => `
          <tr>
            <td>${escapeHtml(order.trackingId)}</td>
            <td>${escapeHtml(order.occasion || "General")}</td>
            <td><span class="status-pill">${escapeHtml(order.status)}</span></td>
            <td>${formatCurrency(order.total)}</td>
            <td>
              <div class="button-stack">
                <a class="button button-secondary" href="${routeUrl(`/track?id=${order.trackingId}`)}">Track</a>
                <a class="button button-ghost" href="${reorderLink(order, dashboard.phone)}">Reorder</a>
              </div>
            </td>
          </tr>
        `
      )
      .join("");
  }

  async function loadDashboard(phone) {
    const dashboard = await getCustomerDashboard(phone);
    document.querySelector("[data-dashboard-results]").classList.remove("hidden");
    renderMetrics(dashboard);
    renderMembership(dashboard);
    renderAddresses(dashboard);
    renderDesigns(dashboard);
    renderOrders(dashboard);
    document.querySelector("[data-address-form]").phone.value = dashboard.phone;
    return dashboard;
  }

  async function initDashboardPage() {
    initNavigation();
    setText("[data-brand-name]", siteData.brand.name);
    setText("[data-brand-tagline]", siteData.brand.tagline);

    const form = document.querySelector("[data-dashboard-form]");
    const addressForm = document.querySelector("[data-address-form]");
    const initialPhone = queryParam("phone") || getRememberedCustomerPhone();

    if (initialPhone) {
      form.phone.value = initialPhone;
      try {
        await loadDashboard(initialPhone);
      } catch (error) {
        showToast(error.message);
      }
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await loadDashboard(form.phone.value);
      } catch (error) {
        showToast(error.message);
      }
    });

    addressForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await saveAddress(addressForm.phone.value, {
          label: addressForm.label.value,
          addressLine: addressForm.addressLine.value,
          landmark: addressForm.landmark.value,
          isDefault: addressForm.isDefault.checked
        });
        showToast("Address saved successfully.");
        await loadDashboard(addressForm.phone.value);
        addressForm.reset();
        addressForm.isDefault.checked = true;
        addressForm.phone.value = normalizePhone(form.phone.value);
      } catch (error) {
        showToast(error.message);
      }
    });

    initReveal();
  }

  initDashboardPage().catch((error) => {
    console.error(error);
  });
})();
