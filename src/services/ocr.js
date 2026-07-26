/**
 * Local Tesseract OCR Service
 */

import { parseReceiptText } from '../utils.js';
import { showToast } from '../ui/toast.js';

let tesseractWorker = null;

export async function performLocalOCR(imageDataUrl) {
  if (!imageDataUrl) throw new Error('沒有圖片');

  showToast('本地 AI 正在掃描收據，首次使用需下載語言模型...', 'info');

  if (!window.Tesseract) {
    throw new Error('Tesseract 尚未載入，請重新整理頁面');
  }

  if (!tesseractWorker) {
    tesseractWorker = await window.Tesseract.createWorker('chi_tra+eng');
  }

  const { data } = await tesseractWorker.recognize(imageDataUrl);
  console.log('Tesseract OCR Output:', data.text);

  return parseReceiptText(data.text);
}

export async function terminateOCR() {
  if (tesseractWorker) {
    await tesseractWorker.terminate();
    tesseractWorker = null;
  }
}
