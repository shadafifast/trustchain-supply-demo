/**
 * TrustChain – Frontend App Controller
 * All blockchain operations are delegated to the Express REST API.
 * UI Logic | Rendering | fetch()-based API calls
 */

// ─── API Base URL (auto-detects local vs production) ────────────────────────
const API_BASE = '';  // Same origin — server serves the frontend too

// ─── State ───────────────────────────────────────────────────────────────────
let currentChainData = { chain: [], products: {}, stats: { totalBlocks: 0, totalProducts: 0, difficulty: 3, isValid: null } };

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initCreateProduct();
  initUpdateLocation();
  initExplorer();
  initValidation();
  initTamper();
  loadChainFromServer();
});

// ─── Fetch Chain State from Server ───────────────────────────────────────────
async function loadChainFromServer() {
  try {
    const data = await apiGet('/api/chain');
    currentChainData = data;
    renderAll(data);
  } catch (err) {
    showToast('⚠️ Could not reach the server. Make sure server.js is running.', 'error');
  }
}

// ─── API Helpers ──────────────────────────────────────────────────────────────
async function apiGet(endpoint) {
  const res = await fetch(API_BASE + endpoint);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiPost(endpoint, body) {
  const res = await fetch(API_BASE + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ─── Render Everything ────────────────────────────────────────────────────────
function renderAll(data) {
  currentChainData = data;
  renderStats(data.stats);
  renderProductSelects(data.products);
  renderTamperSelect(data.chain);

  const explorerPanel = document.getElementById('panel-explorer');
  if (explorerPanel && explorerPanel.classList.contains('tab-panel--active')) {
    renderBlockchain(data.chain, data.stats.difficulty);
  }
}

// ─── Tab Navigation ───────────────────────────────────────────────────────────
function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('nav-tab--active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('tab-panel--active'));

      tab.classList.add('nav-tab--active');
      const panelId = `panel-${tab.dataset.tab}`;
      document.getElementById(panelId).classList.add('tab-panel--active');

      if (tab.dataset.tab === 'explorer') renderBlockchain(currentChainData.chain, currentChainData.stats.difficulty);
      if (tab.dataset.tab === 'validate') clearValidation();
    });
  });
}

// ─── Create Product ───────────────────────────────────────────────────────────
function initCreateProduct() {
  const btn = document.getElementById('btn-create-product');
  const nameInput = document.getElementById('product-name');
  const idInput = document.getElementById('product-id');

  btn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const id = idInput.value.trim();
    if (!name) { showToast('Please enter a product name.', 'error'); nameInput.focus(); return; }
    if (!id)   { showToast('Please enter a product ID.', 'error');   idInput.focus();   return; }

    showMining();
    try {
      const data = await apiPost('/api/products', { name, id });
      hideMining(data.block);
      showToast(`✅ ${data.message}`, 'success');
      nameInput.value = '';
      idInput.value = '';
      renderAll(data);
    } catch (err) {
      hideMining();
      showToast(`❌ ${err.message}`, 'error');
    }
  });
}

// ─── Update Location ──────────────────────────────────────────────────────────
function initUpdateLocation() {
  const btn = document.getElementById('btn-update-location');
  const select = document.getElementById('update-product-select');
  const locationInput = document.getElementById('update-location');

  select.addEventListener('change', () => { btn.disabled = !select.value; });

  btn.addEventListener('click', async () => {
    const productId = select.value;
    const location = locationInput.value.trim();
    if (!productId) { showToast('Please select a product.', 'error'); return; }
    if (!location)  { showToast('Please enter a location.', 'error'); locationInput.focus(); return; }

    showMining();
    try {
      const data = await apiPost('/api/locations', { productId, location });
      hideMining(data.block);
      showToast(`📍 ${data.message}`, 'success');
      locationInput.value = '';
      renderAll(data);
    } catch (err) {
      hideMining();
      showToast(`❌ ${err.message}`, 'error');
    }
  });
}

// ─── Blockchain Explorer ──────────────────────────────────────────────────────
function initExplorer() {
  const filter = document.getElementById('explorer-filter');
  filter.addEventListener('change', () => {
    const productId = filter.value;
    let blocks = currentChainData.chain;
    if (productId !== 'all') {
      const product = currentChainData.products[productId];
      if (product) blocks = product.blockIndices.map(i => currentChainData.chain[i]);
      else blocks = [];
    }
    renderBlockchain(blocks, currentChainData.stats.difficulty);
  });
}

