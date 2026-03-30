(function () {
  const { fetchJson, isFileMode, normalizePhone } = window.TVBShared;
  const {
    menuData,
    seedCustomers = [],
    seedMessages = [],
    seedOrders = [],
    siteData
  } = window.TVBData;

  const ORDER_KEY = "tvb-orders";
  const MESSAGE_KEY = "tvb-messages";
  const CUSTOMER_KEY = "tvb-customers";
  const LAST_PHONE_KEY = "tvb-last-phone";

  const ORDER_STATUS_DETAILS = {
    "Order received": "Your request has been logged and will be reviewed by the bakery team.",
    "Baker reviewing": "The bakery is checking flavor, stock, and design details.",
    "In kitchen": "The order is now being baked and finished.",
    "Ready for pickup": "The order is packed and waiting at The Vanilla Bean.",
    "Out for delivery": "A delivery partner is on the way with the order.",
    Delivered: "The order has been delivered successfully.",
    Completed: "The celebration request has been closed successfully.",
    Cancelled: "The request has been cancelled."
  };

  const MESSAGE_STATUS_DETAILS = {
    new: "Awaiting response",
    reviewing: "The bakery team is reviewing the message",
    resolved: "The query has been resolved"
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sanitize(value) {
    return String(value || "").trim();
  }

  function flattenMenu(menuGroups) {
    return menuGroups.flatMap((group) =>
      group.items.map((item) => ({
        ...item,
        category: group.title,
        categorySlug: group.slug
      }))
    );
  }

  function safeStorageRead(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);

      if (!raw) {
        const initial = clone(fallback);
        window.localStorage.setItem(key, JSON.stringify(initial));
        return initial;
      }

      return JSON.parse(raw);
    } catch (error) {
      return clone(fallback);
    }
  }

  function safeStorageWrite(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(error);
    }
  }

  function rememberCustomerPhone(phone) {
    const normalized = normalizePhone(phone);
    if (normalized) {
      safeStorageWrite(LAST_PHONE_KEY, normalized);
    }
  }

  function getRememberedCustomerPhone() {
    return safeStorageRead(LAST_PHONE_KEY, "");
  }

  function localOrders() {
    return safeStorageRead(ORDER_KEY, seedOrders || []);
  }

  function localMessages() {
    return safeStorageRead(MESSAGE_KEY, seedMessages || []);
  }

  function localCustomers() {
    return safeStorageRead(CUSTOMER_KEY, seedCustomers || []);
  }

  function writeLocalOrders(orders) {
    safeStorageWrite(ORDER_KEY, orders);
  }

  function writeLocalMessages(messages) {
    safeStorageWrite(MESSAGE_KEY, messages);
  }

  function writeLocalCustomers(customers) {
    safeStorageWrite(CUSTOMER_KEY, customers);
  }

  function createTrackingId() {
    const now = new Date();
    const stamp = [
      String(now.getFullYear()).slice(-2),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("");
    const suffix = Math.floor(Math.random() * 9000 + 1000);
    return `TVB-${stamp}-${suffix}`;
  }

  function customCakeBase(size) {
    const prices = {
      "0.5 kg": 699,
      "1 kg": 1199,
      "1.5 kg": 1599,
      "2 kg": 1999
    };

    return prices[size] || 699;
  }

  function normalizeCustomCake(customCake) {
    const normalized = customCake || {};
    return {
      shape: sanitize(normalized.shape),
      size: sanitize(normalized.size),
      layers: sanitize(normalized.layers) || "1 layer",
      flavour: sanitize(normalized.flavour),
      cream: sanitize(normalized.cream),
      filling: sanitize(normalized.filling),
      frostingColor: sanitize(normalized.frostingColor),
      texture: sanitize(normalized.texture),
      topper: sanitize(normalized.topper),
      theme: sanitize(normalized.theme),
      dietary: sanitize(normalized.dietary),
      message: sanitize(normalized.message),
      photoReference: sanitize(normalized.photoReference),
      referenceImage: sanitize(normalized.referenceImage),
      toppings: Array.isArray(normalized.toppings)
        ? normalized.toppings.map(sanitize).filter(Boolean)
        : []
    };
  }

  function normalizeAddress(address) {
    const normalized = address || {};
    return {
      id: sanitize(normalized.id) || `addr-${Date.now()}`,
      label: sanitize(normalized.label) || "Saved address",
      recipient: sanitize(normalized.recipient),
      phone: normalizePhone(normalized.phone),
      addressLine: sanitize(normalized.addressLine || normalized.address),
      landmark: sanitize(normalized.landmark),
      isDefault: Boolean(normalized.isDefault)
    };
  }

  function normalizeDesign(design) {
    const normalized = normalizeCustomCake(design);
    return {
      ...normalized,
      id: sanitize(design?.id) || `design-${Date.now()}`,
      label:
        sanitize(design?.label) ||
        [normalized.theme, normalized.flavour, normalized.size].filter(Boolean).join(" | ") ||
        "Saved custom cake",
      createdAt: sanitize(design?.createdAt) || new Date().toISOString()
    };
  }

  function hasCustomCake(customCake) {
    const normalized = normalizeCustomCake(customCake);
    return Boolean(
      normalized.size ||
        normalized.flavour ||
        normalized.cream ||
        normalized.theme ||
        normalized.message ||
        normalized.photoReference ||
        normalized.referenceImage ||
        normalized.layers ||
        normalized.filling ||
        normalized.toppings.length
    );
  }

  function layersPrice(layers) {
    const map = {
      "1 layer": 0,
      "2 layer": 180,
      "3 layer": 360
    };

    return map[sanitize(layers)] || 0;
  }

  function fillingPrice(filling) {
    const premium = ["biscoff crunch", "nutella swirl", "blueberry compote"];
    return premium.includes(sanitize(filling).toLowerCase()) ? 110 : sanitize(filling) ? 70 : 0;
  }

  function texturePrice(texture) {
    return sanitize(texture).toLowerCase() === "floral piping" ? 120 : sanitize(texture) ? 60 : 0;
  }

  function topperPrice(topper) {
    return sanitize(topper) ? 90 : 0;
  }

  function dietaryPrice(dietary) {
    const normalized = sanitize(dietary).toLowerCase();
    if (normalized === "eggless") {
      return 80;
    }
    if (normalized === "sugar conscious") {
      return 120;
    }
    return 0;
  }

  function customCakeQuote(customCake) {
    if (!hasCustomCake(customCake)) {
      return 0;
    }

    const normalized = normalizeCustomCake(customCake);
    return (
      customCakeBase(normalized.size) +
      layersPrice(normalized.layers) +
      fillingPrice(normalized.filling) +
      texturePrice(normalized.texture) +
      topperPrice(normalized.topper) +
      dietaryPrice(normalized.dietary) +
      normalized.toppings.length * 40
    );
  }

  function deliveryFee(payload) {
    const method = sanitize(payload.fulfillmentMethod || "delivery").toLowerCase();
    const speed = sanitize(payload.deliverySpeed || "delivery").toLowerCase();
    const fees = siteData.checkout?.deliveryFees || {};

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

  function findCoupon(code) {
    const normalizedCode = sanitize(code).toUpperCase();
    return (siteData.checkout?.coupons || []).find(
      (coupon) => sanitize(coupon.code).toUpperCase() === normalizedCode
    );
  }

  function couponDiscount(code, subtotal, customCakeSelected) {
    const coupon = findCoupon(code);
    if (!coupon) {
      return {
        coupon: null,
        discount: 0
      };
    }

    if (Number(subtotal) < Number(coupon.minSubtotal || 0)) {
      throw new Error(`Coupon ${coupon.code} requires a subtotal of ${coupon.minSubtotal} or more.`);
    }

    if (sanitize(coupon.audience).toLowerCase() === "custom cake" && !customCakeSelected) {
      throw new Error(`Coupon ${coupon.code} is available only for custom cake orders.`);
    }

    let discount = 0;
    if (sanitize(coupon.type).toLowerCase() === "flat") {
      discount = Number(coupon.value || 0);
    } else {
      discount = Math.round((Number(subtotal || 0) * Number(coupon.value || 0)) / 100);
    }

    discount = Math.min(discount, Number(coupon.maxDiscount || discount));
    discount = Math.min(discount, Number(subtotal || 0));

    return {
      coupon,
      discount
    };
  }

  function orderTimeline(createdAt, status, note) {
    return [
      {
        label: status,
        detail: note || ORDER_STATUS_DETAILS[status] || "Status updated.",
        at: createdAt
      }
    ];
  }

  function appendTimeline(order, status, note) {
    const now = new Date().toISOString();
    const timeline = Array.isArray(order.timeline) ? clone(order.timeline) : [];
    timeline.unshift({
      label: status,
      detail: note || ORDER_STATUS_DETAILS[status] || "Status updated.",
      at: now
    });
    order.timeline = timeline;
    order.status = status;
    order.updatedAt = now;
    return order;
  }

  function createReferralCode(phone) {
    const normalized = normalizePhone(phone).replace(/^\+/, "");
    const suffix = normalized ? normalized.slice(-4) : `${Date.now()}`.slice(-4);
    return `VB${suffix}CIRCLE`;
  }

  function pointsForTotal(total) {
    const divisor = Number(siteData.membership?.pointsPerOrderRupees || 20);
    return Math.max(Math.floor(Number(total || 0) / divisor), Number(total || 0) > 0 ? 10 : 0);
  }

  function tierForPoints(points) {
    const tiers = clone(siteData.membership?.tiers || []).sort(
      (left, right) => Number(right.minPoints || 0) - Number(left.minPoints || 0)
    );

    return tiers.find((tier) => Number(points || 0) >= Number(tier.minPoints || 0)) || tiers[tiers.length - 1];
  }

  function defaultCustomerProfile(phone, seed) {
    const normalizedPhone = normalizePhone(phone);
    return {
      id: sanitize(seed?.id) || `cust-${normalizedPhone || Date.now()}`,
      phone: normalizedPhone,
      name: sanitize(seed?.name),
      email: sanitize(seed?.email),
      createdAt: sanitize(seed?.createdAt) || new Date().toISOString(),
      updatedAt: sanitize(seed?.updatedAt) || new Date().toISOString(),
      loyaltyPoints: Number(seed?.loyaltyPoints || 0),
      totalSpent: Number(seed?.totalSpent || 0),
      ordersCount: Number(seed?.ordersCount || 0),
      referralCode: sanitize(seed?.referralCode) || createReferralCode(normalizedPhone),
      preferredPaymentMethod: sanitize(seed?.preferredPaymentMethod),
      favoriteOccasion: sanitize(seed?.favoriteOccasion),
      addresses: Array.isArray(seed?.addresses) ? seed.addresses.map(normalizeAddress) : [],
      savedDesigns: Array.isArray(seed?.savedDesigns) ? seed.savedDesigns.map(normalizeDesign) : [],
      savedCoupons: Array.isArray(seed?.savedCoupons) ? clone(seed.savedCoupons) : [],
      member: seed?.member
        ? {
            active: Boolean(seed.member.active),
            joinedAt: sanitize(seed.member.joinedAt),
            welcomeGranted: Boolean(seed.member.welcomeGranted)
          }
        : {
            active: false,
            joinedAt: "",
            welcomeGranted: false
          }
    };
  }

  function hydrateCustomer(profile, orders) {
    const customerOrders = Array.isArray(orders) ? orders : [];
    const hydrated = defaultCustomerProfile(profile.phone, profile);
    const tier = tierForPoints(hydrated.loyaltyPoints);

    return {
      ...hydrated,
      tier,
      activeOrders: customerOrders.filter(
        (order) => !["Delivered", "Completed", "Cancelled"].includes(sanitize(order.status))
      )
    };
  }

  function findCustomerIndex(customers, phone) {
    const normalized = normalizePhone(phone);
    return customers.findIndex((customer) => normalizePhone(customer.phone) === normalized);
  }

  function upsertLocalCustomer(phone, seed, updater) {
    const customers = localCustomers();
    const normalizedPhone = normalizePhone(phone);
    const index = findCustomerIndex(customers, normalizedPhone);
    const current =
      index >= 0 ? defaultCustomerProfile(normalizedPhone, customers[index]) : defaultCustomerProfile(normalizedPhone, seed || {});
    const nextBase = {
      ...current,
      ...(seed || {}),
      phone: normalizedPhone,
      updatedAt: new Date().toISOString()
    };
    const next = defaultCustomerProfile(normalizedPhone, updater ? updater(nextBase) : nextBase);

    if (index >= 0) {
      customers[index] = next;
    } else {
      customers.unshift(next);
    }

    writeLocalCustomers(customers);
    rememberCustomerPhone(normalizedPhone);
    return next;
  }

  function findOrdersForPhone(orders, phone) {
    const normalized = normalizePhone(phone);
    return orders.filter((order) => normalizePhone(order.phone) === normalized);
  }

  function getCustomerDashboardFromLocal(phone) {
    const normalizedPhone = normalizePhone(phone || getRememberedCustomerPhone());
    if (!normalizedPhone) {
      throw new Error("Enter a phone number to load the dashboard.");
    }

    const orders = findOrdersForPhone(localOrders(), normalizedPhone);
    const customers = localCustomers();
    const index = findCustomerIndex(customers, normalizedPhone);
    const profile = hydrateCustomer(
      index >= 0 ? customers[index] : defaultCustomerProfile(normalizedPhone, {}),
      orders
    );

    return {
      phone: normalizedPhone,
      customer: profile,
      orders,
      totals: {
        orders: orders.length,
        spend: orders.reduce((sum, order) => sum + Number(order.total || 0), 0),
        savedDesigns: profile.savedDesigns.length,
        addresses: profile.addresses.length,
        loyaltyPoints: profile.loyaltyPoints
      }
    };
  }

  async function getOrders() {
    if (isFileMode()) {
      return localOrders();
    }

    return fetchJson("/api/orders");
  }

  async function getMessages() {
    if (isFileMode()) {
      return localMessages();
    }

    return fetchJson("/api/messages");
  }

  async function getOrderByTrackingId(trackingId) {
    if (isFileMode()) {
      const normalized = sanitize(trackingId).toUpperCase();
      const match = localOrders().find((entry) => entry.trackingId.toUpperCase() === normalized);

      if (!match) {
        throw new Error("No order found for that tracking ID.");
      }

      return match;
    }

    return fetchJson(`/api/orders/${trackingId}`);
  }

  async function getCustomerDashboard(phone) {
    if (isFileMode()) {
      return getCustomerDashboardFromLocal(phone);
    }

    const normalizedPhone = normalizePhone(phone || getRememberedCustomerPhone());
    if (!normalizedPhone) {
      throw new Error("Enter a phone number to load the dashboard.");
    }

    const response = await fetchJson(`/api/customers/${encodeURIComponent(normalizedPhone)}`);
    rememberCustomerPhone(normalizedPhone);
    return response;
  }

  async function saveAddress(phone, address) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      throw new Error("Enter a phone number before saving an address.");
    }

    if (!isFileMode()) {
      const response = await fetchJson("/api/customers/address", {
        method: "POST",
        body: JSON.stringify({
          phone: normalizedPhone,
          address
        })
      });
      rememberCustomerPhone(normalizedPhone);
      return response;
    }

    const normalizedAddress = normalizeAddress(address);
    if (!normalizedAddress.addressLine) {
      throw new Error("Please provide the address details.");
    }

    const customer = upsertLocalCustomer(normalizedPhone, {}, (current) => {
      const addresses = Array.isArray(current.addresses) ? clone(current.addresses) : [];
      const existingIndex = addresses.findIndex((entry) => entry.id === normalizedAddress.id);

      if (normalizedAddress.isDefault) {
        addresses.forEach((entry) => {
          entry.isDefault = false;
        });
      }

      if (existingIndex >= 0) {
        addresses[existingIndex] = normalizedAddress;
      } else {
        addresses.unshift(normalizedAddress);
      }

      return {
        ...current,
        addresses
      };
    });

    return {
      message: "Address saved successfully.",
      customer,
      address: normalizedAddress
    };
  }

  async function saveDesign(phone, design) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      throw new Error("Enter a phone number before saving a design.");
    }

    const normalizedDesign = normalizeDesign(design);
    if (!normalizedDesign.flavour || !normalizedDesign.size) {
      throw new Error("Choose the cake size and flavour before saving the design.");
    }

    if (!isFileMode()) {
      const response = await fetchJson("/api/customers/designs", {
        method: "POST",
        body: JSON.stringify({
          phone: normalizedPhone,
          design: normalizedDesign
        })
      });
      rememberCustomerPhone(normalizedPhone);
      return response;
    }

    const customer = upsertLocalCustomer(normalizedPhone, {}, (current) => {
      const savedDesigns = Array.isArray(current.savedDesigns) ? clone(current.savedDesigns) : [];
      const existingIndex = savedDesigns.findIndex((entry) => entry.id === normalizedDesign.id);
      if (existingIndex >= 0) {
        savedDesigns[existingIndex] = normalizedDesign;
      } else {
        savedDesigns.unshift(normalizedDesign);
      }

      return {
        ...current,
        savedDesigns
      };
    });

    return {
      message: "Design saved to your dashboard.",
      customer,
      design: normalizedDesign
    };
  }

  async function joinMembership(payload) {
    const phone = normalizePhone(payload.phone);
    const name = sanitize(payload.name);

    if (!phone || !name) {
      throw new Error("Please provide your name and phone number to join Vanilla Circle.");
    }

    if (!isFileMode()) {
      const response = await fetchJson("/api/membership/join", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      rememberCustomerPhone(phone);
      return response;
    }

    let welcomeAward = 0;
    const customer = upsertLocalCustomer(phone, payload, (current) => {
      const next = {
        ...current,
        name,
        email: sanitize(payload.email) || current.email,
        member: {
          active: true,
          joinedAt: current.member?.joinedAt || new Date().toISOString(),
          welcomeGranted: Boolean(current.member?.welcomeGranted)
        }
      };

      if (!next.member.welcomeGranted) {
        welcomeAward = Number(siteData.membership?.welcomePoints || 0);
        next.loyaltyPoints = Number(next.loyaltyPoints || 0) + welcomeAward;
        next.member.welcomeGranted = true;
        next.savedCoupons = [
          {
            code: "CIRCLE50",
            title: "Welcome to Vanilla Circle",
            description: "Flat Rs. 50 off on your next celebration order above Rs. 699."
          },
          ...(Array.isArray(next.savedCoupons) ? next.savedCoupons : [])
        ];
      }

      return next;
    });

    return {
      message: welcomeAward
        ? "Membership activated. Welcome points added to your account."
        : "Membership details updated successfully.",
      customer: hydrateCustomer(customer, findOrdersForPhone(localOrders(), phone)),
      welcomeAward
    };
  }

  async function createOrder(payload) {
    if (!isFileMode()) {
      const response = await fetchJson("/api/orders", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      rememberCustomerPhone(payload.phone);
      return response;
    }

    const customerName = sanitize(payload.customerName);
    const phone = normalizePhone(payload.phone);
    const deliveryDate = sanitize(payload.deliveryDate);

    if (!customerName || !phone || !deliveryDate) {
      throw new Error("Please provide your name, phone number, and delivery date.");
    }

    const menuItems = flattenMenu(menuData);
    const selectedItem = menuItems.find((item) => item.id === sanitize(payload.itemId)) || null;
    const normalizedCustomCake = normalizeCustomCake(payload.customCake);
    const customCakeSelected = Boolean(payload.includeCustomCake) && hasCustomCake(normalizedCustomCake);

    if (!selectedItem && !customCakeSelected) {
      throw new Error("Please choose a menu item or configure a custom cake.");
    }

    const quantity = Math.max(Number(payload.quantity || 1), 1);
    const itemSubtotal = Number(selectedItem?.price || 0) * quantity;
    const customSubtotal = customCakeSelected ? customCakeQuote(normalizedCustomCake) : 0;
    const subtotal = itemSubtotal + customSubtotal;
    const shipping = deliveryFee(payload);
    const couponMeta = couponDiscount(payload.couponCode, subtotal, customCakeSelected);
    const discount = couponMeta.discount;
    const total = Math.max(subtotal + shipping - discount, 0);
    const pointsEarned = pointsForTotal(total);
    const trackingId = createTrackingId();
    const createdAt = new Date().toISOString();

    const paymentMethod = sanitize(payload.paymentMethod) || "upi";
    const paymentStatus = ["upi", "paytm"].includes(paymentMethod)
      ? "Awaiting UPI payment"
      : "Pending confirmation";

    const order = {
      id: trackingId,
      trackingId,
      customerName,
      phone,
      email: sanitize(payload.email),
      occasion: sanitize(payload.occasion) || "General",
      deliveryDate,
      timeSlot: sanitize(payload.timeSlot) || "Flexible",
      fulfillmentMethod: sanitize(payload.fulfillmentMethod) || "delivery",
      deliverySpeed: sanitize(payload.deliverySpeed) || "delivery",
      address: sanitize(payload.address),
      addressLabel: sanitize(payload.addressLabel),
      notes: sanitize(payload.notes),
      quantity,
      selectedItem,
      customCake: customCakeSelected ? normalizedCustomCake : null,
      paymentMethod,
      paymentStatus,
      couponCode: sanitize(payload.couponCode).toUpperCase(),
      coupon: couponMeta.coupon,
      pricing: {
        itemSubtotal,
        customSubtotal,
        subtotal,
        deliveryFee: shipping,
        discount,
        total
      },
      total,
      pointsEarned,
      status: "Order received",
      createdAt,
      timeline: orderTimeline(createdAt, "Order received")
    };

    const orders = localOrders();
    orders.unshift(order);
    writeLocalOrders(orders);

    const savedAddress =
      Boolean(payload.saveAddress) &&
      order.fulfillmentMethod === "delivery" &&
      sanitize(order.address)
        ? {
            label: sanitize(payload.addressLabel) || "Primary celebration address",
            recipient: customerName,
            phone,
            addressLine: sanitize(order.address),
            landmark: sanitize(payload.landmark),
            isDefault: true
          }
        : null;

    const designToSave =
      customCakeSelected && payload.saveDesignOnCheckout
        ? {
            ...normalizedCustomCake,
            id: sanitize(payload.savedDesignId),
            label: sanitize(payload.designLabel) || `${order.occasion} custom cake`,
            createdAt
          }
        : null;

    const customer = upsertLocalCustomer(phone, {
      name: customerName,
      email: sanitize(payload.email),
      preferredPaymentMethod: paymentMethod
    }, (current) => {
      const next = {
        ...current,
        name: customerName || current.name,
        email: sanitize(payload.email) || current.email,
        preferredPaymentMethod: paymentMethod || current.preferredPaymentMethod,
        totalSpent: Number(current.totalSpent || 0) + total,
        ordersCount: Number(current.ordersCount || 0) + 1,
        loyaltyPoints: Number(current.loyaltyPoints || 0) + pointsEarned,
        favoriteOccasion: sanitize(payload.occasion) || current.favoriteOccasion
      };

      if (savedAddress) {
        const addresses = Array.isArray(next.addresses) ? clone(next.addresses) : [];
        addresses.forEach((entry) => {
          entry.isDefault = false;
        });
        addresses.unshift(normalizeAddress(savedAddress));
        next.addresses = addresses;
      }

      if (designToSave) {
        const savedDesigns = Array.isArray(next.savedDesigns) ? clone(next.savedDesigns) : [];
        savedDesigns.unshift(normalizeDesign(designToSave));
        next.savedDesigns = savedDesigns;
      }

      if (couponMeta.coupon) {
        next.savedCoupons = (Array.isArray(next.savedCoupons) ? clone(next.savedCoupons) : []).filter(
          (entry) => sanitize(entry.code).toUpperCase() !== sanitize(couponMeta.coupon.code).toUpperCase()
        );
      }

      return next;
    });

    return {
      message: "Order request created successfully.",
      trackingId,
      order,
      pointsEarned,
      customer: hydrateCustomer(customer, findOrdersForPhone(localOrders(), phone))
    };
  }

  async function createMessage(payload) {
    if (!isFileMode()) {
      return fetchJson("/api/contact", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    const customerName = sanitize(payload.customerName);
    const phone = normalizePhone(payload.phone);
    const email = sanitize(payload.email);
    const message = sanitize(payload.message);

    if (!customerName || (!phone && !email) || !message) {
      throw new Error("Please provide your name, one contact method, and your message.");
    }

    const entry = {
      id: `msg-${Date.now()}`,
      customerName,
      phone,
      email,
      subject: sanitize(payload.subject) || "General enquiry",
      message,
      status: "new",
      statusLabel: MESSAGE_STATUS_DETAILS.new,
      createdAt: new Date().toISOString()
    };

    const messages = localMessages();
    messages.unshift(entry);
    writeLocalMessages(messages);

    return {
      message: "Message received successfully.",
      entry
    };
  }

  async function updateOrderStatus(trackingId, status, note) {
    if (!isFileMode()) {
      return fetchJson(`/api/admin/orders/${encodeURIComponent(trackingId)}/status`, {
        method: "POST",
        body: JSON.stringify({
          status,
          note
        })
      });
    }

    const orders = localOrders();
    const index = orders.findIndex(
      (entry) => sanitize(entry.trackingId).toUpperCase() === sanitize(trackingId).toUpperCase()
    );
    if (index < 0) {
      throw new Error("Order not found.");
    }

    orders[index] = appendTimeline(orders[index], sanitize(status), sanitize(note));
    writeLocalOrders(orders);

    return {
      message: "Order status updated successfully.",
      order: orders[index]
    };
  }

  async function updateMessageStatus(messageId, status) {
    if (!isFileMode()) {
      return fetchJson(`/api/admin/messages/${encodeURIComponent(messageId)}/status`, {
        method: "POST",
        body: JSON.stringify({
          status
        })
      });
    }

    const messages = localMessages();
    const index = messages.findIndex((entry) => sanitize(entry.id) === sanitize(messageId));
    if (index < 0) {
      throw new Error("Message not found.");
    }

    messages[index] = {
      ...messages[index],
      status: sanitize(status) || "new",
      statusLabel: MESSAGE_STATUS_DETAILS[sanitize(status)] || MESSAGE_STATUS_DETAILS.new,
      updatedAt: new Date().toISOString()
    };
    writeLocalMessages(messages);

    return {
      message: "Message status updated successfully.",
      entry: messages[index]
    };
  }

  async function getAdminSummary() {
    if (!isFileMode()) {
      return fetchJson("/api/admin/summary");
    }

    const orders = localOrders();
    const messages = localMessages();
    const customers = localCustomers();
    const revenue = orders.reduce((sum, entry) => sum + Number(entry.total || 0), 0);
    const cakeOrders = orders.filter(
      (entry) => entry.selectedItem?.categorySlug === "cakes" || entry.customCake
    ).length;
    const pendingOrders = orders.filter(
      (entry) => !["Delivered", "Completed", "Cancelled"].includes(sanitize(entry.status))
    ).length;
    const savedDesigns = customers.reduce(
      (sum, customer) => sum + Number(customer.savedDesigns?.length || 0),
      0
    );
    const activeMembers = customers.filter((customer) => Boolean(customer.member?.active)).length;
    const statusCounts = orders.reduce((counts, entry) => {
      const key = sanitize(entry.status) || "Unknown";
      counts[key] = Number(counts[key] || 0) + 1;
      return counts;
    }, {});

    return {
      totals: {
        orders: orders.length,
        messages: messages.length,
        revenue,
        cakeOrders,
        pendingOrders,
        activeMembers,
        savedDesigns
      },
      latestOrders: orders.slice(0, 5),
      latestMessages: messages.slice(0, 5),
      statusCounts
    };
  }

  window.TVBStore = {
    createMessage,
    createOrder,
    getAdminSummary,
    getCustomerDashboard,
    getMessages,
    getOrderByTrackingId,
    getOrders,
    getRememberedCustomerPhone,
    joinMembership,
    saveAddress,
    saveDesign,
    updateMessageStatus,
    updateOrderStatus
  };
})();
