# Convert PNG to PDF

Aplikasi web untuk mengubah gambar **WebP, PNG, dan JPG** menjadi satu file **PDF**.
Semua proses berjalan di browser, jadi gambar tidak diunggah ke server.

## Fitur

- Tarik & lepas (drag & drop), pilih file, atau tempel gambar dengan `Ctrl+V`
- Atur urutan halaman dengan menggeser gambar
- Ubah nama file PDF
- Pilih ukuran kertas: A4, Letter, Legal, F4, A3, A5, atau sesuai ukuran gambar
- Pilih orientasi (otomatis, potret, lanskap) dan margin
- Atur kualitas gambar
- Bar progres saat PDF dibuat

## Teknologi

- [Next.js](https://nextjs.org/) (App Router) + TypeScript
- [jsPDF](https://github.com/parallax/jsPDF) untuk membuat PDF
- [dnd-kit](https://dndkit.com/) untuk drag & drop

## Cara menjalankan

```bash
git clone https://github.com/hilal24-code/convert-png-pdf.git
cd convert-png-pdf
npm install
npm run dev
```

Buka http://localhost:3000

## Build untuk produksi

```bash
npm run build
npm start
```

## Catatan

- Gambar yang sangat besar diperkecil otomatis (maks. 3000 px pada sisi terpanjang) agar PDF tidak terlalu berat.
- Semua gambar diubah ke JPEG sebelum dimasukkan ke PDF, jadi PNG tidak lagi lossless.
- Total ukuran gambar dibatasi karena PDF dibuat di memori browser.
