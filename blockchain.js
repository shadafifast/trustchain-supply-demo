/**
 * TrustChain – Blockchain Engine
 * SHA-256 Hashing | Proof of Work Mining | Chain Validation
 */

// ─── Pure JS SHA-256 Implementation ────────────────────────────────────────────
const SHA256 = (() => {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  function hash(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const msgLength = msgBuffer.length;

    const bufferLength = Math.ceil((msgLength + 9) / 64) * 64;
    const buffer = new Uint8Array(bufferLength);
    buffer.set(msgBuffer);
    buffer[msgLength] = 0x80;

    const view = new DataView(buffer.buffer);
    view.setUint32(bufferLength - 4, msgLength * 8, false);

    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

    for (let offset = 0; offset < bufferLength; offset += 64) {
      const w = new Array(64);
      for (let i = 0; i < 16; i++) {
        w[i] = view.getUint32(offset + i * 4, false);
      }
      for (let i = 16; i < 64; i++) {
        const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }

      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

      for (let i = 0; i < 64; i++) {
        const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + K[i] + w[i]) | 0;
        const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) | 0;

        h = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }

      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0;
      h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0;
      h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }

    return [h0, h1, h2, h3, h4, h5, h6, h7]
      .map(v => (v >>> 0).toString(16).padStart(8, '0'))
      .join('');
  }

  return { hash };
})();


// ─── Block Class ────────────────────────────────────────────────────────────────
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
    return SHA256.hash(data);
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


// ─── Blockchain Class ───────────────────────────────────────────────────────────
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

      // Check hash integrity
      if (block.hash !== recalculatedHash) {
        results.push({
          blockIndex: i,
          valid: false,
          reason: `Hash mismatch: stored "${block.hash.substring(0, 12)}..." ≠ recalculated "${recalculatedHash.substring(0, 12)}..."`
        });
        continue;
      }

      // Check chain linking (skip genesis)
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

      // Check proof of work
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
    // Directly modify block data WITHOUT re-mining — this will break the chain
    this.chain[blockIndex].location = newLocation;
  }

  getProductChain(productId) {
    if (!this.products[productId]) return [];
    return this.products[productId].blockIndices.map(i => this.chain[i]);
  }

  getProductList() {
    return Object.values(this.products);
  }

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
      const block = new Block(
        data.index,
        data.timestamp,
        data.productName,
        data.productId,
        data.location,
        data.previousHash
      );
      block.nonce = data.nonce;
      block.hash = data.hash;
      return block;
    });
    return bc;
  }

  save() {
    try {
      localStorage.setItem('trustchain_data', JSON.stringify(this.toJSON()));
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  }

  static load() {
    try {
      const data = localStorage.getItem('trustchain_data');
      if (data) {
        return Blockchain.fromJSON(JSON.parse(data));
      }
    } catch (e) {
      console.warn('Could not load from localStorage:', e);
    }
    return new Blockchain();
  }
}
