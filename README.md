# The Vanilla Bean Website

Premium bakery and cafe website for The Vanilla Bean with:

- A polished multi-page frontend using the real bakery photos you shared
- A Python backend with JSON APIs for site data, menu data, order creation, order tracking, and enquiries
- A custom cake builder preview on the homepage
- A searchable dynamic menu page
- A combined order flow for ready-made items and custom cakes
- An order tracking page
- A lightweight admin dashboard for local review of orders and messages

## Important

This project is not meant to be opened by double-clicking `index.html`.

It uses:

- shared CSS and JS from `/public`
- API routes from the local backend
- dynamic menu, order, tracking, and admin data

Open it through the local server instead.

## Run locally

```bash
cd "/Users/chandramondal/Documents/the valina bean"
python3 server.py
```

Open [http://localhost:3000](http://localhost:3000).

Or run:

```bash
./start.command
```

## Main routes

- `/` home page
- `/about` about and brand positioning
- `/menu` dynamic menu page
- `/gallery` bakery gallery
- `/order` order and custom cake form
- `/track` tracking page
- `/contact` enquiry page
- `/admin` demo admin dashboard

## API routes

- `GET /api/site`
- `GET /api/menu`
- `GET /api/orders`
- `GET /api/orders/<tracking-id>`
- `POST /api/orders`
- `GET /api/messages`
- `POST /api/contact`
- `GET /api/admin/summary`

## Content notes

- Bakery photos and menu cards come from the images provided in the workspace context.
- Seed menu items are based on the visible product and menu-card information and can be edited in `/Users/chandramondal/Documents/the valina bean/data/menu.json`.
- Contact details, hours, and location should be reviewed once before production deployment.

## Demo admin access

- Demo PIN: `vanillabean2026`
- Replace this with proper authentication before production use.
# cakeweb
