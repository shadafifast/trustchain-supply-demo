/**
 * TrustChain v2.0 – Frontend Controller
 */

const API_BASE = '';
let currentChainData = { chain: [], products: {}, pendingTransactions: [], stats: { totalBlocks: 0, totalTransactions: 0, totalProducts: 0, pendingCount: 0, difficulty: 3, isValid: null } };
let lastValidationResults = [];

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initCreateProduct();
  initAddTransaction();
  initExplorer();
  initValidation();
  initTamper();
  initPendingFlush();
  loadChainFromServer();
});

async function loadChainFromServer() {
  try {
    const data = await apiGet('/api/chain');
    currentChainData = data;
    renderAll(data);
  } catch (err) {
    showToast('Could not reach the server. Make sure server.js is running.', 'error');
  }
}

async function apiGet(endpoint) {
  const res = await fetch(API_BASE + endpoint);
  if (!res.ok) { const e = await res.json().catch(() => ({ error: `HTTP ${res.status}` })); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}

async function apiPost(endpoint, body) {
  const res = await fetch(API_BASE + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function apiPostForm(endpoint, formData) {
  const res = await fetch(API_BASE + endpoint, { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function renderAll(data) {
  currentChainData = data;
  renderStats(data.stats);
  renderProductSelects(data.products);
  renderTamperSelect(data.chain);
  renderPendingBanner(data.stats.pendingCount);
  renderInsurance(data.products);
  renderQRGrid(data.products);
  const explorerPanel = document.getElementById('panel-explorer');
  if (explorerPanel && explorerPanel.classList.contains('tab-panel--active')) {
    renderBlockchain(data.chain);
    renderPendingPool(data.pendingTransactions || []);
  }
}

function initTabs() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('nav-tab--active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('tab-panel--active'));
      tab.classList.add('nav-tab--active');
      document.getElementById(`panel-${tab.dataset.tab}`).classList.add('tab-panel--active');
      if (tab.dataset.tab === 'explorer') { renderBlockchain(currentChainData.chain); renderPendingPool(currentChainData.pendingTransactions || []); }
      if (tab.dataset.tab === 'validate') document.getElementById('validation-results').innerHTML = '';
      if (tab.dataset.tab === 'insurance') renderInsurance(currentChainData.products);
      if (tab.dataset.tab === 'qr') renderQRGrid(currentChainData.products);
    });
  });
}

function initPendingFlush() {
  document.getElementById('btn-flush-pending').addEventListener('click', async () => {
    try {
      showMining();
      const data = await apiPost('/api/flush', {});
      hideMining(data.block);
      showToast(data.message, 'success');
      renderAll(data);
    } catch (err) { hideMining(); showToast(err.message, 'error'); }
  });
}

function initCreateProduct() {
  document.getElementById('btn-create-product').addEventListener('click', async () => {
    const name = document.getElementById('product-name').value.trim();
    const id = document.getElementById('product-id').value.trim();
    const insuranceType = document.getElementById('product-insurance').value;
    const notes = document.getElementById('product-notes').value.trim();
    if (!name) { showToast('Product name is required.', 'error'); return; }
    if (!id) { showToast('Product ID is required.', 'error'); return; }
    showMining();
    try {
      const data = await apiPost('/api/products', { name, id, insuranceType, notes });
      hideMining(data.block);
      showToast(data.message, 'success');
      document.getElementById('product-name').value = '';
      document.getElementById('product-id').value = '';
      document.getElementById('product-notes').value = '';
      renderAll(data);
    } catch (err) { hideMining(); showToast(err.message, 'error'); }
  });
}

function initAddTransaction() {
  const select = document.getElementById('tx-product-select');
  const statusSel = document.getElementById('tx-status');
  const btn = document.getElementById('btn-add-transaction');
  const imageInput = document.getElementById('tx-image');
  const uploadArea = document.getElementById('upload-area');
  const preview = document.getElementById('upload-preview');
  const previewImg = document.getElementById('upload-preview-img');
  const previewName = document.getElementById('upload-preview-name');
  const clearBtn = document.getElementById('upload-clear');

  select.addEventListener('change', () => { btn.disabled = !select.value; updateSmartContractPreview(); });
  statusSel.addEventListener('change', updateSmartContractPreview);

  uploadArea.addEventListener('click', (e) => { if (!e.target.closest('.upload-clear')) imageInput.click(); });
  uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('upload-area--drag'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('upload-area--drag'));
  uploadArea.addEventListener('drop', e => {
    e.preventDefault(); uploadArea.classList.remove('upload-area--drag');
    if (e.dataTransfer.files[0]) { imageInput.files = e.dataTransfer.files; handleImagePreview(e.dataTransfer.files[0]); }
  });

  imageInput.addEventListener('change', () => { if (imageInput.files[0]) handleImagePreview(imageInput.files[0]); });

  function handleImagePreview(file) {
    previewImg.src = URL.createObjectURL(file);
    previewName.textContent = file.name;
    document.getElementById('upload-placeholder').classList.add('hidden');
    preview.classList.remove('hidden');
  }

  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    imageInput.value = '';
    preview.classList.add('hidden');
    document.getElementById('upload-placeholder').classList.remove('hidden');
  });

  btn.addEventListener('click', async () => {
    const productId = select.value;
    const from = document.getElementById('tx-from').value;
    const to = document.getElementById('tx-to').value;
    const status = statusSel.value;
    const notes = document.getElementById('tx-notes').value.trim();
    if (!productId) { showToast('Please select a product.', 'error'); return; }

    const formData = new FormData();
    formData.append('productId', productId);
    formData.append('from', from);
    formData.append('to', to);
    formData.append('status', status);
    formData.append('notes', notes);
    if (imageInput.files[0]) formData.append('image', imageInput.files[0]);

    showMining();
    try {
      const data = await apiPostForm('/api/transactions', formData);
      hideMining(data.block);
      showToast(data.message, data.mined ? 'success' : 'info');
      document.getElementById('tx-notes').value = '';
      imageInput.value = '';
      preview.classList.add('hidden');
      document.getElementById('upload-placeholder').classList.remove('hidden');
      renderAll(data);
    } catch (err) { hideMining(); showToast(err.message, 'error'); }
  });
}

