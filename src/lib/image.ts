// Redueix la foto del tiquet abans de pujar-la: les fotos del mòbil pesen molt
// i per llegir el tiquet n'hi ha prou amb 2000 px pel costat llarg.
export async function shrinkImage(file: File, maxSide = 2000, quality = 0.85): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const euro = new Intl.NumberFormat("ca", { style: "currency", currency: "EUR" });
