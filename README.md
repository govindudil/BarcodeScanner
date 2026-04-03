# Barcode Scanner PWA

A Progressive Web App that uses your iPhone (or any mobile) camera to scan barcodes and instantly look up product details — no app store needed.

## Features

- **Camera barcode scanning** using html5-qrcode (works on iOS Safari)
- **Product lookup** via free APIs (no API keys required):
  - [Open Food Facts](https://openfoodfacts.org) — food & beverages
  - [Open Beauty Facts](https://openbeautyfacts.org) — cosmetics
  - [Open Library](https://openlibrary.org) — books (ISBN)
  - [UPCitemdb](https://upcitemdb.com) — general products
- **Nutrition info** for food products (energy, protein, carbs, fat, etc.)
- **Scan history** saved locally (last 50 scans)
- **Manual barcode entry** for barcodes that can't be scanned
- **Installable PWA** — add to iPhone home screen for an app-like experience
- **Offline app shell** — UI loads even without internet
- **Dark theme** mobile-first design

## Supported Barcode Formats

EAN-13, EAN-8, UPC-A, UPC-E, CODE-128, CODE-39, QR Code

## Getting Started

### Requirements

- HTTPS server (required for camera access on mobile browsers)
- A modern browser (Safari 14+, Chrome, Firefox)

### Quick Start

1. **Serve with any HTTPS static server:**

   ```bash
   # Option A: Python (for local testing with HTTPS proxy)
   python3 -m http.server 8080

   # Option B: Node.js
   npx serve .

   # Option C: Deploy to any static hosting (GitHub Pages, Netlify, Vercel, etc.)
   ```

2. **Open on your iPhone** — navigate to the URL in Safari

3. **Install as PWA** — tap the Share button (⬆️) → "Add to Home Screen"

4. **Scan!** — point your camera at any barcode

### Deploy to GitHub Pages

```bash
# Push to a GitHub repo, then enable Pages in Settings → Pages → Source: main branch
```

## Tech Stack

- **Vue 3** (CDN, no build tools)
- **html5-qrcode** (ZXing-based barcode scanner)
- **Pure CSS** (mobile-first, iOS safe areas)
- **Service Worker** (offline app shell caching)

## Project Structure

```
├── index.html           # Main HTML entry point
├── manifest.json        # PWA manifest
├── sw.js                # Service worker
├── css/
│   └── style.css        # Mobile-first styles
├── js/
│   ├── api.js           # Product lookup API service
│   └── app.js           # Vue 3 application
└── icons/
    ├── icon-192.svg     # PWA icon (192x192)
    └── icon-512.svg     # PWA icon (512x512)
```

## API Rate Limits

| API | Limit | Notes |
|-----|-------|-------|
| Open Food Facts | Unlimited | Free, open data |
| Open Beauty Facts | Unlimited | Free, open data |
| Open Library | Unlimited | Free, open data |
| UPCitemdb | 100/day | Free trial tier, used as fallback |

## License

MIT