function updateSmartContractPreview() {
  const productId = document.getElementById('tx-product-select').value;
  const status = document.getElementById('tx-status').value;
  const preview = document.getElementById('smart-contract-preview');
  const body = document.getElementById('smart-contract-body');
  if (!productId) { preview.style.display = 'none'; return; }
  const product = currentChainData.products[productId];
  if (!product || product.insuranceType === 'None') { preview.style.display = 'none'; return; }
  const claimMap = { 'Basic': status === 'Damaged' ? 'Approved' : 'Denied', 'Premium': ['Damaged','Lost'].includes(status) ? 'Approved' : 'Denied', 'Full Protection': ['Damaged','Lost','In Transit'].includes(status) ? 'Approved' : 'Denied' };
  const claim = claimMap[product.insuranceType] || 'Pending';
  const color = claim === 'Approved' ? '#22c55e' : claim === 'Denied' ? '#ef4444' : '#f59e0b';
  body.innerHTML = `<div class="sc-row"><span>Insurance:</span><span class="insurance-badge insurance-badge--${product.insuranceType.toLowerCase().replace(' ','-')}">${product.insuranceType}</span></div><div class="sc-row"><span>Status Trigger:</span><strong>${status}</strong></div><div class="sc-row"><span>Claim Decision:</span><strong style="color:${color}">${claim === 'Approved' ? '✅' : claim === 'Denied' ? '❌' : '⏳'} ${claim}</strong></div><div class="sc-row"><span>Max Payout:</span><strong>$${product.maxClaim.toLocaleString()}</strong></div>`;
  preview.style.display = 'block';
}

