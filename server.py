import json
import mimetypes
import os
import random
import re
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
PORT = int(os.environ.get("PORT", "3000"))

PAGE_ROUTES = {
    "/": ROOT_DIR / "index.html",
    "/about": ROOT_DIR / "about" / "index.html",
    "/about/": ROOT_DIR / "about" / "index.html",
    "/menu": ROOT_DIR / "menu" / "index.html",
    "/menu/": ROOT_DIR / "menu" / "index.html",
    "/gallery": ROOT_DIR / "gallery" / "index.html",
    "/gallery/": ROOT_DIR / "gallery" / "index.html",
    "/order": ROOT_DIR / "order" / "index.html",
    "/order/": ROOT_DIR / "order" / "index.html",
    "/track": ROOT_DIR / "track" / "index.html",
    "/track/": ROOT_DIR / "track" / "index.html",
    "/contact": ROOT_DIR / "contact" / "index.html",
    "/contact/": ROOT_DIR / "contact" / "index.html",
    "/admin": ROOT_DIR / "admin" / "index.html",
    "/admin/": ROOT_DIR / "admin" / "index.html",
    "/dashboard": ROOT_DIR / "dashboard" / "index.html",
    "/dashboard/": ROOT_DIR / "dashboard" / "index.html",
    "/reviews": ROOT_DIR / "reviews" / "index.html",
    "/reviews/": ROOT_DIR / "reviews" / "index.html",
    "/blog": ROOT_DIR / "blog" / "index.html",
    "/blog/": ROOT_DIR / "blog" / "index.html",
    "/offers": ROOT_DIR / "offers" / "index.html",
    "/offers/": ROOT_DIR / "offers" / "index.html",
    "/robots.txt": ROOT_DIR / "robots.txt",
    "/sitemap.xml": ROOT_DIR / "sitemap.xml",
}

ORDER_STATUS_DETAILS = {
    "Order received": "Your request has been logged and will be reviewed by the bakery team.",
    "Baker reviewing": "The bakery is checking flavor, stock, and design details.",
    "In kitchen": "The order is now being baked and finished.",
    "Ready for pickup": "The order is packed and waiting at The Vanilla Bean.",
    "Out for delivery": "A delivery partner is on the way with the order.",
    "Delivered": "The order has been delivered successfully.",
    "Completed": "The celebration request has been closed successfully.",
    "Cancelled": "The request has been cancelled.",
}

MESSAGE_STATUS_DETAILS = {
    "new": "Awaiting response",
    "reviewing": "The bakery team is reviewing the message",
    "resolved": "The query has been resolved",
}


def resolve_page_route(request_path):
    page = PAGE_ROUTES.get(request_path)
    if page:
        return page

    if request_path == "/index.html":
        return PAGE_ROUTES.get("/")

    if request_path.endswith("/index.html"):
        normalized = request_path[: -len("index.html")]
        return PAGE_ROUTES.get(normalized)

    return None


def read_json(file_name):
    return json.loads((DATA_DIR / file_name).read_text(encoding="utf-8"))


def write_json(file_name, data):
    (DATA_DIR / file_name).write_text(
        json.dumps(data, indent=2) + "\n",
        encoding="utf-8",
    )


def sanitize(value):
    return str(value or "").strip()


def normalize_phone(value):
    return re.sub(r"[^\d+]", "", sanitize(value))


def flatten_menu(menu_groups):
    items = []
    for group in menu_groups:
        for item in group["items"]:
            enriched = dict(item)
            enriched["category"] = group["title"]
            enriched["categorySlug"] = group["slug"]
            items.append(enriched)
    return items


def create_tracking_id():
    stamp = datetime.now().strftime("%y%m%d")
    return f"TVB-{stamp}-{random.randint(1000, 9999)}"


def custom_cake_base(size):
    return {
        "0.5 kg": 699,
        "1 kg": 1199,
        "1.5 kg": 1599,
        "2 kg": 1999,
    }.get(size, 699)


