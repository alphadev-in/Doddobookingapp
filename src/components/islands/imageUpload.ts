// Resize a picture in the browser and return a compact data: URL (JPEG), so it can be stored with the business.
export async function resizeToDataUrl(file: File, maxSide: number, maxChars = 330_000): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Please choose a JPEG, PNG or WebP picture.');
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('That picture could not be read.'); });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process this picture.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  // Lower the quality until the result fits the storage limit.
  for (const q of [0.86, 0.78, 0.7, 0.6, 0.5]) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (url.length <= maxChars) return url;
  }
  throw new Error('This picture is too detailed. Please choose a smaller one.');
}
