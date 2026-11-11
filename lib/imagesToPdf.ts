export type PageMode = "paper" | "original";
export type PaperSize = "a4" | "letter" | "legal" | "f4" | "a3" | "a5";
export type Orientation = "auto" | "portrait" | "landscape";
export type MarginPreset = "none" | "small" | "medium";

export type ConvertOptions = {
  mode: PageMode;
  paper: PaperSize;
  orientation: Orientation;
  margin: MarginPreset;
  quality: number; // 0.1 - 1
};

// Ukuran kertas dalam point (1 pt = 1/72 inci), posisi potret
export const PAPER_SIZES: Record<PaperSize, { label: string; w: number; h: number }> = {
  a4: { label: "A4 (210 × 297 mm)", w: 595.28, h: 841.89 },
  letter: { label: "Letter (8,5 × 11 in)", w: 612, h: 792 },
  legal: { label: "Legal (8,5 × 14 in)", w: 612, h: 1008 },
  f4: { label: "F4 / Folio (210 × 330 mm)", w: 595.28, h: 935.43 },
  a3: { label: "A3 (297 × 420 mm)", w: 841.89, h: 1190.55 },
  a5: { label: "A5 (148 × 210 mm)", w: 419.53, h: 595.28 },
};

export const MARGINS: Record<MarginPreset, { label: string; pt: number }> = {
  none: { label: "Tanpa margin", pt: 0 },
  small: { label: "Kecil (6 mm)", pt: 18 },
  medium: { label: "Sedang (13 mm)", pt: 36 },
};

// Buang karakter yang tidak boleh ada di nama file, pastikan berakhiran .pdf
export function sanitizeFileName(name: string) {
  const base = name
    .replace(/\.pdf$/i, "")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim();
  return `${base || "gambar"}.pdf`;
}

// Decode WebP/PNG/JPG, ratakan transparansi ke latar putih, encode ulang sebagai JPEG.
// Sisi terpanjang maksimum (px). 3000 px ≈ 250 dpi di kertas A4: tajam untuk cetak,
// tapi jauh lebih ringan daripada foto kamera 12 MP+.
const MAX_SIDE = 3000;

async function toJpeg(file: File, quality: number) {
  const bmp = await createImageBitmap(file);
  const ratio = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * ratio);
  const h = Math.round(bmp.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();

  return { data: canvas.toDataURL("image/jpeg", quality), w, h };
}

// jsPDF menyusun seluruh PDF sebagai satu string JavaScript. Browser membatasi panjang
// string sekitar 512 juta karakter, jadi kita beri batas aman di bawahnya.
const MAX_TOTAL_BYTES = 250 * 1024 * 1024;

export type ProgressCallback = (percent: number, label: string) => void;

// Beri kesempatan browser menggambar ulang layar (supaya bar progres terlihat bergerak)
const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

export async function imagesToPdf(
  files: File[],
  o: ConvertOptions,
  onProgress?: ProgressCallback
): Promise<Blob> {
  const { jsPDF } = await import("jspdf"); // dimuat hanya saat dibutuhkan
  const margin = MARGINS[o.margin].pt;
  let pdf: InstanceType<typeof jsPDF> | null = null;
  let total = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const { data, w, h } = await toJpeg(file, o.quality);

    total += data.length * 0.75; // panjang base64 → perkiraan byte
    if (total > MAX_TOTAL_BYTES) {
      throw new Error(
        "Total ukuran gambar terlalu besar. Kurangi jumlah gambar atau turunkan kualitas."
      );
    }

    // Tentukan ukuran halaman (pt)
    let pw: number;
    let ph: number;
    if (o.mode === "original") {
      // 1 px gambar = 0,75 pt, halaman mengikuti gambar (+ margin)
      pw = w * 0.75 + margin * 2;
      ph = h * 0.75 + margin * 2;
    } else {
      const { w: a, h: b } = PAPER_SIZES[o.paper];
      const landscape = o.orientation === "auto" ? w > h : o.orientation === "landscape";
      pw = landscape ? Math.max(a, b) : Math.min(a, b);
      ph = landscape ? Math.min(a, b) : Math.max(a, b);
    }
    const orient = pw > ph ? "l" : "p";

    if (!pdf) pdf = new jsPDF({ unit: "pt", format: [pw, ph], orientation: orient });
    else pdf.addPage([pw, ph], orient);

    // Gambar dipas ke area di dalam margin, rasio dijaga, posisi di tengah
    const scale = Math.min((pw - margin * 2) / w, (ph - margin * 2) / h);
    const dw = w * scale;
    const dh = h * scale;
    pdf.addImage(data, "JPEG", (pw - dw) / 2, (ph - dh) / 2, dw, dh);

    // 0-90%: memproses gambar satu per satu
    onProgress?.(
      Math.round(((i + 1) / files.length) * 90),
      `Memproses gambar ${i + 1} dari ${files.length}`
    );
    await nextFrame();
  }

  if (!pdf) throw new Error("Tidak ada gambar");
  // 90-100%: menyusun file akhir (tahap ini tidak bisa dipecah, jadi hanya satu langkah)
  onProgress?.(95, "Menyusun file PDF…");
  await nextFrame();
  return pdf.output("blob");
}
