/**
 * TrustChain – Blockchain Engine (Node.js Version)
 * SHA-256 via Node crypto | Proof of Work | Chain Validation
 * Persistent storage via filesystem (database.json)
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.json');

// ─── SHA-256 using Node.js built-in crypto ───────────────────────────────────
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}


// ─── Block Class ─────────────────────────────────────────────────────────────
class Block {
  constructor(index, timestamp, productName, productId, location, previousHash = '') {
    this.index = index;
    this.timestamp = timestamp;
    this.productName = productName;
    this.productId = productId;
    this.location = location;
    this.previousHash = previousHash;
    this.nonce = 0;
    this.hash = '';
  }

  calculateHash() {
    const data = `${this.index}${this.timestamp}${this.productName}${this.productId}${this.location}${this.previousHash}${this.nonce}`;
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
}


// ─── Blockchain Class ─────────────────────────────────────────────────────────
class Blockchain {
  constructor(difficulty = 3) {
    this.chain = [];
    this.difficulty = difficulty;
    this.products = {}; // productId -> product metadata
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  createProduct(productName, productId) {
    if (this.products[productId]) {
      throw new Error(`Product with ID "${productId}" already exists.`);
    }

    const timestamp = new Date().toISOString();
    const previousHash = this.chain.length > 0 ? this.getLatestBlock().hash : '0'.repeat(64);

    const block = new Block(
      this.chain.length,
      timestamp,
      productName,
      productId,
      'Factory (Origin)',
      previousHash
    );

    const iterations = block.mineBlock(this.difficulty);

    this.chain.push(block);
    this.products[productId] = {
      name: productName,
      id: productId,
      createdAt: timestamp,
      blockIndices: [block.index]
    };

    return { block, iterations };
  }

  updateLocation(productId, newLocation) {
    if (!this.products[productId]) {
      throw new Error(`Product with ID "${productId}" not found.`);
    }

    const product = this.products[productId];
    const previousBlock = this.getLatestBlock();
    const timestamp = new Date().toISOString();

    const block = new Block(
      this.chain.length,
      timestamp,
      product.name,
      productId,
      newLocation,
      previousBlock.hash
    );

    const iterations = block.mineBlock(this.difficulty);

    this.chain.push(block);
    product.blockIndices.push(block.index);

    return { block, iterations };
  }

  isChainValid() {
    const results = [];

    for (let i = 0; i < this.chain.length; i++) {
      const block = this.chain[i];
      const recalculatedHash = block.calculateHash();

      if (block.hash !== recalculatedHash) {
        results.push({
          blockIndex: i,
          valid: false,
          reason: `Hash mismatch: stored "${block.hash.substring(0, 12)}..." ≠ recalculated "${recalculatedHash.substring(0, 12)}..."`
        });
        continue;
      }

      if (i > 0) {
        const previousBlock = this.chain[i - 1];
        if (block.previousHash !== previousBlock.hash) {
          results.push({
            blockIndex: i,
            valid: false,
            reason: `Previous hash mismatch: block points to "${block.previousHash.substring(0, 12)}..." but previous block hash is "${previousBlock.hash.substring(0, 12)}..."`
          });
          continue;
        }
      }

      if (block.hash.substring(0, this.difficulty) !== '0'.repeat(this.difficulty)) {
        results.push({
          blockIndex: i,
          valid: false,
          reason: `Proof of Work invalid: hash does not start with ${'0'.repeat(this.difficulty)}`
        });
        continue;
      }

      results.push({ blockIndex: i, valid: true, reason: 'Block is valid' });
    }

    return {
      isValid: results.every(r => r.valid),
      results
    };
  }

  tamperBlock(blockIndex, newLocation) {
    if (blockIndex < 0 || blockIndex >= this.chain.length) {
      throw new Error('Invalid block index');
    }
    this.chain[blockIndex].location = newLocation;
  }

  getProductChain(productId) {
    if (!this.products[productId]) return [];
    return this.products[productId].blockIndices.map(i => this.chain[i]);
  }

  getProductList() {
    return Object.values(this.products);
  }

  // ─── Seed demo data (runs on server, no mining wait in browser) ─────────────
  seedDemo() {
    // Reset
    this.chain = [];
    this.products = {};

    const demoBlocks = [
      { productName: 'Premium Dark Chocolate',      productId: 'PRD-CHOC-001',   location: 'Cacao Farm – Sulawesi, Indonesia',          timestamp: '2026-01-15T08:00:00.000Z' },
      { productName: 'Gaming Laptop X7 Pro',         productId: 'PRD-LAPTOP-002', location: 'Manufacturing Plant – Shenzhen, China',       timestamp: '2026-01-18T09:00:00.000Z' },
      { productName: 'BioShield Vaccine Batch #42',  productId: 'PRD-VACC-003',   location: 'R&D Laboratory – Bandung, Indonesia',         timestamp: '2026-02-01T06:00:00.000Z' },
      { productName: 'Premium Dark Chocolate',       productId: 'PRD-CHOC-001',   location: 'Processing Factory – Surabaya, Indonesia',    timestamp: '2026-01-18T10:00:00.000Z' },
      { productName: 'Gaming Laptop X7 Pro',         productId: 'PRD-LAPTOP-002', location: 'Quality Control Center – Guangzhou, China',   timestamp: '2026-01-20T11:00:00.000Z' },
      { productName: 'BioShield Vaccine Batch #42',  productId: 'PRD-VACC-003',   location: 'Cold Storage Facility – Jakarta, Indonesia',  timestamp: '2026-02-03T07:30:00.000Z' },
      { productName: 'Premium Dark Chocolate',       productId: 'PRD-CHOC-001',   location: 'International Port – Tanjung Priok, Jakarta',  timestamp: '2026-01-22T14:00:00.000Z' },
      { productName: 'Gaming Laptop X7 Pro',         productId: 'PRD-LAPTOP-002', location: 'Logistics Hub – Hongkong International',       timestamp: '2026-01-25T08:00:00.000Z' },
      { productName: 'BioShield Vaccine Batch #42',  productId: 'PRD-VACC-003',   location: 'Regional Distribution Hub – Surabaya',         timestamp: '2026-02-05T09:00:00.000Z' },
      { productName: 'Premium Dark Chocolate',       productId: 'PRD-CHOC-001',   location: 'Import Clearance – Osaka Port, Japan',          timestamp: '2026-01-28T10:00:00.000Z' },
      { productName: 'Gaming Laptop X7 Pro',         productId: 'PRD-LAPTOP-002', location: 'Customs Import – Soekarno-Hatta, Jakarta',      timestamp: '2026-02-01T12:00:00.000Z' },
      { productName: 'BioShield Vaccine Batch #42',  productId: 'PRD-VACC-003',   location: 'Hospital Receiving Dept – RSUP Sanglah, Bali',  timestamp: '2026-02-08T13:00:00.000Z' },
      { productName: 'Premium Dark Chocolate',       productId: 'PRD-CHOC-001',   location: 'Premium Retail Store – Tokyo, Japan',            timestamp: '2026-02-05T09:00:00.000Z' },
      { productName: 'Gaming Laptop X7 Pro',         productId: 'PRD-LAPTOP-002', location: 'iBox Retail Store – Plaza Senayan, Jakarta',     timestamp: '2026-02-10T14:00:00.000Z' },
      { productName: 'BioShield Vaccine Batch #42',  productId: 'PRD-VACC-003',   location: 'Administered to Patients – RSUP Sanglah',       timestamp: '2026-02-10T15:00:00.000Z' },
    ];

    const seeded = [];

    demoBlocks.forEach(raw => {
      const previousHash = this.chain.length > 0 ? this.getLatestBlock().hash : '0'.repeat(64);
      const block = new Block(this.chain.length, raw.timestamp, raw.productName, raw.productId, raw.location, previousHash);
      const iterations = block.mineBlock(this.difficulty);
      this.chain.push(block);

      if (!this.products[raw.productId]) {
        this.products[raw.productId] = {
          name: raw.productName,
          id: raw.productId,
          createdAt: raw.timestamp,
          blockIndices: [block.index]
        };
      } else {
        this.products[raw.productId].blockIndices.push(block.index);
      }

      seeded.push({ blockIndex: block.index, productId: raw.productId, iterations });
    });

    return seeded;
  }

  // ─── Persistence: File System ────────────────────────────────────────────────
  toJSON() {
    return {
      chain: this.chain.map(b => ({
        index: b.index,
        timestamp: b.timestamp,
        productName: b.productName,
        productId: b.productId,
        location: b.location,
        previousHash: b.previousHash,
        hash: b.hash,
        nonce: b.nonce
      })),
      difficulty: this.difficulty,
      products: this.products
    };
  }

  static fromJSON(json) {
    const bc = new Blockchain(json.difficulty);
    bc.products = json.products;
    bc.chain = json.chain.map(data => {
      const block = new Block(data.index, data.timestamp, data.productName, data.productId, data.location, data.previousHash);
      block.nonce = data.nonce;
      block.hash = data.hash;
      return block;
    });
    return bc;
  }

  save() {
    fs.writeFileSync(DB_PATH, JSON.stringify(this.toJSON(), null, 2), 'utf-8');
  }

  static load() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        return Blockchain.fromJSON(JSON.parse(raw));
      }
    } catch (e) {
      console.warn('[TrustChain] Could not load database.json, starting fresh:', e.message);
    }
    return new Blockchain();
  }
}

module.exports = { Blockchain, Block };
