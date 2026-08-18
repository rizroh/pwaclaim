/**
 * Load Noto Sans TC TTF into jsPDF (real font)
 * Cached in IndexedDB after first download
 */

import { get, set } from 'idb-keyval';

const FONT_CACHE_KEY = 'pdf_font_noto_sans_tc_b64_v1';
const FONT_URL =
  'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-tc@5.2.5/chinese-traditional-400-normal.ttf';
export const FONT_NAME = 'NotoSansTC';
const FONT_FILE = 'NotoSansTC-Regular.ttf';

let cachedBase64 = null;

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function ensureChineseFont(doc) {
  if (!cachedBase64) {
    cachedBase64 = await get(FONT_CACHE_KEY);
  }

  if (!cachedBase64) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    let res;
    try {
      res = await fetch(FONT_URL, { signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new Error('無法下載中文字型（HTTP ' + res.status + '）');
    const buf = await res.arrayBuffer();
    cachedBase64 = arrayBufferToBase64(buf);
    try {
      await set(FONT_CACHE_KEY, cachedBase64);
    } catch (e) {
      console.warn('Font cache failed', e);
    }
  }

  // Register on this doc instance (must do for each jsPDF document)
  doc.addFileToVFS(FONT_FILE, cachedBase64);
  doc.addFont(FONT_FILE, FONT_NAME, 'normal');
  doc.setFont(FONT_NAME, 'normal');
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
