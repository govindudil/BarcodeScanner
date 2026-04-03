/**
 * Product Lookup API Service
 * Waterfall strategy: detects barcode type, then tries multiple free APIs
 * - ISBN (978/979) → Open Library
 * - Others → Open Food Facts → Open Beauty Facts → UPCitemdb
 */

const ProductAPI = {
  /**
   * Look up a product by barcode. Returns a normalized product object or null.
   */
  async lookup(barcode) {
    barcode = String(barcode).trim();

    if (this._isISBN(barcode)) {
      return this._lookupBook(barcode);
    }

    // Try Open Food Facts first
    let product = await this._lookupOpenFoodFacts(barcode);
    if (product) return product;

    // Try Open Beauty Facts
    product = await this._lookupOpenBeautyFacts(barcode);
    if (product) return product;

    // Fallback: UPCitemdb (rate-limited, 100/day)
    product = await this._lookupUPCitemdb(barcode);
    if (product) return product;

    return null;
  },

  _isISBN(barcode) {
    return (barcode.length === 13 && (barcode.startsWith('978') || barcode.startsWith('979')))
        || barcode.length === 10;
  },

  // ── Open Library (books) ──────────────────────────────────────────
  async _lookupBook(isbn) {
    try {
      const res = await fetch(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`);
      if (!res.ok) return null;
      const data = await res.json();

      // Get author names
      let authors = '';
      if (data.authors && data.authors.length > 0) {
        const authorPromises = data.authors.map(async (a) => {
          try {
            const r = await fetch(`https://openlibrary.org${a.key}.json`);
            if (r.ok) { const d = await r.json(); return d.name; }
          } catch { /* skip */ }
          return null;
        });
        const names = (await Promise.all(authorPromises)).filter(Boolean);
        authors = names.join(', ');
      }

      // Cover image
      let image = null;
      if (data.covers && data.covers.length > 0) {
        image = `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg`;
      }

      return {
        name: data.title || 'Unknown Title',
        brand: authors || 'Unknown Author',
        image,
        barcode: isbn,
        category: 'Book',
        description: data.subtitle || '',
        source: 'Open Library',
        extra: {
          publishers: data.publishers ? data.publishers.join(', ') : null,
          publishDate: data.publish_date || null,
          pages: data.number_of_pages || null,
          isbn10: data.isbn_10 ? data.isbn_10[0] : null,
          isbn13: data.isbn_13 ? data.isbn_13[0] : isbn,
        },
        nutrition: null,
        type: 'book',
      };
    } catch {
      return null;
    }
  },

  // ── Open Food Facts ───────────────────────────────────────────────
  async _lookupOpenFoodFacts(barcode) {
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (data.status !== 1 || !data.product) return null;

      const p = data.product;
      const nutriments = p.nutriments || {};

      return {
        name: p.product_name || p.product_name_en || 'Unknown Product',
        brand: p.brands || '',
        image: p.image_front_url || p.image_url || null,
        barcode,
        category: p.categories_tags ? p.categories_tags.slice(0, 3).map(c => c.replace('en:', '')).join(', ') : '',
        description: p.generic_name || p.generic_name_en || '',
        source: 'Open Food Facts',
        extra: {
          quantity: p.quantity || null,
          packaging: p.packaging || null,
          countries: p.countries || null,
          ingredients: p.ingredients_text || p.ingredients_text_en || null,
          nutriscore: p.nutriscore_grade ? p.nutriscore_grade.toUpperCase() : null,
        },
        nutrition: {
          energy: nutriments['energy-kcal_100g'] ? `${Math.round(nutriments['energy-kcal_100g'])} kcal` : null,
          fat: nutriments.fat_100g != null ? `${nutriments.fat_100g}g` : null,
          carbs: nutriments.carbohydrates_100g != null ? `${nutriments.carbohydrates_100g}g` : null,
          protein: nutriments.proteins_100g != null ? `${nutriments.proteins_100g}g` : null,
          sugar: nutriments.sugars_100g != null ? `${nutriments.sugars_100g}g` : null,
          salt: nutriments.salt_100g != null ? `${nutriments.salt_100g}g` : null,
          fiber: nutriments.fiber_100g != null ? `${nutriments.fiber_100g}g` : null,
        },
        type: 'food',
      };
    } catch {
      return null;
    }
  },

  // ── Open Beauty Facts ─────────────────────────────────────────────
  async _lookupOpenBeautyFacts(barcode) {
    try {
      const res = await fetch(
        `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (data.status !== 1 || !data.product) return null;

      const p = data.product;

      return {
        name: p.product_name || p.product_name_en || 'Unknown Product',
        brand: p.brands || '',
        image: p.image_front_url || p.image_url || null,
        barcode,
        category: p.categories || '',
        description: p.generic_name || '',
        source: 'Open Beauty Facts',
        extra: {
          quantity: p.quantity || null,
          packaging: p.packaging || null,
          ingredients: p.ingredients_text || null,
        },
        nutrition: null,
        type: 'beauty',
      };
    } catch {
      return null;
    }
  },

  // ── UPCitemdb (general products, 100 free req/day) ────────────────
  async _lookupUPCitemdb(barcode) {
    try {
      const res = await fetch(
        `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.items || data.items.length === 0) return null;

      const item = data.items[0];

      return {
        name: item.title || 'Unknown Product',
        brand: item.brand || '',
        image: (item.images && item.images.length > 0) ? item.images[0] : null,
        barcode,
        category: item.category || '',
        description: item.description || '',
        source: 'UPCitemdb',
        extra: {
          weight: item.weight || null,
          dimension: item.dimension || null,
        },
        nutrition: null,
        type: 'general',
      };
    } catch {
      return null;
    }
  },
};
