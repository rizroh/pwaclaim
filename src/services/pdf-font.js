/**
 * Load Noto Sans TC TTF into jsPDF (real font, not canvas)
 * Cached in IndexedDB after first download (~2.2MB)
 */

import { get, set } from 'idb-keyval';

const FONT_CACHE_KEY = 'pdf_font_noto_sans_tc_b64_v1';
const FONT_URL =
  'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-tc@5.2.5/chinese-traditional-400-normal.ttf';
const FONT_NAME = 'NotoSansTC';
const FONT_FILE = 'NotoSansTC-Regular.ttf';

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

let fontReady = false;

export async function ensureChineseFont(doc) {
  if (fontReady) {
    try {
      doc.setFont(FONT_NAME, 'normal');
      return true;
    } catch (_) {
      fontReady = false;
    }
  }

  let base64 = await get(FONT_CACHE_KEY);

  if (!base64) {
    const res = await fetch(FONT_URL);
    if (!res.ok) throw new Error('無法下載中文字型（HTTP ' + res.status + '）');
    const buf = await res.arrayBuffer();
    base64 = arrayBufferToBase64(buf);
    try {
      await set(FONT_CACHE_KEY, base64);
    } catch (e) {
      console.warn('Font cache failed', e);
    }
  }

  doc.addFileToVFS(FONT_FILE, base64);
  doc.addFont(FONT_FILE, FONT_NAME, 'normal');
  doc.setFont(FONT_NAME, 'normal');
  fontReady = true;
  return true;
}

export function setPdfFont(doc, size = 10) {
  try {
    doc.setFont(FONT_NAME, 'normal');
  } catch (_) {
    doc.setFont('helvetica', 'normal');
  }
  doc.setFontSize(size);
}

export { FONT_NAME };