function renderBlockchain(chain, difficulty = 3) {
  const container = document.getElementById('blockchain-explorer');
  if (!chain || chain.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⛓️</div>
        <h3 class="empty-state__title">No Blocks Yet</h3>
        <p class="empty-state__description">Create a product to generate the first block in the chain.</p>
      </div>
    `;
    return;
  }

  // Compute validity map
  const validMap = {};
  if (currentChainData.chain.length > 0) {
    // We need full chain for linking validation, but just flag blocks
    (currentChainData.stats.isValid === false ? [] : []).forEach(r => {
      validMap[r.blockIndex] = r.valid;
    });
  }

  let html = '<div class="blockchain-chain">';
  chain.forEach((block, i) => {
    const isGenesis = (() => {
      const product = currentChainData.products[block.productId];
      return product && product.blockIndices[0] === block.index;
    })();
    const delay = i * 0.06;

    if (i > 0) {
      html += `<div class="chain-link"><div class="chain-link__line"></div></div>`;
    }

    html += `
      <div class="block-wrapper" style="animation-delay: ${delay}s">
        <div class="block-card ${isGenesis ? 'block-card--genesis' : ''}">
          <div class="block-card__header">
            <span class="block-card__index">Block #${block.index}</span>
            ${isGenesis ? '<span class="block-card__genesis-badge">GENESIS</span>' : ''}
            <span class="block-card__status"></span>
          </div>
          <div class="block-card__product">${escapeHtml(block.productName)}</div>
          <div class="block-card__location">${escapeHtml(block.location)}</div>
          <div class="block-card__details">
            <div class="flex items-center gap-3 flex-wrap">
              <span class="product-tag">ID: ${escapeHtml(block.productId)}</span>
              <span class="nonce-tag">⛏ Nonce: ${block.nonce.toLocaleString()}</span>
            </div>
            <div class="block-detail">
              <span class="block-detail__label">Hash</span>
              <span class="block-detail__value block-detail__value--hash">${block.hash}</span>
            </div>
            <div class="block-detail">
              <span class="block-detail__label">Previous Hash</span>
              <span class="block-detail__value block-detail__value--prev">${block.previousHash}</span>
            </div>
          </div>
          <div class="block-card__timestamp">🕐 ${formatTimestamp(block.timestamp)}</div>
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

// ─── Validation ───────────────────────────────────────────────────────────────
function initValidation() {
  document.getElementById('btn-validate-chain').addEventListener('click', async () => {
    try {
      const result = await apiGet('/api/validate');
      if (result.message && !result.results.length) {
        showToast(result.message, 'error');
        return;
      }

      const container = document.getElementById('validation-results');
      const statusClass = result.isValid ? 'valid' : 'invalid';
      const statusIcon  = result.isValid ? '✅' : '❌';
      const statusTitle = result.isValid
        ? 'Blockchain is Valid!'
        : 'Blockchain is INVALID — Tampering Detected!';

      let html = `
        <div class="validation-result validation-result--${statusClass}">
          <div class="validation-result__header">
            <span class="validation-result__icon">${statusIcon}</span>
            <span class="validation-result__title validation-result__title--${statusClass}">${statusTitle}</span>
          </div>
          <div class="validation-result__details">
      `;

      result.results.forEach(r => {
        const cls = r.valid ? 'valid' : 'invalid';
        html += `
          <div class="validation-block-result validation-block-result--${cls}">
            <span class="validation-block-result__icon">${r.valid ? '✅' : '❌'}</span>
            <span class="validation-block-result__text">Block #${r.blockIndex}: ${r.reason}</span>
          </div>
        `;
      });

      html += '</div></div>';
      container.innerHTML = html;

      // Refresh stats
      await loadChainFromServer();
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error');
    }
  });
}

function clearValidation() {
  document.getElementById('validation-results').innerHTML = '';
}

// ─── Tamper Test ──────────────────────────────────────────────────────────────
function initTamper() {
  const select       = document.getElementById('tamper-block-select');
  const locationInput = document.getElementById('tamper-new-location');
  const btnTamper    = document.getElementById('btn-tamper');
  const btnReset     = document.getElementById('btn-reset-chain');

  select.addEventListener('change', () => { btnTamper.disabled = !select.value; });

  btnTamper.addEventListener('click', async () => {
    const blockIndex  = parseInt(select.value, 10);
    const newLocation = locationInput.value.trim();
    if (isNaN(blockIndex)) { showToast('Please select a block.', 'error'); return; }
    if (!newLocation)       { showToast('Please enter a fake location.', 'error'); locationInput.focus(); return; }

    try {
      const data = await apiPost('/api/tamper', { blockIndex, newLocation });
      showToast(`💀 ${data.message}`, 'error');
      locationInput.value = '';
      renderAll(data);
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error');
    }
  });

  btnReset.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to reset the entire blockchain? This cannot be undone.')) return;
    try {
      const data = await apiPost('/api/reset', {});
      showToast('🔄 Blockchain has been reset.', 'info');
      renderAll(data);
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error');
    }
  });
}

