(function () {
  const { escapeHtml, formatCurrency, initNavigation, initReveal, setText, showToast } =
    window.TVBShared;
  const { siteData } = window.TVBData;
  const {
    getAdminSummary,
    getMessages,
    getOrders,
    updateMessageStatus,
    updateOrderStatus
  } = window.TVBStore;

  const ADMIN_PIN = "vanillabean2026";
  const ORDER_STATUSES = [
    "Order received",
    "Baker reviewing",
    "In kitchen",
    "Ready for pickup",
    "Out for delivery",
    "Delivered",
    "Completed",
    "Cancelled"
  ];

  const MESSAGE_STATUSES = ["new", "reviewing", "resolved"];

  const state = {
    orders: [],
    messages: []
  };

  function describeOrder(order) {
    if (order.selectedItem?.name) {
      return order.selectedItem.name;
    }

    if (order.customCake) {
      return [order.customCake.size, order.customCake.flavour, order.customCake.theme]
        .filter(Boolean)
        .join(" • ") || "Custom cake";
    }

    return "Custom cake";
  }

  function renderMetrics(summary) {
    document.querySelector("[data-admin-metrics]").innerHTML = `
      <article class="metric-card">
        <strong>${summary.totals.orders}</strong>
        <span>Total order requests</span>
      </article>
      <article class="metric-card">
        <strong>${summary.totals.pendingOrders}</strong>
        <span>Pending order flow</span>
      </article>
      <article class="metric-card">
        <strong>${formatCurrency(summary.totals.revenue)}</strong>
        <span>Estimated booked value</span>
      </article>
      <article class="metric-card">
        <strong>${summary.totals.activeMembers}</strong>
        <span>Active loyalty members</span>
      </article>
    `;

    document.querySelector("[data-status-pills]").innerHTML = Object.entries(summary.statusCounts || {})
      .map(
        ([status, count]) => `
          <span class="pill">${escapeHtml(status)}: ${count}</span>
        `
      )
      .join("");
  }

  function filteredOrders() {
    const query = document.querySelector("[data-order-search]").value.trim().toLowerCase();
    const status = document.querySelector("[data-order-filter]").value;

    return state.orders.filter((order) => {
      const matchesStatus = status === "all" || order.status === status;
      const haystack = `${order.trackingId} ${order.customerName} ${order.occasion}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      return matchesStatus && matchesQuery;
    });
  }

  function orderRow(order) {
    return `
      <tr>
        <td>${escapeHtml(order.trackingId)}</td>
        <td>
          <strong>${escapeHtml(order.customerName)}</strong>
          <div class="helper">${escapeHtml(order.phone || "")}</div>
        </td>
        <td>
          <strong>${escapeHtml(describeOrder(order))}</strong>
          <div class="helper">${escapeHtml(order.occasion || "General")} • ${formatCurrency(order.total)}</div>
        </td>
        <td><span class="status-pill">${escapeHtml(order.status)}</span></td>
        <td>
          <div class="admin-action-stack">
            <select data-order-status="${escapeHtml(order.trackingId)}">
              ${ORDER_STATUSES.map(
                (status) => `
                  <option value="${escapeHtml(status)}" ${status === order.status ? "selected" : ""}>
                    ${escapeHtml(status)}
                  </option>
                `
              ).join("")}
            </select>
            <button class="button button-secondary" type="button" data-update-order="${escapeHtml(order.trackingId)}">
              Update
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  function messageRow(message) {
    return `
      <tr>
        <td>
          <strong>${escapeHtml(message.customerName)}</strong>
          <div class="helper">${escapeHtml(message.message || "")}</div>
        </td>
        <td>${escapeHtml(message.subject || "General enquiry")}</td>
        <td>${escapeHtml(message.phone || message.email || "-")}</td>
        <td><span class="status-pill">${escapeHtml(message.statusLabel || message.status || "new")}</span></td>
        <td>
          <div class="admin-action-stack">
            <select data-message-status="${escapeHtml(message.id)}">
              ${MESSAGE_STATUSES.map(
                (status) => `
                  <option value="${escapeHtml(status)}" ${status === message.status ? "selected" : ""}>
                    ${escapeHtml(status)}
                  </option>
                `
              ).join("")}
            </select>
            <button class="button button-ghost" type="button" data-update-message="${escapeHtml(message.id)}">
              Save
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  function bindOrderActions() {
    document.querySelectorAll("[data-update-order]").forEach((button) => {
      button.addEventListener("click", async () => {
        const trackingId = button.dataset.updateOrder;
        const select = document.querySelector(`[data-order-status="${trackingId}"]`);
        try {
          button.disabled = true;
          button.textContent = "Updating...";
          await updateOrderStatus(trackingId, select.value);
          showToast("Order status updated.");
          await loadDashboard();
        } catch (error) {
          showToast(error.message);
        } finally {
          button.disabled = false;
          button.textContent = "Update";
        }
      });
    });
  }

  function bindMessageActions() {
    document.querySelectorAll("[data-update-message]").forEach((button) => {
      button.addEventListener("click", async () => {
        const messageId = button.dataset.updateMessage;
        const select = document.querySelector(`[data-message-status="${messageId}"]`);
        try {
          button.disabled = true;
          button.textContent = "Saving...";
          await updateMessageStatus(messageId, select.value);
          showToast("Message status updated.");
          await loadDashboard();
        } catch (error) {
          showToast(error.message);
        } finally {
          button.disabled = false;
          button.textContent = "Save";
        }
      });
    });
  }

  function renderOrders() {
    const rows = filteredOrders();
    document.querySelector("[data-orders-table]").innerHTML = rows.length
      ? rows.map(orderRow).join("")
      : `<tr><td colspan="5">No orders match the current filters.</td></tr>`;
    bindOrderActions();
  }

  function renderMessages() {
    document.querySelector("[data-messages-table]").innerHTML = state.messages.length
      ? state.messages.map(messageRow).join("")
      : `<tr><td colspan="5">No messages yet.</td></tr>`;
    bindMessageActions();
  }

  async function loadDashboard() {
    const [summary, orders, messages] = await Promise.all([
      getAdminSummary(),
      getOrders(),
      getMessages()
    ]);

    state.orders = orders;
    state.messages = messages;
    renderMetrics(summary);

    const filter = document.querySelector("[data-order-filter]");
    const currentValue = filter.value || "all";
    filter.innerHTML = `
      <option value="all">All statuses</option>
      ${ORDER_STATUSES.map(
        (status) => `
          <option value="${escapeHtml(status)}" ${currentValue === status ? "selected" : ""}>
            ${escapeHtml(status)}
          </option>
        `
      ).join("")}
    `;

    renderOrders();
    renderMessages();
  }

  async function initAdminPage() {
    initNavigation();
    setText("[data-brand-name]", siteData.brand.name);
    setText("[data-brand-tagline]", siteData.brand.tagline);

    const loginForm = document.querySelector("[data-admin-login]");
    const loginPanel = document.querySelector("[data-login-panel]");
    const dashboard = document.querySelector("[data-admin-dashboard]");

    document.querySelector("[data-order-search]").addEventListener("input", renderOrders);
    document.querySelector("[data-order-filter]").addEventListener("change", renderOrders);

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const pin = loginForm.pin.value.trim();
      if (pin !== ADMIN_PIN) {
        showToast("Incorrect demo PIN. Use vanillabean2026.");
        return;
      }

      loginPanel.classList.add("hidden");
      dashboard.classList.remove("hidden");
      await loadDashboard();
      initReveal();
    });
  }

  initAdminPage().catch((error) => {
    console.error(error);
  });
})();
