(function () {
  const {
    createUpiLink,
    escapeHtml,
    formatCurrency,
    formatDate,
    formatDateTime,
    initNavigation,
    initReveal,
    queryParam,
    routeUrl,
    setText,
    showToast
  } = window.TVBShared;
  const { siteData } = window.TVBData;
  const { getOrderByTrackingId } = window.TVBStore;

  function paymentReceiver() {
    return siteData.checkout?.paymentReceiver || {};
  }

  function resolvedPaymentMethod(order) {
    const method = String(order.paymentMethod || "").toLowerCase();
    if (["upi", "paytm"].includes(method)) {
      return method;
    }
    return siteData.checkout?.paymentMethods?.[0]?.id || "upi";
  }

  function deliveryFeeForOrder(order) {
    const fees = siteData.checkout?.deliveryFees || {};
    const method = String(order.fulfillmentMethod || "delivery").toLowerCase();
    const speed = String(order.deliverySpeed || "delivery").toLowerCase();

    if (method === "pickup") {
      return Number(fees.pickup || 0);
    }
    if (speed === "express") {
      return Number(fees.express || fees.delivery || 0);
    }
    if (speed === "midnight") {
      return Number(fees.midnight || fees.delivery || 0);
    }
    return Number(fees.delivery || 0);
  }

  function resolvedOrderTotal(order) {
    const pricingTotal = Number(order.pricing?.total);
    if (Number.isFinite(pricingTotal) && pricingTotal > 0) {
      return pricingTotal;
    }

    const itemSubtotal = Number(order.selectedItem?.price || 0) * Math.max(Number(order.quantity || 1), 1);
    const legacyBase = Number(order.total || 0);
    const deliveryFee = deliveryFeeForOrder(order);
    const fallbackBase = itemSubtotal || legacyBase;
    return Math.max(fallbackBase + deliveryFee, legacyBase, 0);
  }

  function paymentLink(order) {
    const paymentMethod = resolvedPaymentMethod(order);
    const total = resolvedOrderTotal(order);

    if (!["upi", "paytm"].includes(paymentMethod) || total <= 0) {
      return "";
    }

    const receiver = paymentReceiver();
    return createUpiLink({
      vpa: receiver.upiId,
      payeeName: receiver.payeeName || siteData.brand.name,
      amount: total,
      note: `${siteData.brand.name} order ${order.trackingId}`,
      transactionId: order.trackingId
    });
  }

  function renderOrder(order) {
    const itemName = order.selectedItem?.name || order.customCake?.theme || "Custom cake request";
    const pricing = order.pricing || {};
    const receiver = paymentReceiver();
    const upiLink = paymentLink(order);
    const total = resolvedOrderTotal(order);
    const paymentMethod = resolvedPaymentMethod(order);
    const paymentLabel =
      (siteData.checkout?.paymentMethods || []).find((entry) => entry.id === paymentMethod)?.label ||
      paymentMethod ||
      "UPI";
    const paymentStatus =
      order.paymentStatus || (total > 0 ? "Awaiting UPI payment" : "Pending confirmation");
    return `
      <article class="summary-card">
        <span class="eyebrow">${escapeHtml(order.status)}</span>
        <h3>${escapeHtml(itemName)}</h3>
        <div class="summary-list">
          <div class="summary-row">
            <span>Tracking ID</span>
            <span>${escapeHtml(order.trackingId)}</span>
          </div>
          <div class="summary-row">
            <span>Customer</span>
            <span>${escapeHtml(order.customerName)}</span>
          </div>
          <div class="summary-row">
            <span>Delivery date</span>
            <span>${escapeHtml(order.deliveryDate)} • ${escapeHtml(order.timeSlot || "Flexible")}</span>
          </div>
          <div class="summary-row">
            <span>Ordered at</span>
            <span>${formatDateTime(order.createdAt)}</span>
          </div>
          <div class="summary-row">
            <span>Fulfillment</span>
            <span>${escapeHtml(order.fulfillmentMethod)}</span>
          </div>
          <div class="summary-row">
            <span>Payment method</span>
            <span>${escapeHtml(paymentLabel)}</span>
          </div>
          <div class="summary-row">
            <span>Payment status</span>
            <span>${escapeHtml(paymentStatus)}</span>
          </div>
          <div class="summary-row">
            <span>Pay to</span>
            <span>${escapeHtml(
              `${receiver.payeeNumber || "7811089216"} • ${receiver.upiId || "7811089216@ybl"}`
            )}</span>
          </div>
          <div class="summary-row">
            <span>Discount</span>
            <span>${formatCurrency(pricing.discount || 0)}</span>
          </div>
          <div class="summary-row">
            <span>Total estimate</span>
            <span>${formatCurrency(total)}</span>
          </div>
        </div>
        <div class="divider"></div>
        <div class="timeline-list">
          ${(order.timeline || [])
            .map(
              (step) => `
                <div class="timeline-item">
                  <div>
                    <strong>${escapeHtml(step.label)}</strong>
                    <p>${escapeHtml(step.detail)}</p>
                  </div>
                  <time>${step.at ? formatDateTime(step.at) : "Pending"}</time>
                </div>
              `
            )
            .join("")}
        </div>
        <div class="button-row">
          ${upiLink ? `<a class="button button-primary" href="${upiLink}">Pay this amount</a>` : ""}
          <a class="button button-secondary" href="${routeUrl(
            `/dashboard?phone=${encodeURIComponent(order.phone || "")}`
          )}">Open dashboard</a>
          <a class="button button-ghost" href="${routeUrl(
            `/order?phone=${encodeURIComponent(order.phone || "")}`
          )}">Reorder</a>
        </div>
      </article>
    `;
  }

  async function initTrackPage() {
    initNavigation();

    const site = siteData;
    setText("[data-brand-name]", site.brand.name);
    setText("[data-brand-tagline]", site.brand.tagline);

    const form = document.querySelector("[data-track-form]");
    const input = form.querySelector("[name='trackingId']");
    const result = document.querySelector("[data-track-result]");
    const empty = document.querySelector("[data-track-empty]");

    const search = async (trackingId) => {
      if (!trackingId) {
        showToast("Enter a tracking ID first.");
        return;
      }

      try {
        const order = await getOrderByTrackingId(trackingId);
        result.innerHTML = renderOrder(order);
        result.classList.remove("hidden");
        empty.classList.add("hidden");
      } catch (error) {
        result.classList.add("hidden");
        empty.classList.remove("hidden");
        showToast(error.message);
      }
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      search(input.value.trim());
    });

    const queryId = queryParam("id");
    if (queryId) {
      input.value = queryId;
      search(queryId);
    }

    initReveal();
  }

  initTrackPage().catch((error) => {
    console.error(error);
  });
})();
