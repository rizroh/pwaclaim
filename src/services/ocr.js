/**
 * Local Tesseract OCR (npm import — no CDN script)
 */

import { createWorker } from 'tesseract.js';
import { parseReceiptText } from '../utils.js';
import { showToast } from '../ui/toast.js';

let tesseractWorker = null;

export async function performLocalOCR(imageDataUrl) {
  if (!imageDataUrl) throw new Error('沒有圖片');

  showToast('本地 AI 正在掃描收據，首次使用需下載語言模型...', 'info');

  if (!tesseractWorker) {
    tesseractWorker = await createWorker('chi_tra+eng');
  }

  const { data } = await tesseractWorker.recognize(imageDataUrl);
  return parseReceiptText(data.text);
}

export async function terminateOCR() {
  if (tesseractWorker) {
    await tesseractWorker.terminate();
    tesseractWorker = null;
  }
}
