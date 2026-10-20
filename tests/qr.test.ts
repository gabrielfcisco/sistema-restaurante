import assert from 'node:assert/strict';
import { test } from 'node:test';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
test('QR físico de cinco dígitos mantém zeros à esquerda e pode ser decodificado', () => {
  const code = '01234';
  const matrix = QRCode.create(code, { errorCorrectionLevel: 'M' }).modules;
  const margin = 4, scale = 8, width = (matrix.size + margin * 2) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4);
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      const row = Math.floor(y / scale) - margin, col = Math.floor(x / scale) - margin;
      const black = row >= 0 && col >= 0 && row < matrix.size && col < matrix.size && matrix.get(row, col);
      const index = (y * width + x) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = black ? 0 : 255;
      pixels[index + 3] = 255;
    }
  }
  assert.equal(jsQR(pixels, width, width)?.data, code);
});

