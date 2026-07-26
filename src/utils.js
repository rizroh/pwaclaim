/**
 * Shared utilities
 */

export function compressImage(dataUrl, maxWidth = 1200, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxWidth) {
        h = Math.round(h * maxWidth / w);
        w = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function parseReceiptText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  let date = '';
  let amount = 0;
  let vendor = '';

  const datePatterns = [
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/
  ];

  for (let line of lines) {
    for (let pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        date = normalizeToISODate(match[0]);
        break;
      }
    }
    if (date) break;
  }

  const amountPatterns = [
    /(?:total|總計|合計|應付|HKD|HK\$|\$)\s*[:：]?\s*([\d,]+\.?\d{0,2})/i
  ];

  for (let pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0 && amount < 100000) break;
    }
  }

  if (amount === 0) {
    const allNumbers = text.match(/[\d,]+\.\d{2}/g) || [];
    const candidates = allNumbers
      .map(n => parseFloat(n.replace(/,/g, '')))
      .filter(n => n > 5 && n < 50000);
    if (candidates.length) amount = Math.max(...candidates);
  }

  const skipWords = /total|金額|日期|date|invoice|收據|thank/i;
  for (let line of lines.slice(0, 5)) {
    if (line.length > 4 && !datePatterns.some(p => p.test(line)) && !skipWords.test(line)) {
      vendor = line.substring(0, 40).trim();
      break;
    }
  }

  return {
    date: date || new Date().toISOString().split('T')[0],
    amount: amount || 0,
    vendor: vendor || '未知商戶'
  };
}

function normalizeToISODate(rawDate) {
  try {
    const parts = rawDate.replace(/[^\d\/\-]/g, '').split(/[\/\-]/);
    if (parts.length === 3) {
      let [p1, p2, p3] = parts.map(Number);
      if (p1 > 31) {
        return `${p1.toString().padStart(4, '0')}-${p2.toString().padStart(2, '0')}-${p3.toString().padStart(2, '0')}`;
      } else {
        const year = p3 > 100 ? p3 : (p3 > 50 ? 1900 + p3 : 2000 + p3);
        return `${year}-${p2.toString().padStart(2, '0')}-${p1.toString().padStart(2, '0')}`;
      }
    }
  } catch (_) {}
  return new Date().toISOString().split('T')[0];
}

/** Canvas-based Chinese text for jsPDF (avoids font issues) */
export function textToImageData(text, fontSizePx = 28, color = '#0f172a', maxWidthPx = 800) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `500 ${fontSizePx}px "Noto Sans TC", "Microsoft JhengHei", "PingFang TC", sans-serif`;
  const metrics = ctx.measureText(text || '');
  const w = Math.min(Math.ceil(metrics.width) + 8, maxWidthPx);
  const h = Math.ceil(fontSizePx * 1.4);
  canvas.width = w;
  canvas.height = h;
  ctx.font = `500 ${fontSizePx}px "Noto Sans TC", "Microsoft JhengHei", "PingFang TC", sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text || '', 4, h / 2);
  return { dataUrl: canvas.toDataURL('image/png'), widthPx: w, heightPx: h };
}

export function addChineseText(doc, text, xMm, yMm, fontSizePx = 28, color = '#0f172a', maxWidthMm = 120) {
  if (!text) return 0;
  const hasCJK = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
  if (!hasCJK) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSizePx * 0.35);
    doc.setTextColor(color);
    doc.text(text, xMm, yMm);
    return fontSizePx * 0.12;
  }
  const maxWidthPx = Math.round(maxWidthMm * 3.78);
  const img = textToImageData(text, fontSizePx, color, maxWidthPx);
  const wMm = img.widthPx * 0.2646;
  const hMm = img.heightPx * 0.2646;
  doc.addImage(img.dataUrl, 'PNG', xMm, yMm - hMm * 0.75, wMm, hMm);
  return hMm;
}