def normalize_custom_cake(custom_cake):
    custom_cake = custom_cake or {}
    return {
        "shape": sanitize(custom_cake.get("shape")),
        "size": sanitize(custom_cake.get("size")),
        "layers": sanitize(custom_cake.get("layers")) or "1 layer",
        "flavour": sanitize(custom_cake.get("flavour")),
        "cream": sanitize(custom_cake.get("cream")),
        "filling": sanitize(custom_cake.get("filling")),
        "frostingColor": sanitize(custom_cake.get("frostingColor")),
        "texture": sanitize(custom_cake.get("texture")),
        "topper": sanitize(custom_cake.get("topper")),
        "theme": sanitize(custom_cake.get("theme")),
        "dietary": sanitize(custom_cake.get("dietary")),
        "message": sanitize(custom_cake.get("message")),
        "photoReference": sanitize(custom_cake.get("photoReference")),
        "referenceImage": sanitize(custom_cake.get("referenceImage")),
        "toppings": [
            sanitize(entry)
            for entry in (custom_cake.get("toppings") or [])
            if sanitize(entry)
        ],
    }


def normalize_address(address):
    address = address or {}
    return {
        "id": sanitize(address.get("id")) or f"addr-{int(datetime.now().timestamp() * 1000)}",
        "label": sanitize(address.get("label")) or "Saved address",
        "recipient": sanitize(address.get("recipient")),
        "phone": normalize_phone(address.get("phone")),
        "addressLine": sanitize(address.get("addressLine") or address.get("address")),
        "landmark": sanitize(address.get("landmark")),
        "isDefault": bool(address.get("isDefault")),
    }


def normalize_design(design):
    design = design or {}
    normalized = normalize_custom_cake(design)
    normalized.update(
        {
            "id": sanitize(design.get("id")) or f"design-{int(datetime.now().timestamp() * 1000)}",
            "label": sanitize(design.get("label"))
            or " | ".join(
                value for value in [normalized["theme"], normalized["flavour"], normalized["size"]] if value
            )
            or "Saved custom cake",
            "createdAt": sanitize(design.get("createdAt")) or datetime.now().isoformat(),
        }
    )
    return normalized


def has_custom_cake(custom_cake):
    normalized = normalize_custom_cake(custom_cake)
    return bool(
        normalized["size"]
        or normalized["flavour"]
        or normalized["cream"]
        or normalized["theme"]
        or normalized["message"]
        or normalized["photoReference"]
        or normalized["referenceImage"]
        or normalized["layers"]
        or normalized["filling"]
        or normalized["toppings"]
    )


def layers_price(layers):
    return {
        "1 layer": 0,
        "2 layer": 180,
        "3 layer": 360,
    }.get(sanitize(layers), 0)


def filling_price(filling):
    normalized = sanitize(filling).lower()
    premium = {"biscoff crunch", "nutella swirl", "blueberry compote"}
    if normalized in premium:
        return 110
    return 70 if normalized else 0


def texture_price(texture):
    normalized = sanitize(texture).lower()
    if normalized == "floral piping":
        return 120
    return 60 if normalized else 0


def topper_price(topper):
    return 90 if sanitize(topper) else 0


def dietary_price(dietary):
    normalized = sanitize(dietary).lower()
    if normalized == "eggless":
        return 80
    if normalized == "sugar conscious":
        return 120
    return 0


def custom_cake_quote(custom_cake):
    if not has_custom_cake(custom_cake):
        return 0

    normalized = normalize_custom_cake(custom_cake)
    return (
        custom_cake_base(normalized["size"])
        + layers_price(normalized["layers"])
        + filling_price(normalized["filling"])
        + texture_price(normalized["texture"])
        + topper_price(normalized["topper"])
        + dietary_price(normalized["dietary"])
        + len(normalized["toppings"]) * 40
    )


def delivery_fee(site, payload):
    method = sanitize(payload.get("fulfillmentMethod") or "delivery").lower()
    speed = sanitize(payload.get("deliverySpeed") or "delivery").lower()
    fees = (site.get("checkout") or {}).get("deliveryFees") or {}

    if method == "pickup":
        return int(fees.get("pickup") or 0)
    if speed == "express":
        return int(fees.get("express") or fees.get("delivery") or 0)
    if speed == "midnight":
        return int(fees.get("midnight") or fees.get("delivery") or 0)
    return int(fees.get("delivery") or 0)