// ─── Demo Data ────────────────────────────────────────────────────────────────
async function loadDemoData() {
  const existing = currentChainData.chain.length > 0;
  if (existing) {
    const confirmed = confirm('⚠️ Your current blockchain has data.\n\nLoading demo data will REPLACE your existing chain. Continue?');
    if (!confirmed) return;
  }

  showToast('⛏️ Server is mining 15 demo blocks... please wait a few seconds.', 'info');

  try {
    const data = await apiPost('/api/seed', {});
    showToast(`🎉 ${data.message}`, 'success');
    renderAll(data);

    // Auto-navigate to explorer
    document.getElementById('tab-explorer').click();
  } catch (err) {
    showToast(`❌ Failed to load demo data: ${err.message}`, 'error');
  }
}

// ─── UI Helpers: Stats, Selects ──────────────────────────────────────────────
function renderStats(stats) {
  document.getElementById('stat-blocks').textContent     = stats.totalBlocks;
  document.getElementById('stat-products').textContent   = stats.totalProducts;
  document.getElementById('stat-difficulty').textContent = stats.difficulty;
  document.getElementById('stat-status').textContent     = stats.isValid === null ? '—' : stats.isValid ? '✅' : '❌';
}

function renderProductSelects(products) {
  const productList = Object.values(products);

  const updateSelect = document.getElementById('update-product-select');
  const currentUpdateVal = updateSelect.value;
  updateSelect.innerHTML = '<option value="">-- Choose a product --</option>';
  productList.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} (${p.id})`;
    updateSelect.appendChild(opt);
  });
  if (currentUpdateVal && updateSelect.querySelector(`option[value="${currentUpdateVal}"]`)) {
    updateSelect.value = currentUpdateVal;
  }
  document.getElementById('btn-update-location').disabled = !updateSelect.value;

  const explorerFilter = document.getElementById('explorer-filter');
  const currentFilterVal = explorerFilter.value;
  explorerFilter.innerHTML = '<option value="all">🔗 All Blocks</option>';
  productList.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `📦 ${p.name} (${p.id})`;
    explorerFilter.appendChild(opt);
  });
  if (currentFilterVal && explorerFilter.querySelector(`option[value="${currentFilterVal}"]`)) {
    explorerFilter.value = currentFilterVal;
  }
}

function renderTamperSelect(chain) {
  const select = document.getElementById('tamper-block-select');
  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Choose a block --</option>';
  chain.forEach(block => {
    const opt = document.createElement('option');
    opt.value = block.index;
    opt.textContent = `Block #${block.index} — ${block.productName} @ ${block.location}`;
    select.appendChild(opt);
  });
  if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
    select.value = currentVal;
  }
  document.getElementById('btn-tamper').disabled = !select.value;
}

// ─── Mining Overlay ───────────────────────────────────────────────────────────
function showMining() {
  document.getElementById('mining-overlay').classList.remove('hidden');
  document.getElementById('mining-hash').textContent  = 'Mining on server...';
  document.getElementById('mining-nonce').textContent = '—';
}

function hideMining(block) {
  const overlay = document.getElementById('mining-overlay');
  if (block) {
    document.getElementById('mining-hash').textContent  = block.hash;
    document.getElementById('mining-nonce').textContent = block.nonce.toLocaleString();
    setTimeout(() => overlay.classList.add('hidden'), 800);
  } else {
    overlay.classList.add('hidden');
  }
}

// ─── Toast Notifications ──────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast__icon">${icons[type] || icons.info}</span>
    <span class="toast__message">${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast--removing');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function formatTimestamp(isoString) {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return isoString;
  }
}
