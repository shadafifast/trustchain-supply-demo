# Menggunakan image Node.js versi ringan (Alpine)
FROM node:18-alpine

# Menentukan direktori kerja di dalam container
WORKDIR /app

# Menyalin file konfigurasi package npm terlebih dahulu
# (Ini memanfaatkan fitur caching Docker agar 'npm install' lebih cepat)
COPY package*.json ./

# Menginstal dependensi aplikasi (hanya dependensi production)
RUN npm install --production

# Menyalin seluruh file source code aplikasi ke dalam direktori kerja container
COPY . .

# Membuat folder uploads dan qrcodes (berjaga-jaga jika belum ada)
RUN mkdir -p uploads qrcodes

# Mengekspos port 4000 (port default aplikasi ini)
EXPOSE 4000

# Perintah yang akan dijalankan saat container dihidupkan
CMD ["npm", "start"]
