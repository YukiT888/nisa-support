'use client';

export interface ProcessedImage {
  dataUrl: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const readFileAsDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

const loadImageElement = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    image.src = src;
  });

const drawFileToCanvas = async (file: File): Promise<HTMLCanvasElement> => {
  if (typeof window === 'undefined') {
    throw new Error('Canvas API is not available');
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas context could not be created');
  }

  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file);
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
  } else {
    const dataUrl = await readFileAsDataUrl(file);
    const image = await loadImageElement(dataUrl);
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    context.drawImage(image, 0, 0);
  }

  return canvas;
};

const deskewCanvas = (source: HTMLCanvasElement): HTMLCanvasElement => {
  const { width, height } = source;
  const context = source.getContext('2d', { willReadFrequently: true });
  if (!context) return source;

  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;

  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumYY = 0;
  let sumXY = 0;
  let weightSum = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const lightness = luminance(data[index], data[index + 1], data[index + 2]);
      const weight = 255 - lightness;
      if (weight < 30) continue;
      sumX += weight * x;
      sumY += weight * y;
      sumXX += weight * x * x;
      sumYY += weight * y * y;
      sumXY += weight * x * y;
      weightSum += weight;
    }
  }

  if (weightSum === 0) return source;

  const meanX = sumX / weightSum;
  const meanY = sumY / weightSum;
  const covXX = sumXX / weightSum - meanX * meanX;
  const covYY = sumYY / weightSum - meanY * meanY;
  const covXY = sumXY / weightSum - meanX * meanY;

  if (!Number.isFinite(covXX) || !Number.isFinite(covYY) || !Number.isFinite(covXY)) {
    return source;
  }

  let angle = 0.5 * Math.atan2(2 * covXY, covXX - covYY);
  if (!Number.isFinite(angle)) return source;

  if (Math.abs(angle) > Math.PI / 4) {
    angle -= Math.sign(angle) * Math.PI * 0.5;
  }

  if (Math.abs(angle) < toRadians(0.5)) {
    return source;
  }

  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const newWidth = Math.round(Math.abs(width * cos) + Math.abs(height * sin));
  const newHeight = Math.round(Math.abs(width * sin) + Math.abs(height * cos));

  const rotatedCanvas = document.createElement('canvas');
  rotatedCanvas.width = newWidth;
  rotatedCanvas.height = newHeight;
  const rotatedContext = rotatedCanvas.getContext('2d');
  if (!rotatedContext) return source;

  rotatedContext.translate(newWidth / 2, newHeight / 2);
  rotatedContext.rotate(-angle);
  rotatedContext.drawImage(source, -width / 2, -height / 2);

  return rotatedCanvas;
};

const trimMargins = (source: HTMLCanvasElement): HTMLCanvasElement => {
  const { width, height } = source;
  const context = source.getContext('2d', { willReadFrequently: true });
  if (!context) return source;

  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  let top = height;
  let bottom = 0;
  let left = width;
  let right = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const lightness = luminance(data[index], data[index + 1], data[index + 2]);
      if (lightness > 245) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }

  if (left >= right || top >= bottom) {
    return source;
  }

  const padding = 8;
  const cropLeft = Math.max(0, left - padding);
  const cropTop = Math.max(0, top - padding);
  const cropRight = Math.min(width - 1, right + padding);
  const cropBottom = Math.min(height - 1, bottom + padding);

  const cropWidth = cropRight - cropLeft + 1;
  const cropHeight = cropBottom - cropTop + 1;

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;
  const croppedContext = croppedCanvas.getContext('2d');
  if (!croppedContext) return source;

  croppedContext.drawImage(source, -cropLeft, -cropTop);

  return croppedCanvas;
};

export const processImageFile = async (file: File): Promise<ProcessedImage> => {
  const originalCanvas = await drawFileToCanvas(file);
  const deskewedCanvas = deskewCanvas(originalCanvas);
  const croppedCanvas = trimMargins(deskewedCanvas);

  const dataUrl = croppedCanvas.toDataURL('image/jpeg', 0.92);

  return {
    dataUrl,
    width: croppedCanvas.width,
    height: croppedCanvas.height,
    originalWidth: originalCanvas.width,
    originalHeight: originalCanvas.height
  };
};
