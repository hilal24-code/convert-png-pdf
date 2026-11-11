"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  MARGINS,
  PAPER_SIZES,
  imagesToPdf,
  sanitizeFileName,
  type MarginPreset,
  type Orientation,
  type PageMode,
  type PaperSize,
} from "@/lib/imagesToPdf";

type Item = { id: string; file: File; url: string };

const ACCEPT = ["image/webp", "image/png", "image/jpeg"];

function Row({
  item,
  index,
  onRemove,
}: {
  item: Item;
  index: number;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  return (
    <li
      ref={setNodeRef}
      className={isDragging ? "dragging" : ""}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="handle"
        aria-label={`Geser untuk mengubah urutan ${item.file.name}`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.url} alt="" />
      <div className="meta">
        <span className="name">{item.file.name}</span>
        <span className="sub">
          Halaman {index + 1} · {(item.file.size / 1024).toFixed(0)} KB
        </span>
      </div>
      <button type="button" onClick={() => onRemove(item.id)}>
        Hapus
      </button>
    </li>
  );
}

export default function Page() {
  const [items, setItems] = useState<Item[]>([]);
  const [fileName, setFileName] = useState("gambar");
  const [mode, setMode] = useState<PageMode>("paper");
  const [paper, setPaper] = useState<PaperSize>("a4");
  const [orientation, setOrientation] = useState<Orientation>("auto");
  const [margin, setMargin] = useState<MarginPreset>("small");
  const [quality, setQuality] = useState(0.9);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; label: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // bebaskan object URL saat komponen ditutup
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  const addFiles = useCallback((list: FileList | File[]) => {
    const all = Array.from(list);
    const valid = all.filter((f) => ACCEPT.includes(f.type));
    setError(
      valid.length < all.length
        ? `${all.length - valid.length} file dilewati. Hanya WebP, PNG, dan JPG yang didukung.`
        : ""
    );
    setItems((prev) => [
      ...prev,
      ...valid.map((file) => ({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
      })),
    ]);
  }, []);

  // Tempel gambar dari clipboard (Ctrl+V), misalnya screenshot
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [addFiles]);

  const remove = (id: string) =>
    setItems((prev) => {
      const t = prev.find((i) => i.id === id);
      if (t) URL.revokeObjectURL(t.url);
      return prev.filter((i) => i.id !== id);
    });

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const from = prev.findIndex((i) => i.id === active.id);
      const to = prev.findIndex((i) => i.id === over.id);
      return arrayMove(prev, from, to);
    });
  };

  const convert = async () => {
    setBusy(true);
    setError("");
    setProgress({ percent: 0, label: "Memulai…" });
    try {
      const blob = await imagesToPdf(
        items.map((i) => i.file),
        { mode, paper, orientation, margin, quality },
        (percent, label) => setProgress({ percent, label })
      );
      setProgress({ percent: 100, label: "Selesai, PDF sedang diunduh" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = sanitizeFileName(fileName);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setTimeout(() => setProgress(null), 2000);
    } catch (e) {
      setProgress(null);
      setError(
        e instanceof RangeError
          ? "PDF terlalu besar untuk dibuat di browser. Kurangi jumlah gambar atau turunkan kualitas."
          : `Gagal membuat PDF: ${e instanceof Error ? e.message : "terjadi kesalahan"}`
      );
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const paperLocked = mode === "original";

  return (
    <main className="wrap">
      <h1>Gambar ke PDF</h1>
      <p className="lead">
        Pilih atau tempel (Ctrl+V) gambar WebP, PNG, atau JPG, atur urutannya, lalu simpan sebagai
        satu PDF. Semua diproses di browser, file tidak diunggah ke server.
      </p>

      <div
        className={`drop ${dragging ? "on" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <p>Tarik gambar ke sini, atau tekan Ctrl+V untuk menempel</p>
        <button type="button" onClick={() => inputRef.current?.click()}>
          Pilih gambar
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(",")}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {items.length > 0 && (
        <>
          <p className="hint">Geser ikon ⠿ untuk mengubah urutan halaman.</p>
          <DndContext
            id="sortable-images"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ul className="list">
                {items.map((it, idx) => (
                  <Row key={it.id} item={it} index={idx} onRemove={remove} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          <fieldset className="opts">
            <label className="full">
              Nama file PDF
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="gambar"
              />
            </label>

            <label>
              Ukuran halaman
              <select value={mode} onChange={(e) => setMode(e.target.value as PageMode)}>
                <option value="paper">Ukuran kertas standar</option>
                <option value="original">Sesuai ukuran gambar</option>
              </select>
            </label>

            <label>
              Ukuran kertas
              <select
                value={paper}
                disabled={paperLocked}
                onChange={(e) => setPaper(e.target.value as PaperSize)}
              >
                {Object.entries(PAPER_SIZES).map(([key, p]) => (
                  <option key={key} value={key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Orientasi
              <select
                value={orientation}
                disabled={paperLocked}
                onChange={(e) => setOrientation(e.target.value as Orientation)}
              >
                <option value="auto">Otomatis (ikuti gambar)</option>
                <option value="portrait">Potret</option>
                <option value="landscape">Lanskap</option>
              </select>
            </label>

            <label>
              Margin
              <select value={margin} onChange={(e) => setMargin(e.target.value as MarginPreset)}>
                {Object.entries(MARGINS).map(([key, m]) => (
                  <option key={key} value={key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="full">
              Kualitas ({Math.round(quality * 100)}%)
              <input
                type="range"
                min={0.4}
                max={1}
                step={0.05}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
              />
            </label>
          </fieldset>

          <div className="bar">
            <button className="primary" onClick={convert} disabled={busy}>
              {busy ? `Memproses… ${progress?.percent ?? 0}%` : `Simpan ${items.length} gambar sebagai PDF`}
            </button>
            <button
              onClick={() => {
                items.forEach((i) => URL.revokeObjectURL(i.url));
                setItems([]);
              }}
            >
              Kosongkan
            </button>
          </div>

          {progress && (
            <div
              className={`progress ${busy ? "busy" : "done"}`}
              role="progressbar"
              aria-label="Progres konversi PDF"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress.percent}
            >
              <div className="progress-head">
                <span>{progress.label}</span>
                <strong>{progress.percent}%</strong>
              </div>
              <div className="track">
                <div className="fill" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
