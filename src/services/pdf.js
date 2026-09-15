import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { state } from '../state.js';
import { showToast } from '../ui/toast.js';
import { ensureChineseFont, FONT_NAME } from './pdf-font.js';

function useFont(doc, fontReady, size = 10) {
  try {
    doc.setFont(fontReady ? FONT_NAME : 'helvetica', 'normal');
  } catch (_) {
    doc.setFont('helvetica', 'normal');
  }
  doc.setFontSize(size);
}

function write(doc, fontReady, text, x, y, opts, size) {
  useFont(doc, fontReady, size || 10);
  doc.text(String(text ?? ''), x, y, opts);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

function toJpegDataUrl(src, maxW = 1400, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (!w || !h) return reject(new Error('empty image'));
      if (w > maxW) {
        h = Math.round((h * maxW) / w);
        w = maxW;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

async function deliverPdf(blob, filename) {
  const file = new File([blob], filename, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return { shared: true, url: null };
    } catch (err) {
      if (err?.name === 'AbortError') return { shared: true, url: null };
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { shared: false, url };
}

export async function generatePDF() {
  const expenses = state.expenses || [];
  if (!expenses.length) {
    showToast('未有開支記錄 — 請先新增至少一筆再開 PDF', 'warning', 4500);
    return;
  }

  showToast('正在準備 PDF…', 'info', 5000);

  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let fontReady = false;
    try {
      await ensureChineseFont(doc);
      fontReady = true;
    } catch (fontErr) {
      console.warn('Chinese font failed', fontErr);
      showToast('中文字型載入失敗，英文／數字會正常，中文可能變空白', 'warning', 3500);
    }

    const settings = JSON.parse(localStorage.getItem('expense_settings') || '{}');
    const claimant = settings.name || 'User';
    const company = settings.company || 'PWACLAIM';
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const tableFont = fontReady ? FONT_NAME : 'helvetica';

    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageWidth, 22, 'F');
    doc.setTextColor(255, 255, 255);
    write(doc, fontReady, '開支索償摘要 / EXPENSE CLAIM', pageWidth / 2, 12, { align: 'center' }, 15);
    write(doc, fontReady, company + '  ·  ' + new Date().toLocaleDateString('en-GB'), pageWidth / 2, 18, { align: 'center' }, 9);

    doc.setTextColor(30, 41, 59);
    write(doc, fontReady, '索償人 / Claimant: ' + claimant, margin, 32, undefined, 11);
    write(doc, fontReady, '收據數量 / Receipts: ' + expenses.length, margin, 39, undefined, 11);
    const totalAmount = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    doc.setTextColor(16, 185, 129);
    write(doc, fontReady, '合計 Total: HK$' + totalAmount.toFixed(2), pageWidth - margin, 35, { align: 'right' }, 13);

    autoTable(doc, {
      startY: 48,
      head: [['日期 Date', '商戶 Vendor', '類別 Category', '金額 HKD', '備註 Notes']],
      body: expenses.map((e) => [
        e.date || '',
        e.vendor || '',
        e.category || '',
        Number(e.amount || 0).toFixed(2),
        e.notes || ''
      ]),
      styles: { font: tableFont, fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 64, 175], font: tableFont, fontStyle: 'normal' },
      columnStyles: { 3: { halign: 'right' } },
      margin: { left: margin, right: margin }
    });

    for (let i = 0; i < expenses.length; i++) {
      const e = expenses[i];
      doc.addPage();
      doc.setFillColor(30, 64, 175);
      doc.rect(0, 0, pageWidth, 16, 'F');
      doc.setTextColor(255, 255, 255);
      write(doc, fontReady, `收據 RECEIPT #${i + 1}`, margin, 11, undefined, 13);

      doc.setTextColor(30, 41, 59);
      let y = 26;
      write(doc, fontReady, '日期 Date: ' + (e.date || ''), margin, y, undefined, 11); y += 7;
      write(doc, fontReady, '商戶 Vendor: ' + (e.vendor || ''), margin, y, undefined, 11); y += 7;
      write(doc, fontReady, '類別 Category: ' + (e.category || ''), margin, y, undefined, 11); y += 7;
      write(doc, fontReady, '金額 Amount: HK$' + Number(e.amount || 0).toFixed(2), margin, y, undefined, 11); y += 7;
      if (e.notes) {
        write(doc, fontReady, '備註 Notes: ' + e.notes, margin, y, { maxWidth: pageWidth - margin * 2 }, 10);
        y += 10;
      }

      const imgs = Array.isArray(e.images) ? e.images : [];
      for (const src of imgs.slice(0, 3)) {
        try {
          const jpeg = await toJpegDataUrl(src);
          const img = await loadImage(jpeg);
          const maxW = pageWidth - margin * 2;
          const maxH = pageHeight - y - 16;
          if (maxH < 30) {
            doc.addPage();
            y = 16;
          }
          let w = maxW;
          let h = (img.height / img.width) * w;
          const fitH = pageHeight - y - 16;
          if (h > fitH) {
            h = fitH;
            w = (img.width / img.height) * h;
          }
          doc.addImage(jpeg, 'JPEG', margin, y, w, h);
          y += h + 4;
        } catch (imgErr) {
          console.warn('receipt image skipped', imgErr);
        }
      }
    }

    const filename = `pwaclaim-${new Date().toISOString().slice(0, 10)}.pdf`;
    const blob = doc.output('blob');

    if (typeof window.showPdfPreview === 'function') {
      const url = URL.createObjectURL(blob);
      window.showPdfPreview(url, blob, filename);
    } else {
      await deliverPdf(blob, filename);
    }
    showToast('PDF 已準備', 'success');
  } catch (err) {
    console.error(err);
    showToast('PDF 失敗：' + (err?.message || String(err)), 'error');
  }
}
