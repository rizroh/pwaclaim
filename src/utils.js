export function compressImage(dataUrl, maxWidth = 1200, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w);
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

function normalizeToISODate(s) {
  const parts = String(s).split(/[\/\-]/).map((x) => x.padStart(2, '0'));
  if (parts.length !== 3) return '';
  if (parts[0].length === 4) return `${parts[0]}-${parts[1]}-${parts[2]}`.slice(0, 10);
  const y = parts[2].length === 2 ? '20' + parts[2] : parts[2];
  return `${y}-${parts[1]}-${parts[0]}`.slice(0, 10);
}

export function parseReceiptText(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 2);
  let date = '';
  let amount = 0;
  let vendor = '';

  const datePatterns = [
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/
  ];

  for (const line of lines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        date = normalizeToISODate(match[0]);
        break;
      }
    }
    if (date) break;
  }

  const amountMatch = text.match(/(?:total|總計|合計|應付|HKD|HK\$|\$)\s*[:：]?\s*([\d,]+\.?\d{0,2})/i);
  if (amountMatch) {
    amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  }
  if (!amount) {
    const allNumbers = text.match(/[\d,]+\.\d{2}/g) || [];
    const candidates = allNumbers.map((n) => parseFloat(n.replace(/,/g, ''))).filter((n) => n > 5 && n < 50000);
    if (candidates.length) amount = Math.max(...candidates);
  }

  const skipWords = /total|金額|日期|date|invoice|收據|thank/i;
  for (const line of lines.slice(0, 5)) {
    if (line.length > 4 && !datePatterns.some((p) => p.test(line)) && !skipWords.test(line)) {
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

export function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}
