/**
 * TrustChain v2.0 – Blockchain Engine (Node.js)
 * SHA-256 via Node crypto | Proof of Work | Multi-Transaction Blocks
 * Insurance Smart Contract | Image Hash Verification | Status Tracking
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.json');

// ─── Constants ───────────────────────────────────────────────────────────────
const TX_THRESHOLD = 3; // Mine a new block after this many pending transactions

// ─── SHA-256 helpers ─────────────────────────────────────────────────────────
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function sha256File(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  } catch {
    return null;
  }
}

// ─── Product Status enum ─────────────────────────────────────────────────────
const PRODUCT_STATUSES = ['Created', 'In Warehouse', 'In Transit', 'Delivered', 'Damaged', 'Lost'];

// ─── Insurance Types ─────────────────────────────────────────────────────────
const INSURANCE_TYPES = {
  None: { label: 'No Insurance', maxClaim: 0 },
  Basic: { label: 'Basic', maxClaim: 1000 },
  Premium: { label: 'Premium', maxClaim: 5000 },
  'Full Protection': { label: 'Full Protection', maxClaim: 15000 }
};

// ─── Smart Contract: Insurance Claim Evaluator ───────────────────────────────
function evaluateClaim(insuranceType, status) {
  if (!insuranceType || insuranceType === 'None') return 'Not Insured';
  if (status === 'Delivered') return 'Not Required';

  switch (insuranceType) {
    case 'Basic':
      if (status === 'Damaged') return 'Approved';
      return 'Denied';

    case 'Premium':
      if (status === 'Damaged' || status === 'Lost') return 'Approved';
      return 'Denied';

    case 'Full Protection':
      if (['Damaged', 'Lost', 'In Transit'].includes(status)) return 'Approved';
      return 'Denied';

    default:
      return 'Pending';
  }
}

// ─── Transaction Class ───────────────────────────────────────────────────────
class Transaction {
  constructor({
    productId,
    productName,
    from,
    to,
    status,
    timestamp,
    imageUrl = null,
    imageHash = null,
    insuranceType = 'None',
    claimStatus = 'Not Insured',
    maxClaim = 0,
    notes = ''
  }) {
    this.productId = productId;
    this.productName = productName;
    this.from = from;
    this.to = to;
    this.status = status;
    this.timestamp = timestamp || new Date().toISOString();
    this.imageUrl = imageUrl;
    this.imageHash = imageHash;
    this.insuranceType = insuranceType;
    this.claimStatus = claimStatus;
    this.maxClaim = maxClaim;
    this.notes = notes;
  }

  toJSON() {
    return {
      productId: this.productId,
      productName: this.productName,
      from: this.from,
      to: this.to,
      status: this.status,
      timestamp: this.timestamp,
      imageUrl: this.imageUrl,
      imageHash: this.imageHash,
      insuranceType: this.insuranceType,
      claimStatus: this.claimStatus,
      maxClaim: this.maxClaim,
      notes: this.notes
    };
  }

  static fromJSON(data) {
    return new Transaction(data);
  }
}


// ─── Block Class ─────────────────────────────────────────────────────────────
class Block {
  constructor(index, transactions, previousHash = '') {
    this.index = index;
    this.transactions = transactions; // Array of Transaction
    this.previousHash = previousHash;
    this.nonce = 0;
    this.timestamp = new Date().toISOString();
    this.hash = '';
  }

  calculateHash() {
    const txData = JSON.stringify(this.transactions.map(t => t.toJSON()));
    const data = `${this.index}${this.timestamp}${txData}${this.previousHash}${this.nonce}`;
    return sha256(data);
  }

  mineBlock(difficulty) {
    const target = '0'.repeat(difficulty);
    let iterations = 0;
    while (this.hash.substring(0, difficulty) !== target) {
      this.nonce++;
      this.hash = this.calculateHash();
      iterations++;
    }
    return iterations;
  }

  toJSON() {
    return {
      index: this.index,
      transactions: this.transactions.map(t => t.toJSON()),
      previousHash: this.previousHash,
      nonce: this.nonce,
      timestamp: this.timestamp,
      hash: this.hash
    };
  }

  static fromJSON(data) {
    const block = new Block(
      data.index,
      data.transactions.map(t => Transaction.fromJSON(t)),
      data.previousHash
    );
    block.nonce = data.nonce;
    block.timestamp = data.timestamp;
    block.hash = data.hash;
    return block;
  }
}


// ─── Blockchain Class ─────────────────────────────────────────────────────────
class Blockchain {
  constructor(difficulty = 3) {
    this.chain = [];
    this.difficulty = difficulty;
    this.products = {};           // productId → product metadata
    this.pendingPool = {};        // productId → Transaction[]  (not yet mined)
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  // ─── Mine pending pool (all products combined) into one block ─────────────
  _minePendingBlock() {
    const allPending = Object.values(this.pendingPool).flat();
    if (allPending.length === 0) return null;

    const previousHash = this.chain.length > 0 ? this.getLatestBlock().hash : '0'.repeat(64);
    const block = new Block(this.chain.length, allPending, previousHash);
    const iterations = block.mineBlock(this.difficulty);
    this.chain.push(block);

    // Register block index on each product
    allPending.forEach(tx => {
      if (this.products[tx.productId]) {
        const productMeta = this.products[tx.productId];
        if (!productMeta.blockIndices.includes(block.index)) {
          productMeta.blockIndices.push(block.index);
        }
      }
    });

    // Clear pool
    Object.keys(this.pendingPool).forEach(k => { this.pendingPool[k] = []; });

    return { block, iterations };
  }

  // ─── Create Product ───────────────────────────────────────────────────────
  createProduct({ name, id, insuranceType = 'None', notes = '' }) {
    if (this.products[id]) {
      throw new Error(`Product with ID "${id}" already exists.`);
    }

    const timestamp = new Date().toISOString();
    const maxClaim = INSURANCE_TYPES[insuranceType]?.maxClaim ?? 0;
    const claimStatus = insuranceType === 'None' ? 'Not Insured' : 'Pending';

    const tx = new Transaction({
      productId: id,
      productName: name,
      from: 'System',
      to: 'Factory',
      status: 'Created',
      timestamp,
      insuranceType,
      claimStatus,
      maxClaim,
      notes
    });

    // Register product metadata
    this.products[id] = {
      name,
      id,
      createdAt: timestamp,
      currentStatus: 'Created',
      insuranceType,
      claimStatus,
      maxClaim,
      blockIndices: [],
      txCount: 0
    };

    // Genesis tx always mines immediately (no pool wait)
    if (!this.pendingPool[id]) this.pendingPool[id] = [];
    this.pendingPool[id].push(tx);
    this.products[id].txCount++;

    return this._minePendingBlock();
  }

  // ─── Add Transaction ──────────────────────────────────────────────────────
  addTransaction({ productId, from, to, status, imageUrl = null, imageFilePath = null, notes = '' }) {
    const product = this.products[productId];
    if (!product) throw new Error(`Product "${productId}" not found.`);
    if (!PRODUCT_STATUSES.includes(status)) throw new Error(`Invalid status: ${status}`);

    // Compute image hash if a file path is provided
    let imageHash = null;
    if (imageFilePath) {
      imageHash = sha256File(imageFilePath);
    }

    // Smart contract: auto-evaluate claim
    const claimStatus = evaluateClaim(product.insuranceType, status);

    const tx = new Transaction({
      productId,
      productName: product.name,
      from,
      to,
      status,
      timestamp: new Date().toISOString(),
      imageUrl,
      imageHash,
      insuranceType: product.insuranceType,
      claimStatus,
      maxClaim: product.maxClaim,
      notes
    });

    // Update product's current state
    product.currentStatus = status;
    product.claimStatus = claimStatus;
    product.txCount++;

    if (!this.pendingPool[productId]) this.pendingPool[productId] = [];
    this.pendingPool[productId].push(tx);

    // Count total pending across all products
    const totalPending = Object.values(this.pendingPool).flat().length;

    let mineResult = null;
    if (totalPending >= TX_THRESHOLD) {
      mineResult = this._minePendingBlock();
    }

    return { tx, mineResult, pendingCount: Object.values(this.pendingPool).flat().length };
  }

  // ─── Force mine remaining pending txs (flush) ────────────────────────────
  flushPending() {
    const allPending = Object.values(this.pendingPool).flat();
    if (allPending.length === 0) return null;
    return this._minePendingBlock();
  }

  // ─── Get all transactions for a product (across all blocks) ───────────────
  getProductTransactions(productId) {
    if (!this.products[productId]) return [];
    const txs = [];
    this.chain.forEach(block => {
      block.transactions.forEach(tx => {
        if (tx.productId === productId) txs.push(tx);
      });
    });
    // Also include pending
    if (this.pendingPool[productId]) {
      this.pendingPool[productId].forEach(tx => txs.push({ ...tx.toJSON(), pending: true }));
    }
    return txs;
  }

  // ─── Get product history (blocks containing this product's txs) ───────────
  getProductChain(productId) {
    if (!this.products[productId]) return [];
    return this.products[productId].blockIndices.map(i => this.chain[i]);
  }

  getProductList() {
    return Object.values(this.products);
  }

  getPendingTransactions() {
    return Object.values(this.pendingPool).flat();
  }

  // ─── Enhanced Chain Validation ─────────────────────────────────────────────
  isChainValid() {
    const results = [];

    for (let i = 0; i < this.chain.length; i++) {
      const block = this.chain[i];
      const recalculatedHash = block.calculateHash();
      const issues = [];

      // 1. Hash integrity
      if (block.hash !== recalculatedHash) {
        issues.push(`Hash mismatch: stored "${block.hash.substring(0, 12)}…" ≠ recalculated "${recalculatedHash.substring(0, 12)}…"`);
      }

      // 2. Chain linking
      if (i > 0) {
        const prev = this.chain[i - 1];
        if (block.previousHash !== prev.hash) {
          issues.push(`Previous hash mismatch: block points to "${block.previousHash.substring(0, 12)}…" but prev block hash is "${prev.hash.substring(0, 12)}…"`);
        }
      }

      // 3. Proof of Work
      if (block.hash.substring(0, this.difficulty) !== '0'.repeat(this.difficulty)) {
        issues.push(`PoW invalid: hash must start with ${'0'.repeat(this.difficulty)}`);
      }

      // 4. Image hash integrity (verify stored hashes match files on disk)
      block.transactions.forEach((tx, ti) => {
        if (tx.imageHash && tx.imageUrl) {
          const filePath = path.join(__dirname, tx.imageUrl.replace(/^\//, ''));
          const liveHash = sha256File(filePath);
          if (liveHash && liveHash !== tx.imageHash) {
            issues.push(`Tx[${ti}] image hash mismatch for ${tx.productId}: stored "${tx.imageHash.substring(0, 12)}…" ≠ live "${liveHash.substring(0, 12)}…"`);
          }
        }
      });

      // 5. Transaction integrity
      if (!block.transactions || block.transactions.length === 0) {
        issues.push('Block has no transactions');
      }

      results.push({
        blockIndex: i,
        valid: issues.length === 0,
        reason: issues.length === 0 ? 'Block is valid' : issues.join(' | '),
        txCount: block.transactions.length
      });
    }

    return {
      isValid: results.every(r => r.valid),
      results
    };
  }

  // ─── Tamper (for demo) ────────────────────────────────────────────────────
  tamperBlock(blockIndex, txIndex = 0, newStatus) {
    if (blockIndex < 0 || blockIndex >= this.chain.length) {
      throw new Error('Invalid block index');
    }
    const block = this.chain[blockIndex];
    if (!block.transactions[txIndex]) throw new Error('Invalid transaction index');
    block.transactions[txIndex].status = newStatus;
    // Do NOT recalculate hash — this is the point
  }

  // ─── Demo Seed Data ───────────────────────────────────────────────────────
  seedDemo() {
    this.chain = [];
    this.products = {};
    this.pendingPool = {};

    const demoProducts = [
      { id: 'PRD-CHOC-001', name: 'Premium Dark Chocolate', insuranceType: 'Basic' },
      { id: 'PRD-LAPTOP-002', name: 'Gaming Laptop X7 Pro', insuranceType: 'Premium' },
      { id: 'PRD-VACC-003', name: 'BioShield Vaccine Batch #42', insuranceType: 'Full Protection' }
    ];

    const demoTransactions = [
      // Block 1 — 3 genesis txs
      { productId: 'PRD-CHOC-001', from: 'System', to: 'Factory', status: 'Created', ts: '2026-01-15T08:00:00.000Z', notes: 'Product registered at cacao farm, Sulawesi' },
      { productId: 'PRD-LAPTOP-002', from: 'System', to: 'Factory', status: 'Created', ts: '2026-01-18T09:00:00.000Z', notes: 'Manufacturing started at Shenzhen plant' },
      { productId: 'PRD-VACC-003', from: 'System', to: 'Factory', status: 'Created', ts: '2026-02-01T06:00:00.000Z', notes: 'Batch synthesized at Bandung R&D lab' },
      // Block 2 — 3 warehouse txs
      { productId: 'PRD-CHOC-001', from: 'Factory', to: 'Warehouse', status: 'In Warehouse', ts: '2026-01-18T10:00:00.000Z', notes: 'Processing factory Surabaya received' },
      { productId: 'PRD-LAPTOP-002', from: 'Factory', to: 'Warehouse', status: 'In Warehouse', ts: '2026-01-20T11:00:00.000Z', notes: 'QC center Guangzhou cleared' },
      { productId: 'PRD-VACC-003', from: 'Factory', to: 'Warehouse', status: 'In Warehouse', ts: '2026-02-03T07:30:00.000Z', notes: 'Cold storage Jakarta, −20°C maintained' },
      // Block 3 — transit
      { productId: 'PRD-CHOC-001', from: 'Warehouse', to: 'Distributor', status: 'In Transit', ts: '2026-01-22T14:00:00.000Z', notes: 'Shipped via Tanjung Priok port' },
      { productId: 'PRD-LAPTOP-002', from: 'Warehouse', to: 'Distributor', status: 'In Transit', ts: '2026-01-25T08:00:00.000Z', notes: 'Air freight via HKG International' },
      { productId: 'PRD-VACC-003', from: 'Warehouse', to: 'Distributor', status: 'In Transit', ts: '2026-02-05T09:00:00.000Z', notes: 'Refrigerated truck to Surabaya hub' },
      // Block 4 — retailer / delivered
      { productId: 'PRD-CHOC-001', from: 'Distributor', to: 'Retailer', status: 'In Transit', ts: '2026-01-28T10:00:00.000Z', notes: 'Import clearance Osaka Port' },
      { productId: 'PRD-LAPTOP-002', from: 'Distributor', to: 'Retailer', status: 'In Transit', ts: '2026-02-01T12:00:00.000Z', notes: 'Customs cleared Soekarno-Hatta' },
      { productId: 'PRD-VACC-003', from: 'Distributor', to: 'Retailer', status: 'Delivered', ts: '2026-02-08T13:00:00.000Z', notes: 'Hospital RSUP Sanglah, Bali received batch' },
      // Block 5 — final states
      { productId: 'PRD-CHOC-001', from: 'Retailer', to: 'Customer', status: 'Delivered', ts: '2026-02-05T09:00:00.000Z', notes: 'Premium retail store Tokyo, Japan' },
      { productId: 'PRD-LAPTOP-002', from: 'Retailer', to: 'Customer', status: 'Delivered', ts: '2026-02-10T14:00:00.000Z', notes: 'iBox Plaza Senayan Jakarta' },
      { productId: 'PRD-VACC-003', from: 'Retailer', to: 'Customer', status: 'Delivered', ts: '2026-02-10T15:00:00.000Z', notes: 'Administered to patients, batch complete' }
    ];

    const seeded = [];

    // Register products first
    demoProducts.forEach(p => {
      const maxClaim = INSURANCE_TYPES[p.insuranceType]?.maxClaim ?? 0;
      this.products[p.id] = {
        name: p.name, id: p.id,
        createdAt: new Date().toISOString(),
        currentStatus: 'Created',
        insuranceType: p.insuranceType,
        claimStatus: 'Pending',
        maxClaim,
        blockIndices: [],
        txCount: 0
      };
      this.pendingPool[p.id] = [];
    });

    // Add transactions and mine
    demoTransactions.forEach(raw => {
      const product = this.products[raw.productId];
      const claimStatus = evaluateClaim(product.insuranceType, raw.status);
      const tx = new Transaction({
        productId: raw.productId,
        productName: product.name,
        from: raw.from,
        to: raw.to,
        status: raw.status,
        timestamp: raw.ts,
        insuranceType: product.insuranceType,
        claimStatus,
        maxClaim: product.maxClaim,
        notes: raw.notes
      });

      product.currentStatus = raw.status;
      product.claimStatus = claimStatus;
      product.txCount++;
      this.pendingPool[raw.productId].push(tx);

      const totalPending = Object.values(this.pendingPool).flat().length;
      if (totalPending >= TX_THRESHOLD) {
        const result = this._minePendingBlock();
        if (result) seeded.push({ blockIndex: result.block.index, iterations: result.iterations, txCount: result.block.transactions.length });
      }
    });

    // Flush any remaining
    const flush = this.flushPending();
    if (flush) seeded.push({ blockIndex: flush.block.index, iterations: flush.iterations, txCount: flush.block.transactions.length });

    return seeded;
  }

  // ─── Persistence ──────────────────────────────────────────────────────────
  toJSON() {
    return {
      version: '2.0',
      chain: this.chain.map(b => b.toJSON()),
      difficulty: this.difficulty,
      products: this.products,
      pendingPool: Object.fromEntries(
        Object.entries(this.pendingPool).map(([k, txs]) => [k, txs.map(t => t.toJSON())])
      )
    };
  }

  static fromJSON(json) {
    const bc = new Blockchain(json.difficulty);
    bc.products = json.products || {};
    bc.chain = (json.chain || []).map(data => Block.fromJSON(data));
    bc.pendingPool = {};
    if (json.pendingPool) {
      Object.entries(json.pendingPool).forEach(([k, txs]) => {
        bc.pendingPool[k] = txs.map(t => Transaction.fromJSON(t));
      });
    }
    return bc;
  }

  save() {
    fs.writeFileSync(DB_PATH, JSON.stringify(this.toJSON(), null, 2), 'utf-8');
  }

  static load() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        const json = JSON.parse(raw);
        // Detect v1 format (no version field) and start fresh
        if (!json.version || json.version !== '2.0') {
          console.warn('[TrustChain v2] Detected v1 database — starting fresh.');
          return new Blockchain();
        }
        return Blockchain.fromJSON(json);
      }
    } catch (e) {
      console.warn('[TrustChain v2] Could not load database.json, starting fresh:', e.message);
    }
    return new Blockchain();
  }
}

module.exports = { Blockchain, Block, Transaction, PRODUCT_STATUSES, INSURANCE_TYPES, evaluateClaim, sha256File };
