/**
 * TrustChain v2.0 – Express REST API Server
 * Multi-transaction blocks | Image upload | QR codes | Insurance smart contract
 */

'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const QRCode = require('qrcode');
const { Blockchain, PRODUCT_STATUSES, INSURANCE_TYPES } = require('./blockchain-node');

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Directories ─────────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const QRCODES_DIR = path.join(__dirname, 'qrcodes');
[UPLOADS_DIR, QRCODES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── Multer Config ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    cb(null, unique);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  }
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/qrcodes', express.static(QRCODES_DIR));

// ─── Blockchain instance ──────────────────────────────────────────────────────
let blockchain = Blockchain.load();
console.log(`[TrustChain v2] Loaded — ${blockchain.chain.length} blocks, ${Object.keys(blockchain.products).length} products.`);

// ─── QR Code helper ───────────────────────────────────────────────────────────
async function generateQR(productId) {
  const url = `http://localhost:${PORT}/api/products/${productId}/chain`;
  const qrPath = path.join(QRCODES_DIR, `${productId}.png`);
  await QRCode.toFile(qrPath, url, { width: 300, margin: 2, color: { dark: '#0f172a', light: '#f8fafc' } });
  return `/qrcodes/${productId}.png`;
}

// ─── Response builder ─────────────────────────────────────────────────────────
function buildChainResponse() {
  const pending = blockchain.getPendingTransactions();
  const validation = blockchain.chain.length > 0 ? blockchain.isChainValid() : { isValid: true, results: [] };
  return {
    chain: blockchain.chain.map(b => b.toJSON()),
    products: blockchain.products,
    pendingTransactions: pending.map(t => t.toJSON ? t.toJSON() : t),
    stats: {
      totalBlocks: blockchain.chain.length,
      totalProducts: Object.keys(blockchain.products).length,
      totalTransactions: blockchain.chain.reduce((sum, b) => sum + b.transactions.length, 0) + pending.length,
      pendingCount: pending.length,
      difficulty: blockchain.difficulty,
      isValid: blockchain.chain.length === 0 ? null : validation.isValid
    }
  };
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────

/** GET /api/chain — full blockchain + stats */
app.get('/api/chain', (req, res) => {
  res.json(buildChainResponse());
});

/** GET /api/statuses — return valid status list */
app.get('/api/statuses', (req, res) => {
  res.json({ statuses: PRODUCT_STATUSES, insuranceTypes: Object.keys(INSURANCE_TYPES) });
});

/** POST /api/products — create product + mine genesis block */
app.post('/api/products', async (req, res) => {
  const { name, id, insuranceType = 'None', notes = '' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Product name is required.' });
  if (!id?.trim())   return res.status(400).json({ error: 'Product ID is required.' });

  try {
    const result = blockchain.createProduct({ name: name.trim(), id: id.trim(), insuranceType, notes });
    // Generate QR code for new product
    const qrUrl = await generateQR(id.trim());
    blockchain.products[id.trim()].qrCodeUrl = qrUrl;
    blockchain.save();

    res.status(201).json({
      message: `Product "${name}" created & genesis block mined in ${result.iterations.toLocaleString()} iterations!`,
      block: result.block.toJSON(),
      iterations: result.iterations,
      qrCodeUrl: qrUrl,
      ...buildChainResponse()
    });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

/** POST /api/transactions — add a transaction (may mine a block) */
app.post('/api/transactions', upload.single('image'), async (req, res) => {
  const { productId, from, to, status, notes = '' } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId is required.' });
  if (!from)      return res.status(400).json({ error: 'from role is required.' });
  if (!to)        return res.status(400).json({ error: 'to role is required.' });
  if (!status)    return res.status(400).json({ error: 'status is required.' });

  let imageUrl = null;
  let imageFilePath = null;

  if (req.file) {
    imageUrl = `/uploads/${req.file.filename}`;
    imageFilePath = req.file.path;
  }

  try {
    const result = blockchain.addTransaction({ productId, from, to, status, imageUrl, imageFilePath, notes });
    blockchain.save();

    const mined = result.mineResult !== null;
    const msg = mined
      ? `Transaction added & Block #${result.mineResult.block.index} mined in ${result.mineResult.iterations.toLocaleString()} iterations!`
      : `Transaction added to pending pool. ${result.pendingCount} tx pending (mines at ${3}).`;

    res.status(201).json({
      message: msg,
      transaction: result.tx.toJSON(),
      mined,
      block: mined ? result.mineResult.block.toJSON() : null,
      pendingCount: result.pendingCount,
      ...buildChainResponse()
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** POST /api/flush — force mine all pending transactions */
app.post('/api/flush', (req, res) => {
  const result = blockchain.flushPending();
  if (!result) return res.json({ message: 'No pending transactions to mine.', ...buildChainResponse() });
  blockchain.save();
  res.json({
    message: `Flushed! Block #${result.block.index} mined in ${result.iterations.toLocaleString()} iterations with ${result.block.transactions.length} transactions.`,
    block: result.block.toJSON(),
    ...buildChainResponse()
  });
});

/** POST /api/upload — upload image only, return URL + hash */
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file uploaded.' });
  const imageUrl = `/uploads/${req.file.filename}`;
  const buffer = fs.readFileSync(req.file.path);
  const imageHash = require('crypto').createHash('sha256').update(buffer).digest('hex');
  res.json({ imageUrl, imageHash });
});

/** GET /api/products/:id/chain — all transactions for a product */
app.get('/api/products/:id/chain', (req, res) => {
  const productId = req.params.id;
  const product = blockchain.products[productId];
  if (!product) return res.status(404).json({ error: `Product "${productId}" not found.` });

  const transactions = blockchain.getProductTransactions(productId);
  res.json({ product, transactions });
});

/** GET /api/products/:id/qr — return QR code image path */
app.get('/api/products/:id/qr', async (req, res) => {
  const productId = req.params.id;
  if (!blockchain.products[productId]) return res.status(404).json({ error: 'Product not found.' });

  try {
    const qrUrl = await generateQR(productId);
    blockchain.products[productId].qrCodeUrl = qrUrl;
    blockchain.save();
    res.json({ qrCodeUrl: qrUrl, productId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/validate */
app.get('/api/validate', (req, res) => {
  if (blockchain.chain.length === 0) {
    return res.json({ isValid: null, results: [], message: 'No blocks to validate.' });
  }
  res.json(blockchain.isChainValid());
});

/** POST /api/tamper — deliberately break a block for demo */
app.post('/api/tamper', (req, res) => {
  const { blockIndex, txIndex = 0, newStatus = 'Damaged' } = req.body;
  if (blockIndex === undefined) return res.status(400).json({ error: 'blockIndex is required.' });

  try {
    blockchain.tamperBlock(parseInt(blockIndex, 10), parseInt(txIndex, 10), newStatus);
    blockchain.save();
    res.json({
      message: `Block #${blockIndex} tx[${txIndex}] tampered! Status changed to "${newStatus}". Chain is now INVALID.`,
      ...buildChainResponse()
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** POST /api/reset */
app.post('/api/reset', (req, res) => {
  blockchain = new Blockchain();
  blockchain.save();
  res.json({ message: 'Blockchain has been reset.', ...buildChainResponse() });
});

/** POST /api/seed — mine 5 blocks with 15 demo transactions */
app.post('/api/seed', async (req, res) => {
  try {
    console.log('[TrustChain v2] Starting demo seed...');
    blockchain = new Blockchain();
    const seeded = blockchain.seedDemo();

    // Generate QR codes for all seeded products
    for (const productId of Object.keys(blockchain.products)) {
      const qrUrl = await generateQR(productId);
      blockchain.products[productId].qrCodeUrl = qrUrl;
    }

    blockchain.save();
    console.log(`[TrustChain v2] Seed complete. ${seeded.length} blocks mined.`);

    res.json({
      message: `Demo data loaded! ${seeded.length} blocks mined across 3 products with insurance smart contracts.`,
      seeded,
      ...buildChainResponse()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Legacy compatibility: /api/locations (maps to new addTransaction) ────────
app.post('/api/locations', (req, res) => {
  const { productId, location } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId is required.' });
  if (!location?.trim()) return res.status(400).json({ error: 'location is required.' });

  try {
    const result = blockchain.addTransaction({
      productId,
      from: 'Distributor',
      to: location.trim(),
      status: 'In Transit',
      notes: `Location update: ${location.trim()}`
    });
    blockchain.save();
    const mined = result.mineResult !== null;
    res.status(201).json({
      message: mined
        ? `Location updated! Block mined in ${result.mineResult.iterations.toLocaleString()} iterations.`
        : `Location updated. ${result.pendingCount} tx pending.`,
      mined,
      ...buildChainResponse()
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Catch-all ────────────────────────────────────────────────────────────────
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ TrustChain v2.0 API running at http://localhost:${PORT}`);
  console.log(`   POST /api/products        — create product`);
  console.log(`   POST /api/transactions    — add transaction (+ image upload)`);
  console.log(`   POST /api/flush           — force mine pending`);
  console.log(`   GET  /api/products/:id/chain — product history`);
  console.log(`   GET  /api/products/:id/qr   — QR code`);
  console.log(`   GET  /api/validate        — chain validation`);
  console.log(`   POST /api/tamper          — tamper demo`);
  console.log(`   POST /api/seed            — load demo data`);
});