function initExplorer() {
  document.getElementById('explorer-filter').addEventListener('change', () => {
    const val = document.getElementById('explorer-filter').value;
    let blocks = currentChainData.chain;
    if (val !== 'all') {
      const p = currentChainData.products[val];
      if (p) blocks = currentChainData.chain.filter(b => b.transactions && b.transactions.some(t => t.productId === val));
      else blocks = [];
    }
    renderBlockchain(blocks);
  });
}

function renderBlockchain(chain) {
  const container = document.getElementById('blockchain-explorer');
  if (!chain || chain.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⛓️</div><h3 class="empty-state__title">No Blocks Yet</h3><p class="empty-state__description">Create a product to generate the first block.</p></div>`;
    return;
  }

  const validMap = {};
  lastValidationResults.forEach(r => { validMap[r.blockIndex] = r.valid; });

  let html = '<div class="blockchain-chain">';

  chain.forEach((block, i) => {
    const hasValidation = Object.keys(validMap).length > 0;
    const isValid = hasValidation ? (validMap[block.index] !== false) : true;
    const isGenesis = block.index === 0;
    const txs = block.transactions || [];

    // Chain connector between blocks
    if (i > 0) {
      html += `<div class="chain-link ${!isValid ? 'chain-link--invalid' : ''}"><div class="chain-link__line"></div></div>`;
    }

    const validDotClass = !isValid ? 'block-card__valid-dot block-card__valid-dot--invalid' : 'block-card__valid-dot';
    const cardClass = `block-card ${isGenesis ? 'block-card--genesis' : ''} ${!isValid ? 'block-card--invalid' : ''}`;

    html += `<div class="block-wrapper" style="animation-delay:${i * 0.07}s">
      <div class="${cardClass}">

        <!-- Header: block index + tx count + validity dot -->
        <div class="block-card__head">
          <span class="block-card__index-pill">${isGenesis ? 'Genesis' : `Block #${block.index}`}</span>
          <div class="block-card__head-right">
            <span class="block-card__tx-badge">${txs.length} tx</span>
            ${!isValid ? '<span class="block-card__invalid-badge">TAMPERED</span>' : ''}
            <span class="${validDotClass}" title="${isValid ? 'Valid block' : 'Tampered — hash mismatch'}"></span>
          </div>
        </div>

        <!-- Meta: timestamp + nonce -->
        <div class="block-card__meta">
          <span class="block-card__timestamp">🕐 ${formatTimestamp(block.timestamp)}</span>
          <span class="block-card__nonce" title="Proof-of-Work nonce">⛏ ${block.nonce.toLocaleString()}</span>
        </div>

        <!-- Transactions list -->
        <div class="block-txs">`;

    if (txs.length === 0) {
      html += `<div style="padding:8px;text-align:center;font-size:12px;color:#475569;">No transactions</div>`;
    }

    txs.forEach(tx => {
      const insType = tx.insuranceType && tx.insuranceType !== 'None'
        ? `<div class="tx-insurance-row">
             <span class="insurance-badge insurance-badge--${tx.insuranceType.toLowerCase().replace(/ /g,'-')}">${tx.insuranceType}</span>
             <span class="claim-badge claim-badge--${claimClass(tx.claimStatus)}">${tx.claimStatus}</span>
           </div>`
        : '';

      const imgBlock = tx.imageUrl
        ? `<div class="tx-image-preview">
             <img src="${tx.imageUrl}" alt="product" onerror="this.style.display='none'">
             <div class="tx-hash-chip" title="SHA-256: ${tx.imageHash}">🔐 ${tx.imageHash ? tx.imageHash.substring(0,14)+'…' : 'no hash'}</div>
           </div>`
        : '';

      html += `<div class="tx-card" onclick="showProductHistory('${tx.productId}')">
        <div class="tx-card__row1">
          <span class="tx-status-badge tx-status--${statusClass(tx.status)}">${tx.status}</span>
          ${tx.imageUrl ? '<span class="tx-img-icon" title="Has image attachment">📎</span>' : ''}
        </div>
        <div class="tx-card__product">${escapeHtml(tx.productName)}</div>
        <div class="tx-card__route">
          <span>${escapeHtml(tx.from)}</span>
          <span class="tx-card__route-arrow">→</span>
          <span>${escapeHtml(tx.to)}</span>
        </div>
        ${imgBlock}
        ${insType}
      </div>`;
    });

    // Hash details footer
    const shortHash = block.hash ? block.hash.substring(0, 20) + '…' : '—';
    const shortPrev = block.previousHash ? block.previousHash.substring(0, 20) + '…' : '—';

    html += `</div>

        <!-- Hash Footer -->
        <div class="block-card__details">
          <div class="block-detail">
            <span class="block-detail__label">Block Hash</span>
            <div class="block-detail__row">
              <span class="block-detail__value block-detail__value--hash" title="${block.hash}">${shortHash}</span>
              <button class="copy-btn" title="Copy hash" onclick="event.stopPropagation();copyHash(this,'${block.hash}')">⎘</button>
            </div>
          </div>
          <div class="block-detail">
            <span class="block-detail__label">Previous Hash</span>
            <div class="block-detail__row">
              <span class="block-detail__value block-detail__value--prev" title="${block.previousHash}">${shortPrev}</span>
              <button class="copy-btn" title="Copy prev hash" onclick="event.stopPropagation();copyHash(this,'${block.previousHash}')">⎘</button>
            </div>
          </div>
        </div>

      </div>
    </div>`;
  });

  html += '</div>';
  container.innerHTML = html;
}

function copyHash(btn, hash) {
  navigator.clipboard.writeText(hash).then(() => {
    btn.textContent = '✓';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = '⎘'; btn.classList.remove('copied'); }, 1800);
  }).catch(() => {
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = '⎘'; }, 1200);
  });
}

function renderPendingPool(pending) {
  const section = document.getElementById('pending-pool-section');
  const list = document.getElementById('pending-pool-list');
  if (!pending || pending.length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';

  list.innerHTML = `<div class="pending-pool-header">
    <div class="pending-pool-header__icon">⏳</div>
    <div>
      <div class="pending-pool-header__title">Pending Transaction Pool</div>
      <div class="pending-pool-header__desc">${pending.length} transaction${pending.length !== 1 ? 's' : ''} waiting — auto-mines at 3</div>
    </div>
  </div>
  <div class="pending-pool-grid">
    ${pending.map(tx => `
    <div class="tx-card tx-card--pending">
      <div class="tx-card__row1">
        <span class="pending-label">⏳ Pending</span>
        <span class="tx-status-badge tx-status--${statusClass(tx.status)}">${tx.status}</span>
      </div>
      <div class="tx-card__product">${escapeHtml(tx.productName)}</div>
      <div class="tx-card__route">
        <span>${escapeHtml(tx.from)}</span>
        <span class="tx-card__route-arrow">→</span>
        <span>${escapeHtml(tx.to)}</span>
      </div>
    </div>`).join('')}
  </div>`;
}

// ─── Insurance Panel ───────────────────────────────────────────────────────────
function renderInsurance(products) {
  const list = document.getElementById('insurance-list');
  const insured = Object.values(products).filter(p => p.insuranceType && p.insuranceType !== 'None');
  if (insured.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state__icon">📋</div><h3 class="empty-state__title">No Insured Products</h3><p class="empty-state__description">Create products with insurance to see smart contract evaluations here.</p></div>`;
    return;
  }
  list.innerHTML = insured.map(p => {
    const cl = claimClass(p.claimStatus);
    const icon = p.claimStatus === 'Approved' ? '✅' : p.claimStatus === 'Denied' ? '❌' : p.claimStatus === 'Pending' ? '⏳' : '—';
    return `<div class="insurance-card card" onclick="showProductHistory('${p.id}')">
      <div class="insurance-card__header">
        <div><div class="insurance-card__name">${escapeHtml(p.name)}</div><div class="insurance-card__id">${escapeHtml(p.id)}</div></div>
        <span class="insurance-badge insurance-badge--${p.insuranceType.toLowerCase().replace(' ','-')}">${p.insuranceType}</span>
      </div>
      <div class="insurance-card__body">
        <div class="insurance-stat"><span>Max Claim</span><strong>$${p.maxClaim.toLocaleString()}</strong></div>
        <div class="insurance-stat"><span>Current Status</span><span class="tx-status-badge tx-status--${statusClass(p.currentStatus)}">${p.currentStatus}</span></div>
        <div class="insurance-stat"><span>Smart Contract</span><span class="claim-badge claim-badge--${cl}">${icon} ${p.claimStatus}</span></div>
        <div class="insurance-stat"><span>Transactions</span><strong>${p.txCount || 0}</strong></div>
      </div>
    </div>`;
  }).join('');
}

