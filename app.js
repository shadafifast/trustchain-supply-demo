/**
 * TrustChain – App Controller
 * UI Logic | Rendering | Interactions
 */

// ─── Initialize ─────────────────────────────────────────────────────────────────
let blockchain = Blockchain.load();

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initCreateProduct();
  initUpdateLocation();
  initExplorer();
  initValidation();
  initTamper();
  refreshAll();
});


// ─── Tab Navigation ─────────────────────────────────────────────────────────────
function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Deactivate all tabs and panels
      tabs.forEach(t => t.classList.remove('nav-tab--active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('tab-panel--active'));

      // Activate selected
      tab.classList.add('nav-tab--active');
      const panelId = `panel-${tab.dataset.tab}`;
      document.getElementById(panelId).classList.add('tab-panel--active');

      // Refresh relevant panels
      if (tab.dataset.tab === 'explorer') renderBlockchain();
      if (tab.dataset.tab === 'update') refreshProductSelects();
      if (tab.dataset.tab === 'tamper') refreshTamperSelect();
      if (tab.dataset.tab === 'validate') clearValidation();
    });
  });
}


// ─── Create Product ─────────────────────────────────────────────────────────────
function initCreateProduct() {
  const btn = document.getElementById('btn-create-product');
  const nameInput = document.getElementById('product-name');
  const idInput = document.getElementById('product-id');

  btn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    const id = idInput.value.trim();

    if (!name) { showToast('Please enter a product name.', 'error'); nameInput.focus(); return; }
    if (!id) { showToast('Please enter a product ID.', 'error'); idInput.focus(); return; }

    try {
      showMining();

      // Use setTimeout to allow the mining overlay to render before the synchronous mining
      setTimeout(() => {
        try {
          const { block, iterations } = blockchain.createProduct(name, id);
          blockchain.save();

          hideMining(block);
          showToast(`✅ Product "${name}" created! Genesis block mined in ${iterations.toLocaleString()} iterations.`, 'success');

          nameInput.value = '';
          idInput.value = '';
          refreshAll();
        } catch (err) {
          hideMining();
          showToast(`❌ ${err.message}`, 'error');
        }
      }, 100);

    } catch (err) {
      hideMining();
      showToast(`❌ ${err.message}`, 'error');
    }
  });
}


// ─── Update Location ────────────────────────────────────────────────────────────
function initUpdateLocation() {
  const btn = document.getElementById('btn-update-location');
  const select = document.getElementById('update-product-select');
  const locationInput = document.getElementById('update-location');

  select.addEventListener('change', () => {
    btn.disabled = !select.value;
  });

  btn.addEventListener('click', () => {
    const productId = select.value;
    const location = locationInput.value.trim();

    if (!productId) { showToast('Please select a product.', 'error'); return; }
    if (!location) { showToast('Please enter a new location.', 'error'); locationInput.focus(); return; }

    showMining();

    setTimeout(() => {
      try {
        const { block, iterations } = blockchain.updateLocation(productId, location);
        blockchain.save();

        hideMining(block);
        showToast(`📍 Location updated to "${location}"! Block mined in ${iterations.toLocaleString()} iterations.`, 'success');

        locationInput.value = '';
        refreshAll();
      } catch (err) {
        hideMining();
        showToast(`❌ ${err.message}`, 'error');
      }
    }, 100);
  });
}


// ─── Explorer ───────────────────────────────────────────────────────────────────
function initExplorer() {
  const filter = document.getElementById('explorer-filter');
  filter.addEventListener('change', renderBlockchain);
}

function renderBlockchain() {
  const container = document.getElementById('blockchain-explorer');
  const filter = document.getElementById('explorer-filter').value;

  let blocks;
  if (filter === 'all') {
    blocks = blockchain.chain;
  } else {
    blocks = blockchain.getProductChain(filter);
  }

  if (blocks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⛓️</div>
        <h3 class="empty-state__title">No Blocks Yet</h3>
        <p class="empty-state__description">Create a product to generate the first block in the chain.</p>
      </div>
    `;
    return;
  }

  // Validate chain for status indicators
  const validation = blockchain.isChainValid();
  const validMap = {};
  validation.results.forEach(r => { validMap[r.blockIndex] = r.valid; });

  let html = '<div class="blockchain-chain">';

  blocks.forEach((block, i) => {
    const isGenesis = block.index === 0 || 
      (blockchain.products[block.productId] && 
       blockchain.products[block.productId].blockIndices[0] === block.index);
    const isValid = validMap[block.index] !== false;
    const delay = i * 0.08;

    // Chain link (not before first block)
    if (i > 0) {
      html += `
        <div class="chain-link ${!isValid ? 'chain-link--invalid' : ''}">
          <div class="chain-link__line"></div>
        </div>
      `;
    }

    html += `
      <div class="block-wrapper" style="animation-delay: ${delay}s">
        <div class="block-card ${isGenesis ? 'block-card--genesis' : ''} ${!isValid ? 'block-card--invalid' : ''}">
          <div class="block-card__header">
            <span class="block-card__index">Block #${block.index}</span>
            ${isGenesis ? '<span class="block-card__genesis-badge">GENESIS</span>' : ''}
            <span class="block-card__status ${!isValid ? 'block-card__status--invalid' : ''}"></span>
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
          <div class="block-card__timestamp">
            🕐 ${formatTimestamp(block.timestamp)}
          </div>
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}


// ─── Validation ─────────────────────────────────────────────────────────────────
function initValidation() {
  document.getElementById('btn-validate-chain').addEventListener('click', () => {
    if (blockchain.chain.length === 0) {
      showToast('No blocks to validate. Create a product first.', 'error');
      return;
    }

    const result = blockchain.isChainValid();
    const container = document.getElementById('validation-results');

    const statusClass = result.isValid ? 'valid' : 'invalid';
    const statusIcon = result.isValid ? '✅' : '❌';
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
      const blockClass = r.valid ? 'valid' : 'invalid';
      const blockIcon = r.valid ? '✅' : '❌';
      html += `
        <div class="validation-block-result validation-block-result--${blockClass}">
          <span class="validation-block-result__icon">${blockIcon}</span>
          <span class="validation-block-result__text">
            Block #${r.blockIndex}: ${r.reason}
          </span>
        </div>
      `;
    });

    html += '</div></div>';
    container.innerHTML = html;

    // Update status
    refreshStats();
    // Also re-render explorer to show invalid blocks
    renderBlockchain();
  });
}

