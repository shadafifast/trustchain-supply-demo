/**
 * TrustChain – Demo Seed Data
 * Pre-mined blockchain data so users can instantly explore the system.
 * This data was mined with difficulty=3 and injected directly.
 */

const DEMO_DATA = {
  "difficulty": 3,
  "products": {
    "PRD-CHOC-001": {
      "name": "Premium Dark Chocolate",
      "id": "PRD-CHOC-001",
      "createdAt": "2026-01-15T08:00:00.000Z",
      "blockIndices": [0, 3, 6, 9, 12]
    },
    "PRD-LAPTOP-002": {
      "name": "Gaming Laptop X7 Pro",
      "id": "PRD-LAPTOP-002",
      "createdAt": "2026-01-18T09:00:00.000Z",
      "blockIndices": [1, 4, 7, 10, 13]
    },
    "PRD-VACC-003": {
      "name": "BioShield Vaccine Batch #42",
      "id": "PRD-VACC-003",
      "createdAt": "2026-02-01T06:00:00.000Z",
      "blockIndices": [2, 5, 8, 11, 14]
    }
  },
  "chain": []
};

// Helper: Compute SHA-256 (reuses the global SHA256 defined in blockchain.js)
function buildDemoChain() {
  const blocks = [
    // --- Block 0: Chocolate Genesis ---
    { index: 0, timestamp: "2026-01-15T08:00:00.000Z", productName: "Premium Dark Chocolate",    productId: "PRD-CHOC-001",   location: "Cacao Farm – Sulawesi, Indonesia"         },
    // --- Block 1: Laptop Genesis ---
    { index: 1, timestamp: "2026-01-18T09:00:00.000Z", productName: "Gaming Laptop X7 Pro",      productId: "PRD-LAPTOP-002", location: "Manufacturing Plant – Shenzhen, China"     },
    // --- Block 2: Vaccine Genesis ---
    { index: 2, timestamp: "2026-02-01T06:00:00.000Z", productName: "BioShield Vaccine Batch #42", productId: "PRD-VACC-003", location: "R&D Laboratory – Bandung, Indonesia"       },
    // --- Block 3: Chocolate Move 1 ---
    { index: 3, timestamp: "2026-01-18T10:00:00.000Z", productName: "Premium Dark Chocolate",    productId: "PRD-CHOC-001",   location: "Processing Factory – Surabaya, Indonesia"  },
    // --- Block 4: Laptop Move 1 ---
    { index: 4, timestamp: "2026-01-20T11:00:00.000Z", productName: "Gaming Laptop X7 Pro",      productId: "PRD-LAPTOP-002", location: "Quality Control Center – Guangzhou, China"  },
    // --- Block 5: Vaccine Move 1 ---
    { index: 5, timestamp: "2026-02-03T07:30:00.000Z", productName: "BioShield Vaccine Batch #42", productId: "PRD-VACC-003", location: "Cold Storage Facility – Jakarta, Indonesia" },
    // --- Block 6: Chocolate Move 2 ---
    { index: 6, timestamp: "2026-01-22T14:00:00.000Z", productName: "Premium Dark Chocolate",    productId: "PRD-CHOC-001",   location: "International Port – Tanjung Priok, Jakarta" },
    // --- Block 7: Laptop Move 2 ---
    { index: 7, timestamp: "2026-01-25T08:00:00.000Z", productName: "Gaming Laptop X7 Pro",      productId: "PRD-LAPTOP-002", location: "Logistics Hub – Hongkong International"       },
    // --- Block 8: Vaccine Move 2 ---
    { index: 8, timestamp: "2026-02-05T09:00:00.000Z", productName: "BioShield Vaccine Batch #42", productId: "PRD-VACC-003", location: "Regional Distribution Hub – Surabaya"      },
    // --- Block 9: Chocolate Move 3 ---
    { index: 9, timestamp: "2026-01-28T10:00:00.000Z", productName: "Premium Dark Chocolate",    productId: "PRD-CHOC-001",   location: "Import Clearance – Osaka Port, Japan"       },
    // --- Block 10: Laptop Move 3 ---
    { index: 10, timestamp: "2026-02-01T12:00:00.000Z", productName: "Gaming Laptop X7 Pro",     productId: "PRD-LAPTOP-002", location: "Customs Import – Soekarno-Hatta, Jakarta"    },
    // --- Block 11: Vaccine Move 3 ---
    { index: 11, timestamp: "2026-02-08T13:00:00.000Z", productName: "BioShield Vaccine Batch #42", productId: "PRD-VACC-003", location: "Hospital Receiving Dept – RSUP Sanglah, Bali" },
    // --- Block 12: Chocolate Final ---
    { index: 12, timestamp: "2026-02-05T09:00:00.000Z", productName: "Premium Dark Chocolate",   productId: "PRD-CHOC-001",   location: "Premium Retail Store – Tokyo, Japan"         },
    // --- Block 13: Laptop Final ---
    { index: 13, timestamp: "2026-02-10T14:00:00.000Z", productName: "Gaming Laptop X7 Pro",     productId: "PRD-LAPTOP-002", location: "iBox Retail Store – Plaza Senayan, Jakarta"  },
    // --- Block 14: Vaccine Final ---
    { index: 14, timestamp: "2026-02-10T15:00:00.000Z", productName: "BioShield Vaccine Batch #42", productId: "PRD-VACC-003", location: "Administered to Patients – RSUP Sanglah"    }
  ];

  const difficulty = 3;
  const target = '0'.repeat(difficulty);
  const chainData = [];
  let previousHash = '0'.repeat(64);

  blocks.forEach((raw, i) => {
    let nonce = 0;
    let hash = '';

    // Mine the block
    while (true) {
      nonce++;
      const data = `${raw.index}${raw.timestamp}${raw.productName}${raw.productId}${raw.location}${previousHash}${nonce}`;
      hash = SHA256.hash(data);
      if (hash.substring(0, difficulty) === target) break;
    }

    chainData.push({
      index: raw.index,
      timestamp: raw.timestamp,
      productName: raw.productName,
      productId: raw.productId,
      location: raw.location,
      previousHash: previousHash,
      hash: hash,
      nonce: nonce
    });

    previousHash = hash;
  });

  return chainData;
}

/**
 * Loads the pre-built demo data into localStorage.
 * Called when user clicks the "Load Demo Data" button.
 */
function loadDemoData() {
  const existing = localStorage.getItem('trustchain_data');
  if (existing) {
    const parsed = JSON.parse(existing);
    if (parsed.chain && parsed.chain.length > 0) {
      const confirmed = confirm(
        '⚠️ Your current blockchain has data.\n\nLoading demo data will REPLACE your existing chain. Continue?'
      );
      if (!confirmed) return;
    }
  }

  // Show a loading toast immediately
  showToast('⛏️ Mining 15 demo blocks... please wait a few seconds.', 'info');

  // Defer mining so toast renders first
  setTimeout(() => {
    try {
      const chain = buildDemoChain();
      DEMO_DATA.chain = chain;
      localStorage.setItem('trustchain_data', JSON.stringify(DEMO_DATA));

      // Reload the blockchain state from storage
      blockchain = Blockchain.load();
      refreshAll();

      showToast('🎉 Demo data loaded! 3 products · 15 blocks · Full supply chain journey visible.', 'success');

      // Auto-navigate to explorer
      const explorerTab = document.getElementById('tab-explorer');
      if (explorerTab) explorerTab.click();

    } catch (err) {
      showToast(`❌ Failed to load demo data: ${err.message}`, 'error');
      console.error(err);
    }
  }, 150);
}