// ─── QR Grid ──────────────────────────────────────────────────────────────────
function renderQRGrid(products) {
  const grid = document.getElementById('qr-grid');
  const list = Object.values(products);
  if (list.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state__icon">📱</div><h3 class="empty-state__title">No QR Codes Yet</h3><p class="empty-state__description">QR codes are generated automatically when you create products.</p></div>`;
    return;
  }
  grid.innerHTML = `<div class="qr-grid">${list.map(p => `
    <div class="qr-card card" onclick="showProductHistory('${p.id}')">
      <div class="qr-card__img-wrap">
        ${p.qrCodeUrl ? `<img src="${p.qrCodeUrl}?v=${Date.now()}" alt="QR for ${p.name}" class="qr-card__img" onerror="this.parentElement.innerHTML='<div class=qr-placeholder>📱</div>'">` : `<div class="qr-placeholder">📱</div>`}
      </div>
      <div class="qr-card__info">
        <div class="qr-card__name">${escapeHtml(p.name)}</div>
        <div class="qr-card__id">${escapeHtml(p.id)}</div>
        <div class="tx-status-badge tx-status--${statusClass(p.currentStatus)}" style="margin-top:6px">${p.currentStatus}</div>
      </div>
      <div class="qr-card__scan">👆 Click to view history</div>
    </div>`).join('')}
  </div>`;
}

