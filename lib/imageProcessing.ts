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

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

const exploreRegion = (
  startX: number,
  startY: number,
  width: number,
  height: number,
  grayscale: Uint8ClampedArray,
  visited: Uint8Array,
  threshold: number
): { count: number; minX: number; minY: number; maxX: number; maxY: number } => {
  const stack: number[] = [startY * width + startX];
  visited[startY * width + startX] = 1;
  let count = 0;
  let minX = startX;
  let minY = startY;
  let maxX = startX;
  let maxY = startY;

  while (stack.length) {
    const index = stack.pop();
    if (index === undefined) break;
    const x = index % width;
    const y = Math.floor(index / width);
    count += 1;

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;

    const neighbors = [
      { x: x - 1, y },
      { x: x + 1, y },
      { x, y: y - 1 },
      { x, y: y + 1 }
    ];

    for (const neighbor of neighbors) {
      if (neighbor.x < 0 || neighbor.x >= width || neighbor.y < 0 || neighbor.y >= height) continue;
      const neighborIndex = neighbor.y * width + neighbor.x;
      if (visited[neighborIndex]) continue;
      const value = grayscale[neighborIndex];
      if (value > threshold + 20) continue;
      visited[neighborIndex] = 1;
      stack.push(neighborIndex);
    }
  }

  return { count, minX, minY, maxX, maxY };
};

const blurRegion = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 4
) => {
  if (width <= 0 || height <= 0) return;
  const imageData = context.getImageData(x, y, width, height);
  const { data } = imageData;
  const temp = new Uint8ClampedArray(data.length);
  const output = new Uint8ClampedArray(data.length);

  const channels = 4;

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const destIndex = (row * width + col) * channels;
      for (let channel = 0; channel < channels; channel += 1) {
        let sum = 0;
        let count = 0;
        for (let offset = -radius; offset <= radius; offset += 1) {
          const current = col + offset;
          if (current < 0 || current >= width) continue;
          const index = (row * width + current) * channels + channel;
          sum += data[index];
          count += 1;
        }
        temp[destIndex + channel] = sum / count;
      }
    }
  }

  for (let col = 0; col < width; col += 1) {
    for (let row = 0; row < height; row += 1) {
      const destIndex = (row * width + col) * channels;
      for (let channel = 0; channel < channels; channel += 1) {
        let sum = 0;
        let count = 0;
        for (let offset = -radius; offset <= radius; offset += 1) {
          const current = row + offset;
          if (current < 0 || current >= height) continue;
          const index = (current * width + col) * channels + channel;
          sum += temp[index];
          count += 1;
        }
        output[destIndex + channel] = sum / count;
      }
    }
  }

  const blurred = new ImageData(output, width, height);
  context.putImageData(blurred, x, y);
};

const blurPotentialPii = (source: HTMLCanvasElement): HTMLCanvasElement => {
  const { width, height } = source;
  const context = source.getContext('2d', { willReadFrequently: true });
  if (!context) return source;

  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;
  const grayscale = new Uint8ClampedArray(width * height);
  const visited = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i += 1) {
    const index = i * 4;
    grayscale[i] = luminance(data[index], data[index + 1], data[index + 2]);
  }

  const regions: Region[] = [];
  const darkThreshold = 180;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (visited[index]) continue;
      if (grayscale[index] > darkThreshold) {
        visited[index] = 1;
        continue;
      }
      const region = exploreRegion(x, y, width, height, grayscale, visited, darkThreshold);
      if (region.count < 120) continue;
      const regionWidth = region.maxX - region.minX + 1;
      const regionHeight = region.maxY - region.minY + 1;
      const density = region.count / (regionWidth * regionHeight);
      if (density < 0.2) continue;
      if (regionWidth < width * 0.1 && regionHeight < height * 0.05) continue;
      const margin = 6;
      const regionX = Math.max(0, region.minX - margin);
      const regionY = Math.max(0, region.minY - margin);
      const cropWidth = Math.min(width - regionX, regionWidth + margin * 2);
      const cropHeight = Math.min(height - regionY, regionHeight + margin * 2);
      regions.push({ x: regionX, y: regionY, width: cropWidth, height: cropHeight });
    }
  }

  for (const region of regions) {
    blurRegion(context, region.x, region.y, region.width, region.height, 5);
  }

  return source;
};

export const processImageFile = async (file: File): Promise<ProcessedImage> => {
  const originalCanvas = await drawFileToCanvas(file);
  const deskewedCanvas = deskewCanvas(originalCanvas);
  const croppedCanvas = trimMargins(deskewedCanvas);
  const blurredCanvas = blurPotentialPii(croppedCanvas);

  const dataUrl = blurredCanvas.toDataURL('image/jpeg', 0.92);

  return {
    dataUrl,
    width: blurredCanvas.width,
    height: blurredCanvas.height,
    originalWidth: originalCanvas.width,
    originalHeight: originalCanvas.height
  };
};