function clearValidation() {
  document.getElementById('validation-results').innerHTML = '';
}


// ─── Tamper Test ────────────────────────────────────────────────────────────────
function initTamper() {
  const select = document.getElementById('tamper-block-select');
  const locationInput = document.getElementById('tamper-new-location');
  const btnTamper = document.getElementById('btn-tamper');
  const btnReset = document.getElementById('btn-reset-chain');

  select.addEventListener('change', () => {
    btnTamper.disabled = !select.value;
  });

  btnTamper.addEventListener('click', () => {
    const blockIndex = parseInt(select.value, 10);
    const newLocation = locationInput.value.trim();

    if (isNaN(blockIndex)) { showToast('Please select a block.', 'error'); return; }
    if (!newLocation) { showToast('Please enter a fake location.', 'error'); locationInput.focus(); return; }

    try {
      blockchain.tamperBlock(blockIndex, newLocation);
      blockchain.save();

      showToast(`💀 Block #${blockIndex} tampered! Location changed to "${newLocation}". Go to Validate Chain to see the effect.`, 'error');

      locationInput.value = '';
      refreshAll();
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error');
    }
  });

  btnReset.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset the entire blockchain? This cannot be undone.')) {
      blockchain = new Blockchain();
      blockchain.save();
      showToast('🔄 Blockchain has been reset.', 'info');
      refreshAll();
    }
  });
}

function refreshTamperSelect() {
  const select = document.getElementById('tamper-block-select');
  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Choose a block --</option>';

  blockchain.chain.forEach(block => {
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


// ─── Product Select Dropdowns ───────────────────────────────────────────────────
function refreshProductSelects() {
  const products = blockchain.getProductList();

  // Update location select
  const updateSelect = document.getElementById('update-product-select');
  const currentUpdateVal = updateSelect.value;
  updateSelect.innerHTML = '<option value="">-- Choose a product --</option>';
  products.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} (${p.id})`;
    updateSelect.appendChild(opt);
  });
  if (currentUpdateVal && updateSelect.querySelector(`option[value="${currentUpdateVal}"]`)) {
    updateSelect.value = currentUpdateVal;
  }
  document.getElementById('btn-update-location').disabled = !updateSelect.value;

  // Explorer filter
  const explorerFilter = document.getElementById('explorer-filter');
  const currentFilterVal = explorerFilter.value;
  explorerFilter.innerHTML = '<option value="all">🔗 All Blocks</option>';
  products.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `📦 ${p.name} (${p.id})`;
    explorerFilter.appendChild(opt);
  });
  if (currentFilterVal && explorerFilter.querySelector(`option[value="${currentFilterVal}"]`)) {
    explorerFilter.value = currentFilterVal;
  }
}


// ─── Stats Bar ──────────────────────────────────────────────────────────────────
function refreshStats() {
  document.getElementById('stat-blocks').textContent = blockchain.chain.length;
  document.getElementById('stat-products').textContent = Object.keys(blockchain.products).length;
  document.getElementById('stat-difficulty').textContent = blockchain.difficulty;

  if (blockchain.chain.length > 0) {
    const valid = blockchain.isChainValid().isValid;
    document.getElementById('stat-status').textContent = valid ? '✅' : '❌';
  } else {
    document.getElementById('stat-status').textContent = '—';
  }
}


// ─── Refresh Everything ─────────────────────────────────────────────────────────
function refreshAll() {
  refreshStats();
  refreshProductSelects();
  refreshTamperSelect();

  // If explorer is visible, re-render
  const explorerPanel = document.getElementById('panel-explorer');
  if (explorerPanel.classList.contains('tab-panel--active')) {
    renderBlockchain();
  }
}


// ─── Mining Overlay ─────────────────────────────────────────────────────────────
function showMining() {
  document.getElementById('mining-overlay').classList.remove('hidden');
  document.getElementById('mining-hash').textContent = 'Calculating hash...';
  document.getElementById('mining-nonce').textContent = '0';
}

function hideMining(block) {
  const overlay = document.getElementById('mining-overlay');

  if (block) {
    document.getElementById('mining-hash').textContent = block.hash;
    document.getElementById('mining-nonce').textContent = block.nonce.toLocaleString();

    // Show result briefly before hiding
    setTimeout(() => {
      overlay.classList.add('hidden');
    }, 800);
  } else {
    overlay.classList.add('hidden');
  }
}


// ─── Toast Notifications ────────────────────────────────────────────────────────
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

  // Auto-remove after 5 seconds
  setTimeout(() => {
    toast.classList.add('toast--removing');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}


// ─── Utilities ──────────────────────────────────────────────────────────────────
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTimestamp(isoString) {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return isoString;
  }
}
