/**
 * Compresses image files client-side using HTML5 Canvas so Base64 strings
 * stay compact (~15-35 KB), preventing HTTP 413 (Request Entity Too Large)
 * on Vercel Serverless Functions and fitting cleanly inside Google Sheets cells.
 */
export async function readFileCompressed(
  file: File,
  maxDimension = 820,
  quality = 0.68
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        if (result.length > 2_500_000) {
          resolve(`data:text/plain;base64,${btoa(`Uploaded File: ${file.name} (${Math.round(file.size / 1024)} KB)`)}`);
        } else {
          resolve(result);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        try {
          const renderAtScale = (dimLimit: number, q: number): string => {
            let { width, height } = img;
            if (width > dimLimit || height > dimLimit) {
              if (width >= height) {
                height = Math.round((height * dimLimit) / width);
                width = dimLimit;
              } else {
                width = Math.round((width * dimLimit) / height);
                height = dimLimit;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, width);
            canvas.height = Math.max(1, height);
            const ctx = canvas.getContext('2d');
            if (!ctx) return dataUrl;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/jpeg', q);
          };

          let compressed = renderAtScale(maxDimension, quality);
          // Step down quality/dimension if needed so base64 string fits inside a single Google Sheets cell (<= 34,000 chars)
          const attempts: Array<[number, number]> = [
            [760, 0.58],
            [680, 0.50],
            [600, 0.44],
            [520, 0.38],
          ];
          for (const [dim, q] of attempts) {
            if (compressed.length <= 34000) break;
            compressed = renderAtScale(dim, q);
          }
          resolve(compressed);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}