// ─── Product History Modal ────────────────────────────────────────────────────
async function showProductHistory(productId) {
  const modal = document.getElementById('history-modal');
  const bodyEl = document.getElementById('modal-body');
  const nameEl = document.getElementById('modal-product-name');
  const idEl = document.getElementById('modal-product-id');
  modal.classList.remove('hidden');
  bodyEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary)">Loading history…</div>';
  try {
    const data = await apiGet(`/api/products/${productId}/chain`);
    const p = data.product;
    nameEl.textContent = p.name;
    idEl.textContent = `${p.id} · ${p.insuranceType} Insurance`;
    const txs = data.transactions;
    if (!txs.length) { bodyEl.innerHTML = '<div class="empty-state"><p>No transactions found.</p></div>'; return; }
    bodyEl.innerHTML = `<div class="history-timeline">${txs.map((tx, i) => `
      <div class="timeline-item">
        <div class="timeline-dot timeline-dot--${statusClass(tx.status)}"></div>
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="tx-status-badge tx-status--${statusClass(tx.status)}">${tx.status}</span>
            ${tx.pending ? '<span class="pending-label">⏳ PENDING</span>' : ''}
            <span class="timeline-time">${formatTimestamp(tx.timestamp)}</span>
          </div>
          <div class="timeline-route">${escapeHtml(tx.from)} → ${escapeHtml(tx.to)}</div>
          ${tx.notes ? `<div class="timeline-notes">${escapeHtml(tx.notes)}</div>` : ''}
          ${tx.imageUrl ? `<div class="timeline-image"><img src="${tx.imageUrl}" alt="product image" class="timeline-img" onerror="this.style.display='none'"><div class="tx-hash-chip">🔐 SHA-256: ${tx.imageHash ? tx.imageHash.substring(0,20)+'…' : 'N/A'}</div></div>` : ''}
          ${tx.insuranceType !== 'None' ? `<div class="timeline-insurance"><span class="insurance-badge insurance-badge--${tx.insuranceType.toLowerCase().replace(' ','-')}">${tx.insuranceType}</span><span class="claim-badge claim-badge--${claimClass(tx.claimStatus)}">${tx.claimStatus === 'Approved' ? '✅' : tx.claimStatus === 'Denied' ? '❌' : '⏳'} ${tx.claimStatus}</span></div>` : ''}
        </div>
      </div>`).join('')}</div>`;
  } catch (err) {
    bodyEl.innerHTML = `<div class="empty-state"><p>Error: ${escapeHtml(err.message)}</p></div>`;
  }
}

