/**
 * TrustChain – Express REST API Server
 * Handles all blockchain operations server-side.
 */

'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const { Blockchain } = require('./blockchain-node');

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
// Serve static frontend files (index.html, app.js, index.css)
app.use(express.static(path.join(__dirname)));

// ─── Load/initialize blockchain ──────────────────────────────────────────────
let blockchain = Blockchain.load();
console.log(`[TrustChain] Blockchain loaded. ${blockchain.chain.length} blocks, ${Object.keys(blockchain.products).length} products.`);

// ─── Helper: build stats response ────────────────────────────────────────────
function buildChainResponse() {
  const validation = blockchain.chain.length > 0 ? blockchain.isChainValid() : { isValid: true, results: [] };
  return {
    chain: blockchain.chain,
    products: blockchain.products,
    stats: {
      totalBlocks: blockchain.chain.length,
      totalProducts: Object.keys(blockchain.products).length,
      difficulty: blockchain.difficulty,
      isValid: blockchain.chain.length === 0 ? null : validation.isValid
    }
  };
}

// ─── API Routes ──────────────────────────────────────────────────────────────

/**
 * GET /api/chain
 * Returns the full blockchain, all products, and stats.
 */
app.get('/api/chain', (req, res) => {
  res.json(buildChainResponse());
});

/**
 * POST /api/products
 * Body: { name: string, id: string }
 * Creates a new product and mines its genesis block on the server.
 */
app.post('/api/products', (req, res) => {
  const { name, id } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Product name is required.' });
  }
  if (!id || typeof id !== 'string' || !id.trim()) {
    return res.status(400).json({ error: 'Product ID is required.' });
  }

  try {
    const { block, iterations } = blockchain.createProduct(name.trim(), id.trim());
    blockchain.save();
    res.status(201).json({
      message: `Product "${name}" created! Genesis block mined in ${iterations.toLocaleString()} iterations.`,
      block,
      iterations,
      ...buildChainResponse()
    });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

/**
 * POST /api/locations
 * Body: { productId: string, location: string }
 * Updates the location of a product and mines the new block on the server.
 */
app.post('/api/locations', (req, res) => {
  const { productId, location } = req.body;

  if (!productId) return res.status(400).json({ error: 'productId is required.' });
  if (!location || !location.trim()) return res.status(400).json({ error: 'location is required.' });

  try {
    const { block, iterations } = blockchain.updateLocation(productId.trim(), location.trim());
    blockchain.save();
    res.status(201).json({
      message: `Location updated to "${location}"! Block mined in ${iterations.toLocaleString()} iterations.`,
      block,
      iterations,
      ...buildChainResponse()
    });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

/**
 * GET /api/validate
 * Validates the entire blockchain and returns block-by-block results.
 */
app.get('/api/validate', (req, res) => {
  if (blockchain.chain.length === 0) {
    return res.json({ isValid: null, results: [], message: 'No blocks to validate.' });
  }
  const result = blockchain.isChainValid();
  res.json(result);
});

/**
 * POST /api/tamper
 * Body: { blockIndex: number, newLocation: string }
 * Deliberately modifies a block WITHOUT re-mining to demonstrate immutability.
 */
app.post('/api/tamper', (req, res) => {
  const { blockIndex, newLocation } = req.body;

  if (blockIndex === undefined || blockIndex === null) {
    return res.status(400).json({ error: 'blockIndex is required.' });
  }
  if (!newLocation || !newLocation.trim()) {
    return res.status(400).json({ error: 'newLocation is required.' });
  }

  try {
    blockchain.tamperBlock(parseInt(blockIndex, 10), newLocation.trim());
    blockchain.save();
    res.json({
      message: `Block #${blockIndex} tampered! Location changed to "${newLocation}". Chain is now INVALID.`,
      ...buildChainResponse()
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/reset
 * Resets the entire blockchain.
 */
app.post('/api/reset', (req, res) => {
  blockchain = new Blockchain();
  blockchain.save();
  res.json({ message: 'Blockchain has been reset.', ...buildChainResponse() });
});

/**
 * POST /api/seed
 * Mines 15 demo blocks on the SERVER with 3 sample supply chain products.
 * This can take a few seconds – that's fine, it runs once.
 */
app.post('/api/seed', (req, res) => {
  try {
    console.log('[TrustChain] Starting demo seed on server...');
    // Always start fresh so seed never stacks on top of existing data
    blockchain = new Blockchain();
    const seeded = blockchain.seedDemo();
    blockchain.save();
    console.log(`[TrustChain] Demo seed complete. ${seeded.length} blocks mined.`);
    res.json({
      message: `Demo data loaded! ${seeded.length} blocks mined across 3 products.`,
      seeded,
      ...buildChainResponse()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Catch-all: serve index.html for any unmatched routes ────────────────────
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ TrustChain API server running at http://0.0.0.0:${PORT}`);
  console.log(`   API endpoints:`);
  console.log(`   GET  /api/chain`);
  console.log(`   POST /api/products`);
  console.log(`   POST /api/locations`);
  console.log(`   GET  /api/validate`);
  console.log(`   POST /api/tamper`);
  console.log(`   POST /api/reset`);
  console.log(`   POST /api/seed`);
});
