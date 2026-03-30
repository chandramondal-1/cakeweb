(function () {
  const {
    createUpiLink,
    escapeHtml,
    formatCurrency,
    initNavigation,
    initReveal,
    isMobileDevice,
    normalizePhone,
    queryParam,
    routeUrl,
    setText,
    showToast
  } = window.TVBShared;
  const { menuData, siteData } = window.TVBData;
  const {
    createOrder,
    getCustomerDashboard,
    getRememberedCustomerPhone,
    saveDesign
  } = window.TVBStore;

  const state = {
    appliedCouponCode: "",
    referenceImage: "",
    dashboard: null
  };

  function flattenMenu(menuGroups) {
    return menuGroups.flatMap((group) =>
      group.items.map((item) => ({
        ...item,
        category: group.title,
        categorySlug: group.slug
      }))
    );
  }

  function flavourLayerBackground(flavour) {
    const palette = {
      vanilla: "linear-gradient(180deg, #fff6df, #f1d6a8)",
      chocolate: "linear-gradient(180deg, #8d5c42, #5d382b)",
      "red velvet": "linear-gradient(180deg, #d35e6d, #9d3449)",
      blueberry: "linear-gradient(180deg, #8f95d5, #5d67a7)",
      butterscotch: "linear-gradient(180deg, #ffd08f, #d38a46)",
      "black forest": "linear-gradient(180deg, #8a4a4a, #4a1f25)"
    };

    return palette[String(flavour || "").toLowerCase()] || palette.vanilla;
  }

  function titleCase(value) {
    return String(value || "")
      .split(" ")
      .filter(Boolean)
      .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1))
      .join(" ");
  }

  function normalizedShape(shape) {
    const value = String(shape || "").toLowerCase();
    if (value.includes("square")) {
      return "square";
    }
    if (value.includes("heart")) {
      return "heart";
    }
    return "round";
  }

  function tierCountForShape(shape) {
    const value = String(shape || "").toLowerCase();
    if (value.includes("three")) {
      return 3;
    }
    if (value.includes("two")) {
      return 2;
    }
    return 0;
  }

  function paymentReceiver() {
    return siteData.checkout?.paymentReceiver || {};
  }

  function paymentMethodLabel(methodId) {
    return (
      (siteData.checkout?.paymentMethods || []).find((entry) => entry.id === methodId)?.label ||
      titleCase(methodId || "UPI")
    );
  }

  function paymentMethodNote(methodId, total) {
    const receiver = paymentReceiver();
    const amount = formatCurrency(total || 0);
    const destination = receiver.upiId || "the bakery UPI";

    if (String(methodId || "").toLowerCase() === "paytm") {
      return `Paytm or any installed UPI app will open on mobile with ${amount} prefilled for ${destination}.`;
    }

    return `Google Pay, PhonePe, Paytm, and other installed UPI apps can open on mobile with ${amount} prefilled for ${destination}.`;
  }

  function createPaymentLink(total, trackingId, methodId) {
    if (!["upi", "paytm"].includes(String(methodId || "").toLowerCase())) {
      return "";
    }

    const receiver = paymentReceiver();
    return createUpiLink({
      vpa: receiver.upiId,
      payeeName: receiver.payeeName || siteData.brand.name,
      amount: total,
      note: `${siteData.brand.name} order ${trackingId}`,
      transactionId: trackingId
    });
  }

  function resolvedOrderTotal(response, summary) {
    const pricingTotal = Number(response?.order?.pricing?.total);
    if (Number.isFinite(pricingTotal) && pricingTotal > 0) {
      return pricingTotal;
    }

    const summaryTotal = Number(summary?.total);
    if (Number.isFinite(summaryTotal) && summaryTotal > 0) {
      return summaryTotal;
    }

    const legacyTotal = Number(response?.order?.total);
    if (Number.isFinite(legacyTotal) && legacyTotal > 0) {
      return legacyTotal;
    }

    return 0;
  }

  function customCakeQuote(customCake) {
    if (!customCake || !customCake.size || !customCake.flavour) {
      return 0;
    }

    const base = {
      "0.5 kg": 699,
      "1 kg": 1199,
      "1.5 kg": 1599,
      "2 kg": 1999
    };
    const layerPrice = {
      "1 layer": 0,
      "2 layer": 180,
      "3 layer": 360
    };
    const premiumFillings = ["biscoff crunch", "nutella swirl", "blueberry compote"];
    const fillingPrice = premiumFillings.includes(customCake.filling) ? 110 : customCake.filling ? 70 : 0;
    const texturePrice = customCake.texture === "floral piping" ? 120 : customCake.texture ? 60 : 0;
    const topperPrice = customCake.topper ? 90 : 0;
    const dietaryPrice =
      customCake.dietary === "Eggless" ? 80 : customCake.dietary === "Sugar conscious" ? 120 : 0;

    return (
      (base[customCake.size] || 699) +
      (layerPrice[customCake.layers] || 0) +
      fillingPrice +
      texturePrice +
      topperPrice +
      dietaryPrice +
      customCake.toppings.length * 40
    );
  }

  function deliveryFee(form) {
    const fees = siteData.checkout?.deliveryFees || {};
    const method = form.querySelector("[name='fulfillmentMethod']:checked")?.value || "delivery";
    const speed = form.deliverySpeed.value || "delivery";

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

  function computeCoupon(subtotal, includeCustomCake) {
    const coupons = siteData.checkout?.coupons || [];
    const activeCode = String(state.appliedCouponCode || "").trim().toUpperCase();
    if (!activeCode) {
      return {
        coupon: null,
        discount: 0,
        error: ""
      };
    }

    const coupon = coupons.find((entry) => String(entry.code).toUpperCase() === activeCode);
    if (!coupon) {
      return {
        coupon: null,
        discount: 0,
        error: "Coupon code was not found."
      };
    }

    if (subtotal < Number(coupon.minSubtotal || 0)) {
      return {
        coupon,
        discount: 0,
        error: `Coupon ${coupon.code} needs a subtotal of ${formatCurrency(coupon.minSubtotal)} or more.`
      };
    }

    if (String(coupon.audience || "").toLowerCase() === "custom cake" && !includeCustomCake) {
      return {
        coupon,
        discount: 0,
        error: `${coupon.code} only applies to custom cake orders.`
      };
    }

    let discount = 0;
    if (String(coupon.type || "").toLowerCase() === "flat") {
      discount = Number(coupon.value || 0);
    } else {
      discount = Math.round(subtotal * Number(coupon.value || 0) / 100);
    }

    discount = Math.min(discount, Number(coupon.maxDiscount || discount), subtotal);
    return {
      coupon,
      discount,
      error: ""
    };
  }

  function pointsForTotal(total) {
    const divisor = Number(siteData.membership?.pointsPerOrderRupees || 20);
    return Math.max(Math.floor(Number(total || 0) / divisor), Number(total || 0) > 0 ? 10 : 0);
  }

  function builderPayloadFromForm(form) {
    return {
      shape: form.shape.value,
      size: form.size.value,
      layers: form.layers.value,
      flavour: form.flavour.value,
      cream: form.cream.value,
      filling: form.filling.value,
      frostingColor: form.frostingColor.value,
      texture: form.texture.value,
      topper: form.topper.value,
      theme: form.theme.value,
      dietary: form.dietary.value,
      message: form.cakeMessage.value,
      photoReference: form.photoReference.value,
      referenceImage: form.referenceImage.value,
      toppings: Array.from(form.querySelectorAll("input[name='toppings']"))
        .filter((input) => input.checked)
        .map((input) => input.value)
    };
  }

  function renderCakePreview(customCake, container) {
    if (!container) {
      return;
    }

    if (!customCake || !customCake.size || !customCake.flavour) {
      delete container.dataset.shape;
      delete container.dataset.tierCount;
      container.innerHTML = `
        <div class="cake-empty-state">
          <strong>Custom cake preview</strong>
          <span>Enable the custom builder to see the live cake composition here.</span>
        </div>
      `;
      return;
    }

    const layerCount = Number(String(customCake.layers || "1").split(" ")[0]) || 1;
    const tierCount = tierCountForShape(customCake.shape);
    const displayCount = Math.max(tierCount || layerCount, 1);
    container.dataset.shape = normalizedShape(customCake.shape);
    container.dataset.tierCount = String(displayCount);
    const toppings = customCake.toppings.length
      ? customCake.toppings.map((item) => `<span title="${escapeHtml(item)}"></span>`).join("")
      : "<span></span><span></span><span></span>";

    container.innerHTML = `
      <div class="cake-topper">${escapeHtml(customCake.message || customCake.topper || "The Vanilla Bean")}</div>
      ${Array.from({ length: displayCount })
        .map(
          () => `
            <div class="cake-layer" style="background:${flavourLayerBackground(customCake.flavour)};">
              <div class="cake-frosting" style="background:${escapeHtml(customCake.frostingColor || "#f7e7c1")};"></div>
              <div class="${customCake.texture === "floral piping" ? "cake-orbs" : "cake-sprinkles"}">
                ${toppings}
              </div>
            </div>
          `
        )
        .join("")}
    `;
  }

  function renderReferencePreview(dataUrl) {
    const preview = document.querySelector("[data-reference-preview]");
    if (!preview) {
      return;
    }

    if (!dataUrl) {
      preview.innerHTML = "<span>No reference image uploaded yet.</span>";
      return;
    }

    preview.innerHTML = `<img src="${dataUrl}" alt="Uploaded cake reference preview">`;
  }

  function renderPaymentOptions(selected) {
    const node = document.querySelector("[data-payment-options]");
    const methods = siteData.checkout?.paymentMethods || [];

    node.innerHTML = methods
      .map(
        (method, index) => `
          <label class="check-pill payment-pill">
            <input type="radio" name="paymentMethod" value="${escapeHtml(method.id)}" ${
              selected ? (selected === method.id ? "checked" : "") : index === 0 ? "checked" : ""
            }>
            <span>${escapeHtml(method.label)}</span>
          </label>
        `
      )
      .join("");
  }

  function renderColorOptions(selectedValue) {
    const node = document.querySelector("[data-color-options]");
    const colors = siteData.builderOptions?.colors || [];
    node.innerHTML = colors
      .map(
        (color, index) => `
          <button
            class="color-swatch ${selectedValue ? (selectedValue === color.value ? "is-active" : "") : index === 0 ? "is-active" : ""}"
            type="button"
            data-color-value="${escapeHtml(color.value)}"
            aria-label="${escapeHtml(color.name)}"
            style="--swatch:${escapeHtml(color.value)};"
          ></button>
        `
      )
      .join("");
  }

  function populateSelect(node, values, selectedValue) {
    node.innerHTML = values
      .map((value, index) => {
        const selected = selectedValue ? selectedValue === value : index === 0;
        return `<option value="${escapeHtml(value)}" ${selected ? "selected" : ""}>${escapeHtml(value)}</option>`;
      })
      .join("");
  }

  function renderToppings() {
    const node = document.querySelector("[data-topping-options]");
    const toppings = ["macarons", "fresh fruits", "gold foil", "choco chips", "berries", "cookies"];
    node.innerHTML = toppings
      .map(
        (value) => `
          <label class="check-pill">
            <input type="checkbox" name="toppings" value="${escapeHtml(value)}">
            <span>${escapeHtml(value)}</span>
          </label>
        `
      )
      .join("");
  }

  function renderMenuOptions(menuGroups, selectedId) {
    const select = document.querySelector("[name='itemId']");
    select.innerHTML = `
      <option value="">Choose a menu favorite</option>
      ${menuGroups
        .map(
          (group) => `
            <optgroup label="${escapeHtml(group.title)}">
              ${group.items
                .map(
                  (item) => `
                    <option value="${escapeHtml(item.id)}" ${selectedId === item.id ? "selected" : ""}>
                      ${escapeHtml(item.name)} - ${formatCurrency(item.price)}
                    </option>
                  `
                )
                .join("")}
            </optgroup>
          `
        )
        .join("")}
    `;
  }

  function renderCustomerStrip(dashboard) {
    const strip = document.querySelector("[data-customer-strip]");
    const hasHistory =
      dashboard &&
      (
        dashboard.orders?.length ||
        dashboard.customer?.loyaltyPoints ||
        dashboard.customer?.addresses?.length ||
        dashboard.customer?.savedDesigns?.length ||
        dashboard.customer?.name ||
        dashboard.customer?.email
      );

    if (!hasHistory) {
      strip.classList.add("hidden");
      return;
    }

    strip.classList.remove("hidden");
    document.querySelector("[data-customer-strip-title]").textContent = `Welcome back, ${
      dashboard.customer.name || dashboard.phone
    }`;
    document.querySelector("[data-customer-strip-copy]").textContent =
      `${dashboard.orders.length} orders, ${dashboard.customer.loyaltyPoints} points, ${dashboard.customer.savedDesigns.length} saved designs.`;
  }

  function renderAddressSuggestions(dashboard, form) {
    const node = document.querySelector("[data-address-suggestions]");
    const addresses = dashboard?.customer?.addresses || [];

    if (!addresses.length) {
      node.classList.add("hidden");
      node.innerHTML = "";
      return;
    }

    node.classList.remove("hidden");
    node.innerHTML = addresses
      .map(
        (address) => `
          <button class="chip-button" type="button" data-address-id="${escapeHtml(address.id)}">
            ${escapeHtml(address.label)}
          </button>
        `
      )
      .join("");

    node.querySelectorAll("[data-address-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const chosen = addresses.find((address) => address.id === button.dataset.addressId);
        if (!chosen) {
          return;
        }
        form.addressLabel.value = chosen.label || "";
        form.landmark.value = chosen.landmark || "";
        form.address.value = chosen.addressLine || "";
        form.saveAddress.checked = true;
        updateSummary(form);
      });
    });
  }

  function renderDesignSuggestions(dashboard, form) {
    const node = document.querySelector("[data-design-suggestions]");
    const designs = dashboard?.customer?.savedDesigns || [];

    if (!designs.length) {
      node.classList.add("hidden");
      node.innerHTML = "";
      return;
    }

    node.classList.remove("hidden");
    node.innerHTML = designs
      .slice(0, 6)
      .map(
        (design) => `
          <button class="chip-button" type="button" data-design-id="${escapeHtml(design.id)}">
            ${escapeHtml(design.label)}
          </button>
        `
      )
      .join("");

    node.querySelectorAll("[data-design-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const chosen = designs.find((design) => design.id === button.dataset.designId);
        if (!chosen) {
          return;
        }
        applyDesignToForm(form, chosen);
      });
    });
  }

  function applyDesignToForm(form, design) {
    form.includeCustomCake.checked = true;
    form.shape.value = design.shape || form.shape.value;
    form.size.value = design.size || form.size.value;
    form.layers.value = design.layers || form.layers.value;
    form.flavour.value = design.flavour || form.flavour.value;
    form.cream.value = design.cream || form.cream.value;
    form.filling.value = design.filling || form.filling.value;
    form.texture.value = design.texture || form.texture.value;
    form.topper.value = design.topper || form.topper.value;
    form.dietary.value = design.dietary || form.dietary.value;
    form.theme.value = design.theme || "";
    form.photoReference.value = design.photoReference || "";
    form.referenceImage.value = design.referenceImage || "";
    form.cakeMessage.value = design.message || "";
    form.designLabel.value = design.label || "";
    form.savedDesignId.value = design.id || "";
    form.frostingColor.value = design.frostingColor || "#f7e7c1";

    Array.from(form.querySelectorAll("input[name='toppings']")).forEach((input) => {
      input.checked = (design.toppings || []).includes(input.value);
    });

    renderColorOptions(form.frostingColor.value);
    bindColorButtons(form);
    state.referenceImage = design.referenceImage || "";
    renderReferencePreview(state.referenceImage);
    updateSummary(form);
  }

  async function loadDashboardForPhone(phone, form) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      state.dashboard = null;
      renderCustomerStrip(null);
      renderAddressSuggestions(null, form);
      renderDesignSuggestions(null, form);
      return;
    }

    try {
      const dashboard = await getCustomerDashboard(normalizedPhone);
      state.dashboard = dashboard;
      renderCustomerStrip(dashboard);
      renderAddressSuggestions(dashboard, form);
      renderDesignSuggestions(dashboard, form);

      if (!form.customerName.value && dashboard.customer.name) {
        form.customerName.value = dashboard.customer.name;
      }
      if (!form.email.value && dashboard.customer.email) {
        form.email.value = dashboard.customer.email;
      }
    } catch (error) {
      state.dashboard = null;
      renderCustomerStrip(null);
      renderAddressSuggestions(null, form);
      renderDesignSuggestions(null, form);
    }
  }

  function bindColorButtons(form) {
    document.querySelectorAll("[data-color-value]").forEach((button) => {
      button.addEventListener("click", () => {
        form.frostingColor.value = button.dataset.colorValue;
        document.querySelectorAll("[data-color-value]").forEach((node) => {
          node.classList.toggle("is-active", node === button);
        });
        updateSummary(form);
      });
    });
  }

  function renderCouponStrip(summary) {
    const strip = document.querySelector("[data-coupon-strip]");
    if (!state.appliedCouponCode) {
      strip.classList.add("hidden");
      return;
    }

    strip.classList.remove("hidden");
    document.querySelector("[data-coupon-title]").textContent = summary.coupon
      ? `${summary.coupon.code} applied`
      : "Coupon not eligible";
    document.querySelector("[data-coupon-copy]").textContent = summary.couponError
      ? summary.couponError
      : summary.coupon.description;
  }

  function renderPaymentStrip(summary) {
    const receiver = paymentReceiver();
    document.querySelector("[data-summary-payee]").textContent =
      `${receiver.payeeNumber || "7811089216"} • ${receiver.upiId || "7811089216@ybl"}`;
    document.querySelector("[data-payment-title]").textContent = `${paymentMethodLabel(summary.payment)} payment`;
    document.querySelector("[data-payment-copy]").textContent = paymentMethodNote(summary.payment, summary.total);
  }

  function renderLivePreviewMeta(summary) {
    const shapeNode = document.querySelector("[data-live-shape]");
    const themeNode = document.querySelector("[data-live-theme]");
    const toppingsNode = document.querySelector("[data-live-toppings]");

    if (!summary.includeCustomCake) {
      shapeNode.textContent = "Ready-made";
      themeNode.textContent = "Builder off";
      toppingsNode.textContent = "0 toppings";
      return;
    }

    shapeNode.textContent = titleCase(summary.customCake.shape || "Round");
    themeNode.textContent = titleCase(summary.customCake.theme || "Minimal");
    toppingsNode.textContent = `${summary.customCake.toppings.length} topping${
      summary.customCake.toppings.length === 1 ? "" : "s"
    }`;
  }

  function summaryState(form) {
    const menuItems = flattenMenu(menuData);
    const selectedItem = menuItems.find((item) => item.id === form.itemId.value) || null;
    const includeCustomCake = Boolean(form.includeCustomCake.checked);
    const customCake = builderPayloadFromForm(form);
    const itemSubtotal = selectedItem ? Number(selectedItem.price || 0) * Number(form.quantity.value || 1) : 0;
    const customSubtotal = includeCustomCake ? customCakeQuote(customCake) : 0;
    const subtotal = itemSubtotal + customSubtotal;
    const shipping = deliveryFee(form);
    const couponMeta = computeCoupon(subtotal, includeCustomCake);
    const total = Math.max(subtotal + shipping - Number(couponMeta.discount || 0), 0);
    const payment =
      form.querySelector("[name='paymentMethod']:checked")?.value ||
      siteData.checkout?.paymentMethods?.[0]?.id ||
      "upi";

    return {
      selectedItem,
      customCake,
      includeCustomCake,
      itemSubtotal,
      customSubtotal,
      subtotal,
      shipping,
      coupon: couponMeta.coupon,
      couponError: couponMeta.error,
      discount: Number(couponMeta.discount || 0),
      total,
      payment,
      points: pointsForTotal(total)
    };
  }

  function updateSummary(form) {
    const summary = summaryState(form);

    if (!summary.includeCustomCake && form.saveDesignOnCheckout.checked) {
      form.saveDesignOnCheckout.checked = false;
    }
    form.saveDesignOnCheckout.disabled = !summary.includeCustomCake;

    document.querySelector("[data-summary-item]").textContent = summary.selectedItem
      ? `${summary.selectedItem.name} x ${form.quantity.value || 1}`
      : "No ready-made item selected";
    document.querySelector("[data-summary-custom]").textContent = summary.includeCustomCake
      ? `${summary.customCake.size}, ${summary.customCake.layers}, ${summary.customCake.flavour}`
      : "No custom cake configuration yet";
    document.querySelector("[data-summary-subtotal]").textContent = formatCurrency(summary.subtotal);
    document.querySelector("[data-summary-delivery]").textContent = formatCurrency(summary.shipping);
    document.querySelector("[data-summary-discount]").textContent = `- ${formatCurrency(summary.discount)}`;
    document.querySelector("[data-summary-payment]").textContent = (
      siteData.checkout?.paymentMethods || []
    ).find((entry) => entry.id === summary.payment)?.label || summary.payment;
    document.querySelector("[data-summary-points]").textContent = `${summary.points} points`;
    document.querySelector("[data-summary-total]").textContent = formatCurrency(summary.total);
    renderPaymentStrip(summary);
    renderLivePreviewMeta(summary);

    renderCakePreview(
      summary.includeCustomCake ? summary.customCake : null,
      document.querySelector("[data-cake-visual]")
    );
    renderReferencePreview(
      summary.includeCustomCake ? state.referenceImage || form.referenceImage.value : ""
    );
    renderCouponStrip(summary);
    return summary;
  }

  function queryPrefill(form) {
    const rememberedPhone = getRememberedCustomerPhone();
    const phoneQuery = queryParam("phone") || rememberedPhone;
    if (phoneQuery) {
      form.phone.value = phoneQuery;
    }

    const quickItem = queryParam("item");
    if (quickItem) {
      form.itemId.value = quickItem;
    }

    if (queryParam("custom")) {
      form.includeCustomCake.checked = true;
      form.shape.value = queryParam("shape") || form.shape.value;
      form.size.value = queryParam("size") || form.size.value;
      form.flavour.value = queryParam("flavour") || form.flavour.value;
      form.cream.value = queryParam("cream") || form.cream.value;
      form.theme.value = queryParam("theme") || "";
      form.cakeMessage.value = queryParam("message") || "";
    }

    const couponCode = queryParam("coupon");
    if (couponCode) {
      form.couponCode.value = couponCode;
      state.appliedCouponCode = couponCode.toUpperCase();
    }
  }

  async function initOrderPage() {
    initNavigation();

    const site = siteData;
    setText("[data-brand-name]", site.brand.name);
    setText("[data-brand-tagline]", site.brand.tagline);
    document.querySelectorAll("[data-phone-link]").forEach((node) => {
      node.href = `tel:+${site.brand.phoneRaw}`;
    });

    const form = document.querySelector("[data-order-form]");
    const builder = site.builderOptions || {};

    renderMenuOptions(menuData, queryParam("item"));
    populateSelect(form.shape, builder.shapes || ["Round"], "Round");
    populateSelect(form.layers, builder.layers || ["1 layer"], "2 layer");
    populateSelect(form.flavour, builder.flavours || ["vanilla"], queryParam("flavour") || "vanilla");
    populateSelect(
      form.cream,
      builder.creamOptions || ["whipped cream"],
      queryParam("cream") || "whipped cream"
    );
    populateSelect(form.filling, builder.fillings || ["fresh fruit"], "fresh fruit");
    populateSelect(form.texture, builder.textures || ["smooth finish"], "smooth finish");
    populateSelect(form.topper, builder.toppers || ["message topper"], "message topper");
    populateSelect(form.dietary, builder.dietary || ["No special dietary request"], "No special dietary request");
    renderPaymentOptions("upi");
    renderColorOptions("#f7e7c1");
    renderToppings();
    bindColorButtons(form);
    queryPrefill(form);

    form.addEventListener("input", () => {
      updateSummary(form);
    });

    form.phone.addEventListener("change", () => {
      loadDashboardForPhone(form.phone.value, form);
    });
    form.phone.addEventListener("blur", () => {
      loadDashboardForPhone(form.phone.value, form);
    });

    document.querySelector("[data-apply-coupon]").addEventListener("click", () => {
      state.appliedCouponCode = String(form.couponCode.value || "").trim().toUpperCase();
      const summary = updateSummary(form);
      if (summary.couponError) {
        showToast(summary.couponError);
      } else if (summary.coupon) {
        showToast(`${summary.coupon.code} applied successfully.`);
      }
    });

    form.referenceUpload.addEventListener("change", () => {
      const [file] = form.referenceUpload.files || [];
      if (!file) {
        state.referenceImage = "";
        form.referenceImage.value = "";
        renderReferencePreview("");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        state.referenceImage = String(reader.result || "");
        form.referenceImage.value = state.referenceImage;
        renderReferencePreview(state.referenceImage);
        updateSummary(form);
      };
      reader.readAsDataURL(file);
    });

    document.querySelector("[data-save-design-button]").addEventListener("click", async () => {
      const phone = form.phone.value;
      const customCake = builderPayloadFromForm(form);
      const saveStatus = document.querySelector("[data-save-design-status]");

      if (!form.includeCustomCake.checked) {
        const message = "Enable the custom cake builder before saving a design.";
        saveStatus.textContent = message;
        showToast(message);
        return;
      }

      try {
        const response = await saveDesign(phone, {
          ...customCake,
          id: form.savedDesignId.value,
          label: form.designLabel.value
        });
        form.savedDesignId.value = response.design.id;
        saveStatus.textContent = "Design saved. You can reopen it from the dashboard or the chip list.";
        showToast(response.message);
        await loadDashboardForPhone(phone, form);
      } catch (error) {
        saveStatus.textContent = error.message;
        showToast(error.message);
      }
    });

    document.querySelector("[data-payment-copy-link]").addEventListener("click", async (event) => {
      event.preventDefault();
      const upiId = event.currentTarget.dataset.upiId || paymentReceiver().upiId || "";
      if (!upiId) {
        showToast("No UPI ID is configured.");
        return;
      }

      try {
        await navigator.clipboard.writeText(upiId);
        showToast("UPI ID copied.");
      } catch (error) {
        showToast(`UPI ID: ${upiId}`);
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitStatus = document.querySelector("[data-submit-status]");
      const summary = updateSummary(form);
      if (summary.couponError) {
        if (submitStatus) {
          submitStatus.textContent = summary.couponError;
        }
        showToast(summary.couponError);
        return;
      }

      const payload = {
        customerName: form.customerName.value,
        phone: form.phone.value,
        email: form.email.value,
        occasion: form.occasion.value,
        deliveryDate: form.deliveryDate.value,
        timeSlot: form.timeSlot.value,
        fulfillmentMethod:
          form.querySelector("[name='fulfillmentMethod']:checked")?.value || "delivery",
        deliverySpeed: form.deliverySpeed.value,
        addressLabel: form.addressLabel.value,
        landmark: form.landmark.value,
        address: form.address.value,
        notes: form.notes.value,
        itemId: form.itemId.value,
        quantity: Number(form.quantity.value || 1),
        paymentMethod:
          form.querySelector("[name='paymentMethod']:checked")?.value || "upi",
        couponCode: state.appliedCouponCode,
        saveAddress: form.saveAddress.checked,
        includeCustomCake: form.includeCustomCake.checked,
        saveDesignOnCheckout: form.saveDesignOnCheckout.checked,
        savedDesignId: form.savedDesignId.value,
        designLabel: form.designLabel.value,
        customCake: builderPayloadFromForm(form)
      };

      if (!payload.includeCustomCake) {
        payload.customCake = {};
      }

      const submitButton = form.querySelector("[type='submit']");
      submitButton.disabled = true;
      submitButton.textContent = "Creating order...";
      if (submitStatus) {
        submitStatus.textContent = "Saving your order and preparing the payment details...";
      }

      try {
        const response = await createOrder(payload);
        const finalTotal = resolvedOrderTotal(response, summary);
        showToast("Order request created successfully.");
        if (submitStatus) {
          submitStatus.textContent = "Order saved. Use the payment button below to continue on mobile.";
        }
        document.querySelector("[data-success-panel]").classList.remove("hidden");
        document.querySelector("[data-tracking-id]").textContent = response.trackingId;
        document.querySelector("[data-earned-points]").textContent = `${response.pointsEarned || summary.points} points`;
        document.querySelector("[data-payment-destination]").textContent =
          `${paymentReceiver().payeeNumber || "7811089216"} • ${paymentReceiver().upiId || "7811089216@ybl"}`;
        document.querySelector("[data-track-link]").href = routeUrl(`/track?id=${response.trackingId}`);
        document.querySelector("[data-dashboard-link]").href = routeUrl(
          `/dashboard?phone=${encodeURIComponent(normalizePhone(form.phone.value))}`
        );

        const paymentLink = createPaymentLink(
          finalTotal,
          response.trackingId,
          payload.paymentMethod
        );
        const paymentLinkNode = document.querySelector("[data-payment-link]");
        const paymentCopyNode = document.querySelector("[data-payment-copy-link]");
        const paymentHelpNode = document.querySelector("[data-payment-help]");
        const hasIntentPayment = Boolean(paymentLink);

        paymentLinkNode.classList.toggle("hidden", !hasIntentPayment);
        paymentCopyNode.classList.toggle("hidden", !hasIntentPayment);
        paymentHelpNode.classList.toggle("hidden", !hasIntentPayment);

        if (hasIntentPayment) {
          paymentLinkNode.href = paymentLink;
          paymentCopyNode.href = "#";
          paymentCopyNode.dataset.upiId = paymentReceiver().upiId || "";
          paymentLinkNode.textContent =
            payload.paymentMethod === "paytm" ? "Open Paytm / UPI app" : "Open payment app";
          paymentHelpNode.textContent = isMobileDevice()
            ? `Tap the payment button to pay ${formatCurrency(finalTotal)} to ${
                paymentReceiver().upiId || "7811089216@ybl"
              }.`
            : `Open the payment button on a mobile device, or pay ${formatCurrency(finalTotal)} to ${
                paymentReceiver().upiId || "7811089216@ybl"
              } in any UPI app.`;
          showToast("Order saved. Open the payment app button to continue.");
        }

        await loadDashboardForPhone(form.phone.value, form);
      } catch (error) {
        if (submitStatus) {
          submitStatus.textContent = error.message;
        }
        showToast(error.message);
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Place order request";
      }
    });

    await loadDashboardForPhone(form.phone.value || getRememberedCustomerPhone(), form);
    const designQuery = queryParam("design");
    const phoneQuery = queryParam("phone") || getRememberedCustomerPhone();
    if (designQuery && state.dashboard?.customer?.savedDesigns?.length) {
      const saved = state.dashboard.customer.savedDesigns.find((design) => design.id === designQuery);
      if (saved) {
        applyDesignToForm(form, saved);
      }
    } else if (phoneQuery && designQuery) {
      await loadDashboardForPhone(phoneQuery, form);
      const saved = state.dashboard?.customer?.savedDesigns?.find((design) => design.id === designQuery);
      if (saved) {
        applyDesignToForm(form, saved);
      }
    }

    updateSummary(form);
    initReveal();
  }

  initOrderPage().catch((error) => {
    console.error(error);
  });
})();