document.getElementById('modal-close').addEventListener('click', () => document.getElementById('history-modal').classList.add('hidden'));
document.getElementById('history-modal').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden'); });

// ─── Validation ───────────────────────────────────────────────────────────────
function initValidation() {
  document.getElementById('btn-validate-chain').addEventListener('click', async () => {
    try {
      const result = await apiGet('/api/validate');
      if (result.message && !result.results.length) { showToast(result.message, 'error'); return; }
      lastValidationResults = result.results || [];
      const ok = result.isValid;
      let html = `<div class="validation-result validation-result--${ok ? 'valid' : 'invalid'}"><div class="validation-result__header"><span>${ok ? '✅' : '❌'}</span><span class="validation-result__title validation-result__title--${ok ? 'valid' : 'invalid'}">${ok ? 'Blockchain is Valid!' : 'Blockchain INVALID — Tampering Detected!'}</span></div><div class="validation-result__details">`;
      result.results.forEach(r => {
        html += `<div class="validation-block-result validation-block-result--${r.valid ? 'valid' : 'invalid'}"><span>${r.valid ? '✅' : '❌'}</span><span>Block #${r.blockIndex} (${r.txCount} tx): ${r.reason}</span></div>`;
      });
      html += '</div></div>';
      document.getElementById('validation-results').innerHTML = html;
      await loadChainFromServer();
      renderBlockchain(currentChainData.chain);
    } catch (err) { showToast(err.message, 'error'); }
  });
}

// ─── Tamper ───────────────────────────────────────────────────────────────────
function initTamper() {
  const blockSel = document.getElementById('tamper-block-select');
  const txSel = document.getElementById('tamper-tx-select');
  const btn = document.getElementById('btn-tamper');
  const reset = document.getElementById('btn-reset-chain');
  blockSel.addEventListener('change', () => {
    btn.disabled = !blockSel.value;
    if (!blockSel.value) return;
    const block = currentChainData.chain[parseInt(blockSel.value)];
    txSel.innerHTML = block ? block.transactions.map((tx, i) => `<option value="${i}">[${i}] ${tx.productName} — ${tx.status}</option>`).join('') : '';
  });
  btn.addEventListener('click', async () => {
    const blockIndex = parseInt(blockSel.value, 10);
    const txIndex = parseInt(txSel.value, 10);
    const newStatus = document.getElementById('tamper-new-status').value;
    if (isNaN(blockIndex)) { showToast('Please select a block.', 'error'); return; }
    try {
      const data = await apiPost('/api/tamper', { blockIndex, txIndex, newStatus });
      showToast(data.message, 'error');
      renderAll(data);
    } catch (err) { showToast(err.message, 'error'); }
  });
  reset.addEventListener('click', async () => {
    if (!confirm('Reset the entire blockchain? This cannot be undone.')) return;
    try { const data = await apiPost('/api/reset', {}); showToast('Blockchain reset.', 'info'); renderAll(data); }
    catch (err) { showToast(err.message, 'error'); }
  });
}

