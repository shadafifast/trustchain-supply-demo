# 🔗 TrustChain v2.0 — Advanced Blockchain Supply Chain Tracker

<div align="center">

![TrustChain Banner](https://images.unsplash.com/photo-1586528116311-ad8ed7c1562b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80)

[![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![Blockchain](https://img.shields.io/badge/Blockchain-Multi--Transaction_Blocks-3b82f6?style=for-the-badge)](https://github.com/shadafifast/trustchain-supply-demo)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

**Sistem Pelacakan Rantai Pasok Terdesentralisasi berbasis Blockchain v2.0 yang berjalan di atas server Node.js.**  
*Dirancang untuk mendemonstrasikan transparansi logistik, perlindungan asuransi berbasis Smart Contract, verifikasi gambar kriptografis, dan keamanan data antimanipulasi.*

</div>

---

## 🎯 Tentang Proyek

**TrustChain v2.0** adalah sistem pelacakan *full-stack* modern yang mensimulasikan arsitektur blockchain nyata untuk industri logistik global. Berbeda dengan simulasi sederhana berbasis browser, **proses penambangan kriptografi (SHA-256 & Proof-of-Work)** diproses langsung secara *asynchronous* di sisi server oleh Node.js.

Pada versi 2.0 ini, sistem memperkenalkan arsitektur **Multi-Transaction Blocks (Batching)**, fitur verifikasi foto barang berbasis hashing SHA-256 untuk mendeteksi penipuan fisik, kontrak asuransi pintar otomatis (*Smart Contract*), serta kode QR dinamis untuk penelusuran riwayat produk yang instan.

---

## ✨ Fitur Utama v2.0

| Fitur | Deskripsi |
| :--- | :--- |
| 🧱 **Multi-Transaction Blocks** | Satu block menampung hingga 3 transaksi sekaligus (*batching*) sebelum otomatis memicu penambangan, meniru cara kerja blockchain modern (Ethereum/Bitcoin). |
| 🛡️ **Smart Contract Insurance** | Kontrak pintar mengevaluasi klaim asuransi secara otomatis berdasarkan status produk (`Damaged` atau `Lost` → `Approved`) secara instan tanpa perlu audit manual. |
| 📷 **SHA-256 Image Verification** | Unggah foto kondisi fisik barang di setiap pos perpindahan. Server menghitung hash SHA-256 dari berkas foto dan menyimpannya di blockchain untuk menjamin keaslian foto di server. |
| 📱 **Dynamic QR Code Tracking** | QR Code otomatis dihasilkan ketika produk baru dibuat. Scan QR tersebut untuk membuka riwayat pelacakan blockchain produk yang aman. |
| 🔐 **Proof-of-Work (PoW) Mining** | Penambangan block di server membutuhkan pencarian nilai *Nonce* hingga hash block diawali dengan kesulitan matematika tertentu (e.g. `000` di depan). |
| 🧪 **Tamper & Validation Engine** | Simulasikan manipulasi status transaksi secara ilegal (hacking data) dan jalankan modul validasi untuk melihat sistem mendeteksi kerusakan rantai secara presisi. |
| 💾 **Persistent JSON Storage** | Data blockchain dan antrean transaksi (*pending pool*) disimpan di `database.json`, sehingga data aman dan tidak terhapus saat server direstart. |
| ⚡ **1-Click Interactive Demo** | Muat 5 block demo ter-mining, 15 transaksi siap pakai untuk 3 tipe asuransi produk berbeda secara instan. |

---

## 🛠️ Technology Stack

**Backend (Server)**
- **Runtime:** Node.js 22
- **Framework:** Express.js 5
- **Image Handling:** Multer (penanganan unggahan file gambar)
- **QR Engine:** QRCode Generator
- **Kriptografi:** Node.js built-in `crypto` module (SHA-256)
- **Penyimpanan:** File System Lokal (`database.json`)

**Frontend (Client)**
- **Struktur & Gaya:** Vanilla HTML5, CSS3 (Glassmorphism, Dark Mode UI, HSL Colors, Micro-animations)
- **Logika Klien:** Vanilla JS (ES6+) dengan integrasi asynchronous `fetch()` API
- **Visualizer:** Blockchain Block Explorer Interaktif

---

## 🚀 Menjalankan Secara Lokal

### Prasyarat
* Pastikan **Node.js** (versi 18 atau lebih baru) sudah terinstal di komputer Anda.

### Langkah-langkah

**1. Clone repositori ini**
```bash
git clone https://github.com/shadafifast/trustchain-supply-demo.git
cd trustchain-supply-demo
```

**2. Install dependencies**
```bash
npm install
```

**3. Jalankan server**
```bash
npm start
```

**4. Buka aplikasi di Browser**
```
http://localhost:4000
```

---

## 🌐 REST API Endpoints

Seluruh alur interaksi blockchain TrustChain v2.0 dikendalikan melalui API berikut:

| Method | Endpoint | Fungsi |
| :--- | :--- | :--- |
| `GET` | `/api/chain` | Mengambil seluruh data blockchain, statistik, & pending transactions. |
| `GET` | `/api/statuses` | Mengambil daftar status produk & tipe asuransi yang didukung. |
| `POST` | `/api/products` | Mendaftarkan produk baru + menambang *Genesis Block* secara instan. |
| `POST` | `/api/transactions` | Menambah transaksi logistik baru ke pending pool (+ unggah gambar fisik). |
| `POST` | `/api/flush` | Memaksa proses mining atas semua transaksi yang mengambang di pending pool. |
| `POST` | `/api/upload` | Mengunggah gambar dan menerima alamat URL gambar serta hash SHA-256-nya. |
| `GET` | `/api/products/:id/chain` | Mengambil riwayat perjalanan logistik khusus untuk satu ID Produk tertentu. |
| `GET` | `/api/products/:id/qr` | Menghasilkan/mengambil QR Code unik untuk satu ID Produk tertentu. |
| `GET` | `/api/validate` | Menjalankan audit menyeluruh atas validitas hash block, chaining, PoW, dan integritas foto. |
| `POST` | `/api/tamper` | Melakukan manipulasi data transaksi lama secara paksa (simulasi *hacking*). |
| `POST` | `/api/seed` | Mengisi database dengan demo siap pakai (5 block, 15 transaksi, 3 produk). |
| `POST` | `/api/reset` | Menghapus seluruh riwayat blockchain dan memulai ulang dari nol. |

---

## ☁️ Deploy ke Render (Web Service Cloud)

Karena sistem ini memiliki **backend Node.js yang aktif memproses data dan asinkron**, pastikan Anda memilih opsi **Web Service** (bukan Static Site) di Render.

1. Hubungkan akun GitHub Anda ke [Render](https://render.com).
2. Klik **New +** → pilih **Web Service**.
3. Sambungkan ke repositori `trustchain-supply-demo`.
4. Atur detail konfigurasi berikut:

| Pengaturan | Nilai |
| :--- | :--- |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

5. Klik **Create Web Service** dan tunggu hingga deployment berstatus **Live** ✅.

---

## 🏗️ Arsitektur Sistem

```
      Browser (Client-side)                       REST API (HTTP)                Node.js Engine (Server-side)
┌─────────────────────────────────┐                                            ┌──────────────────────────────┐
│  • index.html (Dark UI)         │   ─── POST /api/transactions (JSON/Image) ─►│  • server.js (Express API)   │
│  • app.js (AJAX Fetch Engine)   │                                            │  • blockchain-node.js        │
│  • index.css (Premium Glass UI) │   ◄─── JSON Response (Mined Block/QR/Stats) ──│  • database.json (Ledger)    │
└─────────────────────────────────┘                                            └──────────────────────────────┘
```

---

<div align="center">
  <i>Dibuat dengan ❤️ untuk mendemonstrasikan kekuatan kriptografi dan transparansi blockchain dalam dunia logistik modern.</i>
  <br/><br/>
  <b>⭐ Jika proyek ini membantu presentasi Anda, berikan bintang (Star) di GitHub!</b>
</div>