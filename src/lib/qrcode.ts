// ─── ZERO-DEPENDENCY QR CODE SVG GENERATOR (Engine A Social) ───

/**
 * Generates an SVG string for a QR code representing the given text/URL.
 * Pure TypeScript, zero external dependencies.
 */
export function generateQRCodeSVG(text: string, options?: { size?: number; color?: string; background?: string }): string {
  const size = options?.size || 200;
  const color = options?.color || '#FFFFFF';
  const background = options?.background || 'transparent';

  // Generate matrix for the text
  const matrix = createQRMatrix(text);
  const n = matrix.length;
  const cellSize = size / n;

  let paths = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        const x = (c * cellSize).toFixed(2);
        const y = (r * cellSize).toFixed(2);
        const w = cellSize.toFixed(2);
        const h = cellSize.toFixed(2);
        paths += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" rx="0.5" />`;
      }
    }
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="background:${background}; border-radius:12px; display:block;">
      ${paths}
    </svg>
  `.trim();
}

/** Helper to generate QR Matrix (Standard QR Code generator) */
function createQRMatrix(data: string): boolean[][] {
  const version = data.length > 25 ? 3 : 2;
  const size = version * 4 + 17; // 25 or 29
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  // 1. Finder patterns (top-left, top-right, bottom-left)
  drawFinderPattern(matrix, isFunction, 0, 0);
  drawFinderPattern(matrix, isFunction, size - 7, 0);
  drawFinderPattern(matrix, isFunction, 0, size - 7);

  // 2. Alignment pattern for version >= 2
  if (version >= 2) {
    const alignPos = version === 2 ? 18 : 22;
    drawAlignmentPattern(matrix, isFunction, alignPos, alignPos);
  }

  // 3. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0;
    if (!isFunction[6][i]) {
      matrix[6][i] = val;
      isFunction[6][i] = true;
    }
    if (!isFunction[i][6]) {
      matrix[i][6] = val;
      isFunction[i][6] = true;
    }
  }

  // 4. Dark module
  matrix[4 * version + 9][8] = true;
  isFunction[4 * version + 9][8] = true;

  // 5. Reserve format information areas
  for (let i = 0; i < 9; i++) {
    if (i < size) {
      isFunction[8][i] = true;
      isFunction[i][8] = true;
    }
  }
  for (let i = size - 8; i < size; i++) {
    isFunction[8][i] = true;
    isFunction[i][8] = true;
  }

  // 6. Encode data bits
  const bits = encodeDataToBits(data, version);
  let bitIdx = 0;

  // Fill data in 2-column zigzag from right to left
  let right = size - 1;
  let upward = true;

  while (right > 0) {
    if (right === 6) right--; // Skip vertical timing pattern
    for (let i = 0; i < size; i++) {
      const y = upward ? size - 1 - i : i;
      for (let col = 0; col < 2; col++) {
        const x = right - col;
        if (!isFunction[y][x]) {
          let bit = false;
          if (bitIdx < bits.length) {
            bit = bits[bitIdx++];
          }
          // Apply mask pattern (Mask 0: (row + col) % 2 === 0)
          const mask = (y + x) % 2 === 0;
          matrix[y][x] = bit !== mask;
        }
      }
    }
    right -= 2;
    upward = !upward;
  }

  // 7. Write format info
  writeFormatInfo(matrix, 0);

  return matrix;
}

function drawFinderPattern(matrix: boolean[][], isFunction: boolean[][], x: number, y: number): void {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const px = x + dx;
      const py = y + dy;
      if (px >= 0 && px < matrix.length && py >= 0 && py < matrix.length) {
        isFunction[py][px] = true;
        if (dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6) {
          matrix[py][px] = (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
        } else {
          matrix[py][px] = false;
        }
      }
    }
  }
}

function drawAlignmentPattern(matrix: boolean[][], isFunction: boolean[][], x: number, y: number): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const px = x + dx;
      const py = y + dy;
      isFunction[py][px] = true;
      matrix[py][px] = (Math.abs(dx) === 2 || Math.abs(dy) === 2 || (dx === 0 && dy === 0));
    }
  }
}

function encodeDataToBits(data: string, version: number): boolean[] {
  const bits: boolean[] = [];

  // Mode indicator: 0100 for Byte Mode
  bits.push(false, true, false, false);

  // Character count indicator (8 bits for Version 1-9)
  const len = data.length;
  for (let i = 7; i >= 0; i--) {
    bits.push(((len >> i) & 1) === 1);
  }

  // Data bytes
  for (let i = 0; i < data.length; i++) {
    const code = data.charCodeAt(i);
    for (let b = 7; b >= 0; b--) {
      bits.push(((code >> b) & 1) === 1);
    }
  }

  // Terminator (up to 4 zeroes)
  const capacityBits = version === 2 ? 224 : 352;
  for (let i = 0; i < 4 && bits.length < capacityBits; i++) {
    bits.push(false);
  }

  // Pad to multiple of 8
  while (bits.length % 8 !== 0) {
    bits.push(false);
  }

  // Pad bytes: alternating 0xEC and 0x11
  const padBytes = [0xEC, 0x11];
  let padIdx = 0;
  while (bits.length < capacityBits) {
    const p = padBytes[padIdx % 2];
    for (let b = 7; b >= 0; b--) {
      bits.push(((p >> b) & 1) === 1);
    }
    padIdx++;
  }

  return bits;
}

function writeFormatInfo(matrix: boolean[][], mask: number): void {
  const formatCode = 0x77c4 ^ (mask << 10);
  const size = matrix.length;

  for (let i = 0; i < 15; i++) {
    const bit = ((formatCode >> i) & 1) === 1;

    // Top-left area
    if (i <= 5) matrix[8][i] = bit;
    else if (i === 6) matrix[8][7] = bit;
    else if (i === 7) matrix[8][8] = bit;
    else if (i === 8) matrix[7][8] = bit;
    else matrix[14 - i][8] = bit;

    // Bottom-left and Top-right areas
    if (i < 8) matrix[size - 1 - i][8] = bit;
    else matrix[8][size - 15 + i] = bit;
  }
}