// ─── Demo Data ────────────────────────────────────────────────────────────────
async function loadDemoData() {
  if (currentChainData.chain.length > 0 && !confirm('This will REPLACE your existing chain. Continue?')) return;
  showToast('⛏️ Mining 5 demo blocks on server… please wait.', 'info');
  try {
    const data = await apiPost('/api/seed', {});
    showToast(data.message, 'success');
    renderAll(data);
    document.getElementById('tab-explorer').click();
  } catch (err) { showToast(`Failed: ${err.message}`, 'error'); }
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function renderStats(stats) {
  document.getElementById('stat-blocks').textContent = stats.totalBlocks;
  document.getElementById('stat-transactions').textContent = stats.totalTransactions || 0;
  document.getElementById('stat-products').textContent = stats.totalProducts;
  document.getElementById('stat-pending').textContent = stats.pendingCount || 0;
  document.getElementById('stat-difficulty').textContent = stats.difficulty;
  document.getElementById('stat-status').textContent = stats.isValid === null ? '—' : stats.isValid ? '✅' : '❌';
}

function renderPendingBanner(count) {
  const banner = document.getElementById('pending-banner');
  const label = document.getElementById('pending-count-label');
  if (count > 0) {
    banner.style.display = 'flex';
    label.textContent = `${count} transaction${count !== 1 ? 's' : ''}`;
  } else {
    banner.style.display = 'none';
  }
}

function renderProductSelects(products) {
  const list = Object.values(products);
  ['tx-product-select', 'explorer-filter'].forEach(id => {
    const sel = document.getElementById(id);
    const cur = sel.value;
    sel.innerHTML = id === 'explorer-filter' ? '<option value="all">🔗 All Blocks</option>' : '<option value="">-- Choose a product --</option>';
    list.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${id === 'explorer-filter' ? '📦 ' : ''}${p.name} (${p.id})`;
      sel.appendChild(opt);
    });
    if (cur && sel.querySelector(`option[value="${cur}"]`)) sel.value = cur;
  });
  document.getElementById('btn-add-transaction').disabled = !document.getElementById('tx-product-select').value;
}

function renderTamperSelect(chain) {
  const sel = document.getElementById('tamper-block-select');
  const cur = sel.value;
  sel.innerHTML = '<option value="">-- Choose a block --</option>';
  chain.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.index;
    opt.textContent = `Block #${b.index} — ${b.transactions.length} transactions`;
    sel.appendChild(opt);
  });
  if (cur && sel.querySelector(`option[value="${cur}"]`)) sel.value = cur;
  document.getElementById('btn-tamper').disabled = !sel.value;
}

// ─── Mining Overlay ───────────────────────────────────────────────────────────
function showMining() { document.getElementById('mining-overlay').classList.remove('hidden'); }
function hideMining(block) {
  const overlay = document.getElementById('mining-overlay');
  if (block) {
    document.getElementById('mining-hash').textContent = block.hash || 'Done';
    document.getElementById('mining-nonce').textContent = block.nonce ? block.nonce.toLocaleString() : '—';
    setTimeout(() => overlay.classList.add('hidden'), 900);
  } else { overlay.classList.add('hidden'); }
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<span class="toast__icon">${icons[type] || icons.info}</span><span class="toast__message">${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('toast--removing'); setTimeout(() => toast.remove(), 300); }, 5000);
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function escapeHtml(text) {
  const d = document.createElement('div'); d.textContent = String(text); return d.innerHTML;
}
function formatTimestamp(iso) {
  try { return new Date(iso).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}
function statusClass(s) {
  const m = { 'Created': 'created', 'In Warehouse': 'warehouse', 'In Transit': 'transit', 'Delivered': 'delivered', 'Damaged': 'damaged', 'Lost': 'lost' };
  return m[s] || 'default';
}
function claimClass(c) {
  const m = { 'Approved': 'approved', 'Denied': 'denied', 'Pending': 'pending', 'Not Insured': 'none', 'Not Required': 'none' };
  return m[c] || 'pending';
}