def find_coupon(site, code):
    normalized = sanitize(code).upper()
    if not normalized:
        return None

    for coupon in (site.get("checkout") or {}).get("coupons") or []:
        if sanitize(coupon.get("code")).upper() == normalized:
            return coupon
    return None


def coupon_discount(site, code, subtotal, custom_cake_selected):
    coupon = find_coupon(site, code)
    if not coupon:
        return None, 0

    if subtotal < int(coupon.get("minSubtotal") or 0):
        raise ValueError(
            f"Coupon {coupon.get('code')} requires a subtotal of {coupon.get('minSubtotal')} or more."
        )

    audience = sanitize(coupon.get("audience")).lower()
    if audience == "custom cake" and not custom_cake_selected:
        raise ValueError(f"Coupon {coupon.get('code')} is available only for custom cake orders.")

    if sanitize(coupon.get("type")).lower() == "flat":
        discount = int(coupon.get("value") or 0)
    else:
        discount = round(subtotal * int(coupon.get("value") or 0) / 100)

    discount = min(discount, int(coupon.get("maxDiscount") or discount), subtotal)
    return coupon, discount


def points_for_total(site, total):
    divisor = int((site.get("membership") or {}).get("pointsPerOrderRupees") or 20)
    return max(total // divisor, 10 if total > 0 else 0)


def create_referral_code(phone):
    normalized = normalize_phone(phone).replace("+", "")
    suffix = normalized[-4:] if normalized else str(int(datetime.now().timestamp()))[-4:]
    return f"VB{suffix}CIRCLE"


def tier_for_points(site, points):
    tiers = sorted(
        (site.get("membership") or {}).get("tiers") or [],
        key=lambda entry: int(entry.get("minPoints") or 0),
        reverse=True,
    )
    for tier in tiers:
        if int(points or 0) >= int(tier.get("minPoints") or 0):
            return tier
    return tiers[-1] if tiers else {"name": "Classic", "minPoints": 0, "perks": []}


def default_customer_profile(phone, seed=None):
    seed = seed or {}
    normalized_phone = normalize_phone(phone)
    member = seed.get("member") or {}
    return {
        "id": sanitize(seed.get("id")) or f"cust-{normalized_phone or int(datetime.now().timestamp())}",
        "phone": normalized_phone,
        "name": sanitize(seed.get("name")),
        "email": sanitize(seed.get("email")),
        "createdAt": sanitize(seed.get("createdAt")) or datetime.now().isoformat(),
        "updatedAt": sanitize(seed.get("updatedAt")) or datetime.now().isoformat(),
        "loyaltyPoints": int(seed.get("loyaltyPoints") or 0),
        "totalSpent": int(seed.get("totalSpent") or 0),
        "ordersCount": int(seed.get("ordersCount") or 0),
        "referralCode": sanitize(seed.get("referralCode")) or create_referral_code(normalized_phone),
        "preferredPaymentMethod": sanitize(seed.get("preferredPaymentMethod")),
        "favoriteOccasion": sanitize(seed.get("favoriteOccasion")),
        "addresses": [normalize_address(address) for address in (seed.get("addresses") or [])],
        "savedDesigns": [normalize_design(design) for design in (seed.get("savedDesigns") or [])],
        "savedCoupons": list(seed.get("savedCoupons") or []),
        "member": {
            "active": bool(member.get("active")),
            "joinedAt": sanitize(member.get("joinedAt")),
            "welcomeGranted": bool(member.get("welcomeGranted")),
        },
    }


def hydrate_customer(site, profile, orders):
    hydrated = default_customer_profile(profile.get("phone"), profile)
    active_orders = [
        order
        for order in orders
        if sanitize(order.get("status")) not in {"Delivered", "Completed", "Cancelled"}
    ]
    hydrated["tier"] = tier_for_points(site, hydrated.get("loyaltyPoints"))
    hydrated["activeOrders"] = active_orders
    return hydrated


def find_customer_index(customers, phone):
    normalized = normalize_phone(phone)
    for index, customer in enumerate(customers):
        if normalize_phone(customer.get("phone")) == normalized:
            return index
    return -1


def upsert_customer(customers, phone, seed=None, mutate=None):
    normalized_phone = normalize_phone(phone)
    index = find_customer_index(customers, normalized_phone)
    current = (
        default_customer_profile(normalized_phone, customers[index])
        if index >= 0
        else default_customer_profile(normalized_phone, seed or {})
    )
    base = {
        **current,
        **(seed or {}),
        "phone": normalized_phone,
        "updatedAt": datetime.now().isoformat(),
    }
    next_profile = mutate(base) if mutate else base
    next_profile = default_customer_profile(normalized_phone, next_profile)

    if index >= 0:
        customers[index] = next_profile
    else:
        customers.insert(0, next_profile)

    return next_profile


def find_orders_for_phone(orders, phone):
    normalized = normalize_phone(phone)
    return [order for order in orders if normalize_phone(order.get("phone")) == normalized]


def dashboard_for_phone(phone):
    site = read_json("site.json")
    orders = read_json("orders.json")
    customers = read_json("customers.json")
    normalized_phone = normalize_phone(phone)
    customer_orders = find_orders_for_phone(orders, normalized_phone)
    index = find_customer_index(customers, normalized_phone)
    profile = (
        customers[index]
        if index >= 0
        else default_customer_profile(normalized_phone, {})
    )
    customer = hydrate_customer(site, profile, customer_orders)
    return {
        "phone": normalized_phone,
        "customer": customer,
        "orders": customer_orders,
        "totals": {
            "orders": len(customer_orders),
            "spend": sum(int(order.get("total") or 0) for order in customer_orders),
            "savedDesigns": len(customer.get("savedDesigns") or []),
            "addresses": len(customer.get("addresses") or []),
            "loyaltyPoints": int(customer.get("loyaltyPoints") or 0),
        },
    }


def append_timeline(order, status, note=""):
    now = datetime.now().isoformat()
    timeline = list(order.get("timeline") or [])
    timeline.insert(
        0,
        {
            "label": status,
            "detail": note or ORDER_STATUS_DETAILS.get(status) or "Status updated.",
            "at": now,
        },
    )
    order["timeline"] = timeline
    order["status"] = status
    order["updatedAt"] = now
    return order


class VanillaBeanHandler(BaseHTTPRequestHandler):
    server_version = "VanillaBeanHTTP/2.0"

    def _send(self, status, payload, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self._send(status, body, "application/json; charset=utf-8")

    def send_text(self, status, text):
        self._send(status, text.encode("utf-8"), "text/plain; charset=utf-8")

    def read_body(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(content_length) if content_length else b"{}"
        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            raise ValueError("Invalid JSON body")

    def serve_file(self, file_path):
        if not file_path.exists() or not file_path.is_file():
            self.send_text(404, "Not Found")
            return

        content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
        self._send(200, file_path.read_bytes(), content_type)

    def handle_create_order(self):
        try:
            body = self.read_body()
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
            return

        site = read_json("site.json")
        menu_groups = read_json("menu.json")
        menu_items = flatten_menu(menu_groups)

        customer_name = sanitize(body.get("customerName"))
        phone = normalize_phone(body.get("phone"))
        email = sanitize(body.get("email"))
        delivery_date = sanitize(body.get("deliveryDate"))
        item_id = sanitize(body.get("itemId"))
        quantity = max(int(body.get("quantity") or 1), 1)
        selected_item = next((item for item in menu_items if item["id"] == item_id), None)
        custom_cake = normalize_custom_cake(body.get("customCake"))
        custom_cake_selected = bool(body.get("includeCustomCake")) and has_custom_cake(custom_cake)

        if not customer_name or not phone or not delivery_date:
            self.send_json(
                400,
                {"error": "Please provide your name, phone number, and delivery date."},
            )
            return

        if not selected_item and not custom_cake_selected:
            self.send_json(
                400,
                {"error": "Please choose a menu item or configure a custom cake."},
            )
            return

        item_subtotal = int(selected_item["price"]) * quantity if selected_item else 0
        custom_subtotal = custom_cake_quote(custom_cake) if custom_cake_selected else 0
        subtotal = item_subtotal + custom_subtotal
        shipping = delivery_fee(site, body)

        try:
            coupon, discount = coupon_discount(site, body.get("couponCode"), subtotal, custom_cake_selected)
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
            return

        total = max(subtotal + shipping - discount, 0)
        points_earned = points_for_total(site, total)
        payment_method = sanitize(body.get("paymentMethod")) or "upi"
        payment_status = (
            "Awaiting UPI payment"
            if payment_method in {"upi", "paytm"}
            else "Pending confirmation"
        )

        tracking_id = create_tracking_id()
        now = datetime.now().isoformat()
        order = {
            "id": tracking_id,
            "trackingId": tracking_id,
            "customerName": customer_name,
            "phone": phone,
            "email": email,
            "occasion": sanitize(body.get("occasion")) or "General",
            "deliveryDate": delivery_date,
            "timeSlot": sanitize(body.get("timeSlot")) or "Flexible",
            "fulfillmentMethod": sanitize(body.get("fulfillmentMethod")) or "delivery",
            "deliverySpeed": sanitize(body.get("deliverySpeed")) or "delivery",
            "address": sanitize(body.get("address")),
            "addressLabel": sanitize(body.get("addressLabel")),
            "notes": sanitize(body.get("notes")),
            "quantity": quantity,
            "selectedItem": selected_item,
            "customCake": custom_cake if custom_cake_selected else None,
            "paymentMethod": payment_method,
            "paymentStatus": payment_status,
            "couponCode": sanitize(body.get("couponCode")).upper(),
            "coupon": coupon,
            "pricing": {
                "itemSubtotal": item_subtotal,
                "customSubtotal": custom_subtotal,
                "subtotal": subtotal,
                "deliveryFee": shipping,
                "discount": discount,
                "total": total,
            },
            "total": total,
            "pointsEarned": points_earned,
            "status": "Order received",
            "createdAt": now,
            "timeline": [
                {
                    "label": "Order received",
                    "detail": ORDER_STATUS_DETAILS["Order received"],
                    "at": now,
                }
            ],
        }

        orders = read_json("orders.json")
        orders.insert(0, order)
        write_json("orders.json", orders)

        customers = read_json("customers.json")
        saved_address = (
            {
                "label": sanitize(body.get("addressLabel")) or "Primary celebration address",
                "recipient": customer_name,
                "phone": phone,
                "addressLine": sanitize(body.get("address")),
                "landmark": sanitize(body.get("landmark")),
                "isDefault": True,
            }
            if bool(body.get("saveAddress"))
            and sanitize(body.get("address"))
            and sanitize(body.get("fulfillmentMethod")).lower() != "pickup"
            else None
        )
        design_to_save = (
            {
                **custom_cake,
                "id": sanitize(body.get("savedDesignId")),
                "label": sanitize(body.get("designLabel")) or f"{sanitize(body.get('occasion')) or 'Celebration'} custom cake",
                "createdAt": now,
            }
            if custom_cake_selected and body.get("saveDesignOnCheckout")
            else None
        )

        customer = upsert_customer(
            customers,
            phone,
            {
                "name": customer_name,
                "email": email,
                "preferredPaymentMethod": payment_method,
            },
            mutate=lambda current: self._order_customer_update(
                current,
                customer_name,
                email,
                total,
                points_earned,
                payment_method,
                sanitize(body.get("occasion")),
                saved_address,
                design_to_save,
                coupon,
            ),
        )
        write_json("customers.json", customers)

        self.send_json(
            201,
            {
                "message": "Order request created successfully.",
                "trackingId": tracking_id,
                "order": order,
                "pointsEarned": points_earned,
                "customer": hydrate_customer(site, customer, find_orders_for_phone(orders, phone)),
            },
        )

    def _order_customer_update(
        self,
        current,
        customer_name,
        email,
        total,
        points_earned,
        payment_method,
        occasion,
        saved_address,
        design_to_save,
        coupon,
    ):
        next_profile = {
            **current,
            "name": customer_name or current.get("name"),
            "email": email or current.get("email"),
            "preferredPaymentMethod": payment_method or current.get("preferredPaymentMethod"),
            "totalSpent": int(current.get("totalSpent") or 0) + int(total or 0),
            "ordersCount": int(current.get("ordersCount") or 0) + 1,
            "loyaltyPoints": int(current.get("loyaltyPoints") or 0) + int(points_earned or 0),
            "favoriteOccasion": occasion or current.get("favoriteOccasion"),
        }

        if saved_address:
            addresses = list(next_profile.get("addresses") or [])
            for address in addresses:
                address["isDefault"] = False
            addresses.insert(0, normalize_address(saved_address))
            next_profile["addresses"] = addresses

        if design_to_save:
            saved_designs = list(next_profile.get("savedDesigns") or [])
            saved_designs.insert(0, normalize_design(design_to_save))
            next_profile["savedDesigns"] = saved_designs

        if coupon:
            next_profile["savedCoupons"] = [
                entry
                for entry in list(next_profile.get("savedCoupons") or [])
                if sanitize(entry.get("code")).upper() != sanitize(coupon.get("code")).upper()
            ]

        return next_profile

    def handle_create_message(self):
        try:
            body = self.read_body()
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
            return

        customer_name = sanitize(body.get("customerName"))
        phone = normalize_phone(body.get("phone"))
        email = sanitize(body.get("email"))
        subject = sanitize(body.get("subject")) or "General enquiry"
        message = sanitize(body.get("message"))

        if not customer_name or (not phone and not email) or not message:
            self.send_json(
                400,
                {"error": "Please provide your name, one contact method, and your message."},
            )
            return

        messages = read_json("messages.json")
        entry = {
            "id": f"msg-{int(datetime.now().timestamp() * 1000)}",
            "customerName": customer_name,
            "phone": phone,
            "email": email,
            "subject": subject,
            "message": message,
            "status": "new",
            "statusLabel": MESSAGE_STATUS_DETAILS["new"],
            "createdAt": datetime.now().isoformat(),
        }
        messages.insert(0, entry)
        write_json("messages.json", messages)

        self.send_json(
            201,
            {
                "message": "Message received successfully.",
                "entry": entry,
            },
        )

    def handle_save_address(self):
        try:
            body = self.read_body()
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
            return

        phone = normalize_phone(body.get("phone"))
        address = normalize_address(body.get("address"))

        if not phone or not sanitize(address.get("addressLine")):
            self.send_json(400, {"error": "Please provide the phone number and address details."})
            return

        customers = read_json("customers.json")

        def mutate(current):
            addresses = list(current.get("addresses") or [])
            if address.get("isDefault"):
                for item in addresses:
                    item["isDefault"] = False

            index = next((i for i, item in enumerate(addresses) if item.get("id") == address.get("id")), -1)
            if index >= 0:
                addresses[index] = address
            else:
                addresses.insert(0, address)

            return {
                **current,
                "addresses": addresses,
            }

        customer = upsert_customer(customers, phone, {}, mutate=mutate)
        write_json("customers.json", customers)

        self.send_json(
            201,
            {
                "message": "Address saved successfully.",
                "customer": customer,
                "address": address,
            },
        )

    def handle_save_design(self):
        try:
            body = self.read_body()
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
            return

        phone = normalize_phone(body.get("phone"))
        design = normalize_design(body.get("design"))

        if not phone or not design.get("flavour") or not design.get("size"):
            self.send_json(
                400,
                {"error": "Choose the cake size and flavour before saving the design."},
            )
            return

        customers = read_json("customers.json")

        def mutate(current):
            saved_designs = list(current.get("savedDesigns") or [])
            index = next((i for i, item in enumerate(saved_designs) if item.get("id") == design.get("id")), -1)
            if index >= 0:
                saved_designs[index] = design
            else:
                saved_designs.insert(0, design)
            return {
                **current,
                "savedDesigns": saved_designs,
            }

        customer = upsert_customer(customers, phone, {}, mutate=mutate)
        write_json("customers.json", customers)

        self.send_json(
            201,
            {
                "message": "Design saved to your dashboard.",
                "customer": customer,
                "design": design,
            },
        )

    def handle_join_membership(self):
        try:
            body = self.read_body()
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
            return

        site = read_json("site.json")
        phone = normalize_phone(body.get("phone"))
        name = sanitize(body.get("name"))

        if not phone or not name:
            self.send_json(
                400,
                {"error": "Please provide your name and phone number to join Vanilla Circle."},
            )
            return

        welcome_award = 0
        customers = read_json("customers.json")

        def mutate(current):
            nonlocal welcome_award
            next_profile = {
                **current,
                "name": name,
                "email": sanitize(body.get("email")) or current.get("email"),
                "member": {
                    "active": True,
                    "joinedAt": sanitize((current.get("member") or {}).get("joinedAt")) or datetime.now().isoformat(),
                    "welcomeGranted": bool((current.get("member") or {}).get("welcomeGranted")),
                },
            }

            if not next_profile["member"]["welcomeGranted"]:
                welcome_award = int((site.get("membership") or {}).get("welcomePoints") or 0)
                next_profile["loyaltyPoints"] = int(next_profile.get("loyaltyPoints") or 0) + welcome_award
                next_profile["member"]["welcomeGranted"] = True
                next_profile["savedCoupons"] = [
                    {
                        "code": "CIRCLE50",
                        "title": "Welcome to Vanilla Circle",
                        "description": "Flat Rs. 50 off on your next celebration order above Rs. 699.",
                    },
                    *list(next_profile.get("savedCoupons") or []),
                ]

            return next_profile

        customer = upsert_customer(customers, phone, body, mutate=mutate)
        write_json("customers.json", customers)
        orders = read_json("orders.json")

        self.send_json(
            201,
            {
                "message": (
                    "Membership activated. Welcome points added to your account."
                    if welcome_award
                    else "Membership details updated successfully."
                ),
                "customer": hydrate_customer(site, customer, find_orders_for_phone(orders, phone)),
                "welcomeAward": welcome_award,
            },
        )

    def handle_update_order_status(self, tracking_id):
        try:
            body = self.read_body()
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
            return

        status = sanitize(body.get("status"))
        if not status:
            self.send_json(400, {"error": "Please choose a status."})
            return

        orders = read_json("orders.json")
        normalized_tracking = sanitize(tracking_id).upper()
        order = next(
            (entry for entry in orders if sanitize(entry.get("trackingId")).upper() == normalized_tracking),
            None,
        )

        if not order:
            self.send_json(404, {"error": "Order not found."})
            return

        append_timeline(order, status, sanitize(body.get("note")))
        write_json("orders.json", orders)
        self.send_json(
            200,
            {
                "message": "Order status updated successfully.",
                "order": order,
            },
        )

    def handle_update_message_status(self, message_id):
        try:
            body = self.read_body()
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
            return

        status = sanitize(body.get("status")) or "new"
        messages = read_json("messages.json")
        message = next((entry for entry in messages if sanitize(entry.get("id")) == sanitize(message_id)), None)

        if not message:
            self.send_json(404, {"error": "Message not found."})
            return

        message["status"] = status
        message["statusLabel"] = MESSAGE_STATUS_DETAILS.get(status) or MESSAGE_STATUS_DETAILS["new"]
        message["updatedAt"] = datetime.now().isoformat()
        write_json("messages.json", messages)

        self.send_json(
            200,
            {
                "message": "Message status updated successfully.",
                "entry": message,
            },
        )

    def handle_api_get(self, path):
        if path == "/api/health":
            self.send_json(200, {"ok": True, "service": "the-vanilla-bean-site"})
            return True

        if path == "/api/site":
            self.send_json(200, read_json("site.json"))
            return True

        if path == "/api/menu":
            self.send_json(200, read_json("menu.json"))
            return True

        if path == "/api/orders":
            self.send_json(200, read_json("orders.json"))
            return True

        order_match = re.match(r"^/api/orders/([^/]+)$", path)
        if order_match:
            tracking_id = sanitize(order_match.group(1)).upper()
            orders = read_json("orders.json")
            order = next(
                (entry for entry in orders if sanitize(entry.get("trackingId")).upper() == tracking_id),
                None,
            )
            if not order:
                self.send_json(404, {"error": "No order found for that tracking ID."})
                return True

            self.send_json(200, order)
            return True

        if path == "/api/messages":
            self.send_json(200, read_json("messages.json"))
            return True

        customer_match = re.match(r"^/api/customers/([^/]+)$", path)
        if customer_match:
            self.send_json(200, dashboard_for_phone(customer_match.group(1)))
            return True

        if path == "/api/admin/summary":
            orders = read_json("orders.json")
            messages = read_json("messages.json")
            customers = read_json("customers.json")
            revenue = sum(int(entry.get("total") or 0) for entry in orders)
            cake_orders = len(
                [
                    entry
                    for entry in orders
                    if (entry.get("selectedItem") or {}).get("categorySlug") == "cakes"
                    or entry.get("customCake")
                ]
            )
            pending_orders = len(
                [
                    entry
                    for entry in orders
                    if sanitize(entry.get("status")) not in {"Delivered", "Completed", "Cancelled"}
                ]
            )
            saved_designs = sum(len(customer.get("savedDesigns") or []) for customer in customers)
            active_members = len(
                [customer for customer in customers if bool((customer.get("member") or {}).get("active"))]
            )
            status_counts = {}
            for order in orders:
                key = sanitize(order.get("status")) or "Unknown"
                status_counts[key] = int(status_counts.get(key) or 0) + 1

            self.send_json(
                200,
                {
                    "totals": {
                        "orders": len(orders),
                        "messages": len(messages),
                        "revenue": revenue,
                        "cakeOrders": cake_orders,
                        "pendingOrders": pending_orders,
                        "activeMembers": active_members,
                        "savedDesigns": saved_designs,
                    },
                    "latestOrders": orders[:5],
                    "latestMessages": messages[:5],
                    "statusCounts": status_counts,
                },
            )
            return True

        return False

    def do_GET(self):
        parsed = urlparse(self.path)
        request_path = parsed.path

        try:
            if request_path.startswith("/api/"):
                if not self.handle_api_get(request_path):
                    self.send_json(404, {"error": "API route not found."})
                return

            if request_path.startswith("/public/"):
                public_path = (ROOT_DIR / request_path.lstrip("/")).resolve()
                public_root = (ROOT_DIR / "public").resolve()

                if not str(public_path).startswith(str(public_root)):
                    self.send_text(403, "Forbidden")
                    return

                self.serve_file(public_path)
                return

            page = resolve_page_route(request_path)
            if page:
                self.serve_file(page)
                return

            self.send_text(404, "Page not found")
        except Exception as error:
            self.send_json(500, {"error": str(error)})

    def do_POST(self):
        parsed = urlparse(self.path)
        request_path = parsed.path

        try:
            if request_path == "/api/orders":
                self.handle_create_order()
                return

            if request_path == "/api/contact":
                self.handle_create_message()
                return

            if request_path == "/api/customers/address":
                self.handle_save_address()
                return

            if request_path == "/api/customers/designs":
                self.handle_save_design()
                return

            if request_path == "/api/membership/join":
                self.handle_join_membership()
                return

            order_status_match = re.match(r"^/api/admin/orders/([^/]+)/status$", request_path)
            if order_status_match:
                self.handle_update_order_status(order_status_match.group(1))
                return

            message_status_match = re.match(r"^/api/admin/messages/([^/]+)/status$", request_path)
            if message_status_match:
                self.handle_update_message_status(message_status_match.group(1))
                return

            self.send_json(404, {"error": "API route not found."})
        except Exception as error:
            self.send_json(500, {"error": str(error)})


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), VanillaBeanHandler)
    print(f"The Vanilla Bean server running on http://localhost:{PORT}")
    server.serve_forever()
