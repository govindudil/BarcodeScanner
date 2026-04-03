const { createApp, ref, computed, onMounted, onUnmounted, nextTick, watch } = Vue;

const app = createApp({
  setup() {
    // ── State ──
    const currentTab = ref('scanner');   // 'scanner' | 'result' | 'history'
    const scannerActive = ref(false);
    const loading = ref(false);
    const product = ref(null);
    const error = ref(null);
    const history = ref([]);
    const manualBarcode = ref('');
    const showFlash = ref(false);
    const toast = ref(null);

    let html5Qrcode = null;

    // ── History ──
    const HISTORY_KEY = 'barcode_scan_history';
    const MAX_HISTORY = 50;

    function loadHistory() {
      try {
        const stored = localStorage.getItem(HISTORY_KEY);
        if (stored) history.value = JSON.parse(stored);
      } catch { /* ignore corrupt data */ }
    }

    function saveHistory() {
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value));
      } catch { /* storage full, ignore */ }
    }

    function addToHistory(item) {
      // Remove duplicate if exists
      history.value = history.value.filter(h => h.barcode !== item.barcode);
      history.value.unshift({
        barcode: item.barcode,
        name: item.name,
        brand: item.brand,
        image: item.image,
        source: item.source,
        type: item.type,
        scannedAt: new Date().toISOString(),
      });
      if (history.value.length > MAX_HISTORY) {
        history.value = history.value.slice(0, MAX_HISTORY);
      }
      saveHistory();
    }

    function removeFromHistory(barcode) {
      history.value = history.value.filter(h => h.barcode !== barcode);
      saveHistory();
    }

    function clearHistory() {
      history.value = [];
      saveHistory();
    }

    // ── Scanner ──
    async function startScanner() {
      error.value = null;
      try {
        html5Qrcode = new Html5Qrcode('scanner-region');
        await html5Qrcode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: function(viewfinderWidth, viewfinderHeight) {
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              return { width: Math.floor(minEdge * 0.8), height: Math.floor(minEdge * 0.5) };
            },
            aspectRatio: 4 / 3,
            formatsToSupport: [
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.QR_CODE,
            ],
          },
          onScanSuccess,
          () => {} // ignore scan errors (continuous scanning)
        );
        scannerActive.value = true;
      } catch (err) {
        console.error('Scanner start failed:', err);
        if (String(err).includes('NotAllowedError') || String(err).includes('Permission')) {
          error.value = 'Camera permission denied. Please allow camera access in your browser settings and reload.';
        } else {
          error.value = 'Could not start camera. Make sure no other app is using it and try again.';
        }
      }
    }

    async function stopScanner() {
      if (html5Qrcode) {
        try {
          await html5Qrcode.stop();
          html5Qrcode.clear();
        } catch { /* already stopped */ }
        html5Qrcode = null;
      }
      scannerActive.value = false;
    }

    async function onScanSuccess(decodedText) {
      // Immediately stop scanning
      await stopScanner();

      // Flash + vibrate feedback
      showFlash.value = true;
      setTimeout(() => showFlash.value = false, 500);
      if (navigator.vibrate) navigator.vibrate(100);

      await lookupProduct(decodedText);
    }

    // ── Product Lookup ──
    async function lookupProduct(barcode) {
      barcode = String(barcode).trim();
      if (!barcode) return;

      loading.value = true;
      error.value = null;
      product.value = null;
      currentTab.value = 'result';

      try {
        const result = await ProductAPI.lookup(barcode);
        if (result) {
          product.value = result;
          addToHistory(result);
        } else {
          product.value = null;
          error.value = 'not_found';
        }
      } catch (err) {
        console.error('Lookup failed:', err);
        error.value = 'network';
      } finally {
        loading.value = false;
      }
    }

    function handleManualSubmit() {
      const code = manualBarcode.value.trim();
      if (code) {
        manualBarcode.value = '';
        stopScanner();
        lookupProduct(code);
      }
    }

    // ── Navigation ──
    function switchTab(tab) {
      currentTab.value = tab;
      if (tab !== 'scanner') {
        stopScanner();
      }
    }

    function scanAgain() {
      product.value = null;
      error.value = null;
      currentTab.value = 'scanner';
      nextTick(() => startScanner());
    }

    function viewHistoryProduct(item) {
      lookupProduct(item.barcode);
    }

    // ── Helpers ──
    function formatDate(iso) {
      const d = new Date(iso);
      const now = new Date();
      const diff = now - d;
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      return d.toLocaleDateString();
    }

    function showToast(message) {
      toast.value = message;
      setTimeout(() => toast.value = null, 2500);
    }

    function typeIcon(type) {
      const icons = { food: '🍽️', book: '📖', beauty: '✨', general: '📦' };
      return icons[type] || '📦';
    }

    // ── Lifecycle ──
    onMounted(() => {
      loadHistory();
      // Auto-start scanner on mount
      nextTick(() => startScanner());
    });

    onUnmounted(() => {
      stopScanner();
    });

    return {
      currentTab,
      scannerActive,
      loading,
      product,
      error,
      history,
      manualBarcode,
      showFlash,
      toast,
      startScanner,
      stopScanner,
      switchTab,
      scanAgain,
      handleManualSubmit,
      lookupProduct,
      viewHistoryProduct,
      removeFromHistory,
      clearHistory,
      formatDate,
      showToast,
      typeIcon,
    };
  },

  template: `
    <!-- Flash overlay -->
    <div v-if="showFlash" class="scan-success-flash"></div>

    <!-- Toast -->
    <div v-if="toast" class="toast">{{ toast }}</div>

    <!-- Header -->
    <header class="app-header">
      <h1><span class="icon">📷</span> Barcode Scanner</h1>
    </header>

    <!-- Navigation -->
    <nav class="nav-tabs">
      <button class="nav-tab" :class="{ active: currentTab === 'scanner' }" @click="switchTab('scanner')">
        📸 Scan
      </button>
      <button class="nav-tab" :class="{ active: currentTab === 'result' }" @click="switchTab('result')">
        📋 Result
      </button>
      <button class="nav-tab" :class="{ active: currentTab === 'history' }" @click="switchTab('history')">
        🕐 History
        <span v-if="history.length" class="badge">{{ history.length }}</span>
      </button>
    </nav>

    <!-- Main Content -->
    <main class="main-content">

      <!-- ═══ Scanner View ═══ -->
      <div v-if="currentTab === 'scanner'" class="scanner-container">
        <div class="scanner-viewport">
          <div id="scanner-region"></div>
          <div v-if="scannerActive" class="scan-overlay">
            <div class="scan-frame">
              <div class="corner tl"></div>
              <div class="corner tr"></div>
              <div class="corner bl"></div>
              <div class="corner br"></div>
            </div>
          </div>
        </div>

        <p v-if="scannerActive" class="scanner-hint">Point camera at a barcode</p>

        <!-- Camera error message -->
        <div v-if="error && currentTab === 'scanner'" class="error-card">
          <div class="error-icon">📷</div>
          <h3>Camera Error</h3>
          <p>{{ error }}</p>
          <button class="btn btn-primary" @click="error = null; startScanner()">Try Again</button>
        </div>

        <div class="scanner-controls" v-if="!scannerActive && !error">
          <button class="btn btn-primary" @click="startScanner()">
            📷 Start Camera
          </button>
        </div>

        <div class="divider">or enter manually</div>

        <div class="manual-entry">
          <input
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            placeholder="Enter barcode number..."
            v-model="manualBarcode"
            @keyup.enter="handleManualSubmit"
            maxlength="20"
          >
          <button class="btn btn-primary" @click="handleManualSubmit" :disabled="!manualBarcode.trim()">
            🔍
          </button>
        </div>
      </div>

      <!-- ═══ Result View ═══ -->
      <div v-if="currentTab === 'result'">

        <!-- Loading -->
        <div v-if="loading" class="loading-container">
          <div class="spinner"></div>
          <p class="loading-text">Looking up product...</p>
        </div>

        <!-- Not Found -->
        <div v-else-if="error === 'not_found'" class="not-found-card">
          <div class="nf-icon">🔍</div>
          <h3>Product Not Found</h3>
          <p>No product information was found for this barcode. It may not be in our databases yet.</p>
          <button class="btn btn-primary" @click="scanAgain()">Scan Another</button>
        </div>

        <!-- Network Error -->
        <div v-else-if="error === 'network'" class="error-card">
          <div class="error-icon">📡</div>
          <h3>Connection Error</h3>
          <p>Could not connect to the product database. Check your internet connection and try again.</p>
          <button class="btn btn-primary" @click="scanAgain()">Scan Another</button>
        </div>

        <!-- Product Details -->
        <div v-else-if="product" class="result-card">
          <div class="result-image-container">
            <img v-if="product.image" :src="product.image" :alt="product.name" loading="lazy">
            <div v-else class="result-image-placeholder">
              {{ typeIcon(product.type) }}
              <span>No image available</span>
            </div>
          </div>
          <div class="result-body">
            <h2>{{ product.name }}</h2>
            <div v-if="product.brand" class="result-brand">{{ product.brand }}</div>
            <div class="result-barcode">
              <span>🏷️</span> {{ product.barcode }}
            </div>

            <div class="result-details">
              <div v-if="product.category" class="detail-row">
                <span class="detail-label">Category</span>
                <span class="detail-value">{{ product.category }}</span>
              </div>
              <div v-if="product.description" class="detail-row">
                <span class="detail-label">Description</span>
                <span class="detail-value">{{ product.description }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Source</span>
                <span class="detail-value">{{ product.source }}</span>
              </div>

              <!-- Book-specific details -->
              <template v-if="product.type === 'book' && product.extra">
                <div v-if="product.extra.publishers" class="detail-row">
                  <span class="detail-label">Publisher</span>
                  <span class="detail-value">{{ product.extra.publishers }}</span>
                </div>
                <div v-if="product.extra.publishDate" class="detail-row">
                  <span class="detail-label">Published</span>
                  <span class="detail-value">{{ product.extra.publishDate }}</span>
                </div>
                <div v-if="product.extra.pages" class="detail-row">
                  <span class="detail-label">Pages</span>
                  <span class="detail-value">{{ product.extra.pages }}</span>
                </div>
              </template>

              <!-- Food-specific details -->
              <template v-if="product.type === 'food' && product.extra">
                <div v-if="product.extra.quantity" class="detail-row">
                  <span class="detail-label">Quantity</span>
                  <span class="detail-value">{{ product.extra.quantity }}</span>
                </div>
                <div v-if="product.extra.nutriscore" class="detail-row">
                  <span class="detail-label">Nutri-Score</span>
                  <span class="detail-value">{{ product.extra.nutriscore }}</span>
                </div>
                <div v-if="product.extra.ingredients" class="detail-row">
                  <span class="detail-label">Ingredients</span>
                  <span class="detail-value">{{ product.extra.ingredients }}</span>
                </div>
              </template>

              <!-- Beauty-specific details -->
              <template v-if="product.type === 'beauty' && product.extra">
                <div v-if="product.extra.ingredients" class="detail-row">
                  <span class="detail-label">Ingredients</span>
                  <span class="detail-value">{{ product.extra.ingredients }}</span>
                </div>
              </template>
            </div>

            <!-- Nutrition grid (food only) -->
            <div v-if="product.nutrition" class="nutrition-grid">
              <div v-if="product.nutrition.energy" class="nutrition-item">
                <div class="value">{{ product.nutrition.energy }}</div>
                <div class="label">Energy</div>
              </div>
              <div v-if="product.nutrition.protein" class="nutrition-item">
                <div class="value">{{ product.nutrition.protein }}</div>
                <div class="label">Protein</div>
              </div>
              <div v-if="product.nutrition.carbs" class="nutrition-item">
                <div class="value">{{ product.nutrition.carbs }}</div>
                <div class="label">Carbs</div>
              </div>
              <div v-if="product.nutrition.fat" class="nutrition-item">
                <div class="value">{{ product.nutrition.fat }}</div>
                <div class="label">Fat</div>
              </div>
              <div v-if="product.nutrition.sugar" class="nutrition-item">
                <div class="value">{{ product.nutrition.sugar }}</div>
                <div class="label">Sugar</div>
              </div>
              <div v-if="product.nutrition.fiber" class="nutrition-item">
                <div class="value">{{ product.nutrition.fiber }}</div>
                <div class="label">Fiber</div>
              </div>
              <div v-if="product.nutrition.salt" class="nutrition-item">
                <div class="value">{{ product.nutrition.salt }}</div>
                <div class="label">Salt</div>
              </div>
            </div>
          </div>

          <div class="result-actions">
            <button class="btn btn-primary" @click="scanAgain()">📷 Scan Another</button>
          </div>
        </div>

        <!-- No result yet -->
        <div v-else class="not-found-card">
          <div class="nf-icon">📷</div>
          <h3>No Scan Yet</h3>
          <p>Scan a barcode to see product details here.</p>
          <button class="btn btn-primary" @click="switchTab('scanner')">Start Scanning</button>
        </div>
      </div>

      <!-- ═══ History View ═══ -->
      <div v-if="currentTab === 'history'">
        <div v-if="history.length > 0">
          <div class="history-header">
            <h2>Recent Scans</h2>
            <button class="btn btn-sm btn-secondary" @click="clearHistory()">Clear All</button>
          </div>
          <div class="history-list">
            <div
              v-for="item in history"
              :key="item.barcode"
              class="history-item"
              @click="viewHistoryProduct(item)"
            >
              <div class="history-thumb">
                <img v-if="item.image" :src="item.image" :alt="item.name" loading="lazy">
                <span v-else class="placeholder">{{ typeIcon(item.type) }}</span>
              </div>
              <div class="history-info">
                <div class="name">{{ item.name }}</div>
                <div class="meta">
                  <span>{{ item.barcode }}</span>
                  <span>{{ formatDate(item.scannedAt) }}</span>
                </div>
              </div>
              <button class="history-delete" @click.stop="removeFromHistory(item.barcode)" title="Remove">✕</button>
            </div>
          </div>
        </div>
        <div v-else class="history-empty">
          <div class="icon">📋</div>
          <p>No scans yet.<br>Scan a barcode to start building your history.</p>
        </div>
      </div>

    </main>
  `,
});

app.mount('#app');
