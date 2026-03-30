(function () {
  const KNOWN_ROUTES = [
    "about",
    "menu",
    "gallery",
    "order",
    "track",
    "contact",
    "admin",
    "dashboard",
    "reviews",
    "blog",
    "offers"
  ];

  async function fetchJson(url, options = {}) {
    if (window.location.protocol === "file:" && url.startsWith("/api/")) {
      throw new Error(
        "This action needs the local server. Run start.command and open http://localhost:3000."
      );
    }

    const requestOptions = {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    };

    let response;
    try {
      response = await fetch(url, requestOptions);
    } catch (error) {
      throw new Error(
        "Unable to reach the local server. Start the website server and try again."
      );
    }

    const text = await response.text();
    let data = {};
    const contentType = response.headers.get("Content-Type") || "";
    const looksLikeHtml = /^\s*</.test(text);

    if (text) {
      try {
        data = JSON.parse(text);
      } catch (error) {
        if (looksLikeHtml || contentType.includes("text/html")) {
          throw new Error(
            "The local server returned a page instead of API data. Refresh the site or restart the server and try again."
          );
        }
        if (!response.ok) {
          throw new Error(
            "The local server returned an invalid response. Restart the server and try again."
          );
        }
        throw new Error("The website received an invalid server response.");
      }
    }

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong.");
    }

    return data;
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(Number(amount || 0));
  }

  function formatDate(value, options) {
    if (!value) {
      return "Not set";
    }

    return new Date(value).toLocaleDateString(
      "en-IN",
      options || {
        day: "numeric",
        month: "short",
        year: "numeric"
      }
    );
  }

  function formatDateTime(value, options) {
    if (!value) {
      return "Not set";
    }

    return new Date(value).toLocaleString(
      "en-IN",
      options || {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      }
    );
  }

  function isFileMode() {
    return window.location.protocol === "file:";
  }

  function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent || "");
  }

  function assetUrl(path) {
    if (!path || !path.startsWith("/") || !isFileMode()) {
      return path;
    }

    const root = document.documentElement.dataset.siteRoot || ".";
    return `${root}${path}`;
  }

  function routeUrl(route) {
    if (!route || !route.startsWith("/") || !isFileMode()) {
      return route;
    }

    const root = document.documentElement.dataset.siteRoot || ".";
    const [pathOnly, queryString] = route.split("?");
    const normalizedPath = pathOnly.replace(/\/$/, "") || "/";
    const fileTarget =
      normalizedPath === "/"
        ? "index.html"
        : `${normalizedPath.replace(/^\//, "")}/index.html`;
    const resolved = `${root}/${fileTarget}`.replace(/\/{2,}/g, "/");

    return queryString ? `${resolved}?${queryString}` : resolved;
  }

  function currentRoute() {
    if (!isFileMode()) {
      return window.location.pathname.replace(/\/$/, "") || "/";
    }

    const parts = window.location.pathname.split("/").filter(Boolean);
    const route = parts.length >= 2 ? parts[parts.length - 2] : "";
    return KNOWN_ROUTES.includes(route) ? `/${route}` : "/";
  }

  function routeFromHref(href) {
    if (!href) {
      return "";
    }

    const clean = href.split("?")[0].replace(/index\.html$/, "").replace(/\/$/, "");
    if (clean === "" || clean === "." || clean === "..") {
      return "/";
    }

    const match = clean.match(
      /(?:^|\/)(about|menu|gallery|order|track|contact|admin|dashboard|reviews|blog|offers)$/
    );
    return match ? `/${match[1]}` : "/";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizePhone(value) {
    return String(value || "").replace(/[^\d+]/g, "");
  }

  function initNavigation() {
    const nav = document.querySelector("[data-site-nav]");
    const toggle = document.querySelector("[data-nav-toggle]");
    const header = document.querySelector(".site-header");
    const currentPath = currentRoute();

    if (toggle && nav) {
      toggle.addEventListener("click", () => {
        nav.classList.toggle("is-open");
      });
    }

    document.querySelectorAll("a[href^='/']").forEach((link) => {
      link.href = routeUrl(link.getAttribute("href"));
    });

    document.querySelectorAll("[data-nav-link]").forEach((link) => {
      const href = link.getAttribute("href");
      const normalized = routeFromHref(href);

      if (normalized === currentPath) {
        link.classList.add("is-active");
      }

      link.addEventListener("click", () => {
        if (nav) {
          nav.classList.remove("is-open");
        }
      });
    });

    document.querySelectorAll("[data-year]").forEach((node) => {
      node.textContent = new Date().getFullYear();
    });

    const footerNote = document.querySelector(".footer-note");
    if (footerNote && currentPath !== "/admin" && !footerNote.querySelector("[data-admin-footer-link]")) {
      const adminLink = document.createElement("a");
      adminLink.href = routeUrl("/admin");
      adminLink.textContent = "Bakery admin";
      adminLink.title = "Bakery admin access";
      adminLink.setAttribute("data-admin-footer-link", "");
      adminLink.className = "footer-admin-link";
      footerNote.appendChild(adminLink);
    }

    const onScroll = () => {
      if (header) {
        header.classList.toggle("is-scrolled", window.scrollY > 10);
      }
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function initReveal() {
    const nodes = document.querySelectorAll("[data-reveal]");

    if (!("IntersectionObserver" in window) || nodes.length === 0) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12
      }
    );

    nodes.forEach((node) => observer.observe(node));
  }

  function showToast(message) {
    let toast = document.querySelector("[data-toast]");

    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      toast.setAttribute("data-toast", "");
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("is-visible");

    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 3200);
  }

  function createUpiLink(config = {}) {
    const params = new URLSearchParams();
    if (config.vpa) {
      params.set("pa", config.vpa);
    }
    if (config.payeeName) {
      params.set("pn", config.payeeName);
    }
    if (config.amount) {
      params.set("am", Number(config.amount || 0).toFixed(2));
    }
    params.set("cu", "INR");
    if (config.note) {
      params.set("tn", config.note);
    }
    if (config.transactionId) {
      params.set("tr", config.transactionId);
    }
    return `upi://pay?${params.toString()}`;
  }

  function initCountdown(target, container) {
    if (!container || !target) {
      return;
    }

    const cells = {
      days: container.querySelector("[data-countdown-days]"),
      hours: container.querySelector("[data-countdown-hours]"),
      minutes: container.querySelector("[data-countdown-minutes]"),
      seconds: container.querySelector("[data-countdown-seconds]")
    };

    const update = () => {
      const remaining = new Date(target).getTime() - Date.now();
      const safeRemaining = Math.max(remaining, 0);
      const days = Math.floor(safeRemaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((safeRemaining / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((safeRemaining / (1000 * 60)) % 60);
      const seconds = Math.floor((safeRemaining / 1000) % 60);

      cells.days.textContent = String(days).padStart(2, "0");
      cells.hours.textContent = String(hours).padStart(2, "0");
      cells.minutes.textContent = String(minutes).padStart(2, "0");
      cells.seconds.textContent = String(seconds).padStart(2, "0");
    };

    update();
    window.setInterval(update, 1000);
  }

  function byId(collection) {
    return new Map(collection.map((item) => [item.id, item]));
  }

  function queryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach((node) => {
      node.textContent = value;
    });
  }

  window.TVBShared = {
    assetUrl,
    byId,
    createUpiLink,
    escapeHtml,
    fetchJson,
    formatDate,
    formatDateTime,
    formatCurrency,
    initCountdown,
    initNavigation,
    initReveal,
    isFileMode,
    isMobileDevice,
    normalizePhone,
    queryParam,
    routeUrl,
    setText,
    showToast
  };
})();
