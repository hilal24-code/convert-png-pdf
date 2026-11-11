# Gambar ke PDF (Next.js)

Konversi WebP, PNG, dan JPG ke satu PDF, 100% di browser dengan jsPDF.

## Cara pakai

```bash
npx create-next-app@latest img-to-pdf --ts --app --no-tailwind --eslint --import-alias "@/*"
cd img-to-pdf
npm i jspdf
```

Lalu salin file ini ke proyek (timpa yang ada):

- `app/layout.tsx`
- `app/page.tsx`
- `app/globals.css`
- `lib/imagesToPdf.ts`

Jalankan:

```bash
npm run dev
```

Buka http://localhost:3000
