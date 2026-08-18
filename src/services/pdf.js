import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { state } from '../state.js';
import { showToast } from '../ui/toast.js';
import { ensureChineseFont, FONT_NAME } from './pdf-font.js';

function useCn(doc, size = 10) {
  try {
    doc.setFont(FONT_NAME, 'normal');
  } catch (_) {
    try { doc.setFont(FONT_NAME); } catch (__) { doc.setFont('helvetica', 'normal'); }
  }
  doc.setFontSize(size);
}

function write(doc, text, x, y, opts, size) {
  if (size) useCn(doc, size);
  else useCn(doc);
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

export async function generatePDF() {
  const expenses = state.expenses || [];
  if (!expenses.length) {
    showToast('未有開支記錄 — 請先新增至少一筆再開 PDF', 'warning', 4500);
    return;
  }

  showToast('正在準備 PDF（含中文字型）…', 'info', 5000);

  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    try {
      await ensureChineseFont(doc);
    } catch (fontErr) {
      console.warn('Chinese font failed', fontErr);
      showToast('中文字型載入失敗，將用基本字型繼續…', 'warning', 3000);
    }

    const settings = JSON.parse(localStorage.getItem('expense_settings') || '{}');
    const claimant = settings.name || 'User';
    const company = settings.company || 'PWACLAIM';
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    useCn(doc, 16);
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageWidth, 22, 'F');
    doc.setTextColor(255, 255, 255);
    write(doc, 'EXPENSE CLAIM SUMMARY', pageWidth / 2, 12, { align: 'center' }, 16);
    write(doc, company + '  ·  ' + new Date().toLocaleDateString('en-GB'), pageWidth / 2, 18, { align: 'center' }, 9);

    doc.setTextColor(30, 41, 59);
    write(doc, 'Claimant: ' + claimant, margin, 32, undefined, 11);
    write(doc, 'Total Receipts: ' + expenses.length, margin, 39, undefined, 11);
    const totalAmount = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    doc.setTextColor(16, 185, 129);
    write(doc, 'Total: HK$' + totalAmount.toFixed(2), pageWidth - margin, 35, { align: 'right' }, 13);

    useCn(doc, 9);
    doc.autoTable({
      startY: 48,
      head: [['Date', 'Vendor', 'Category', 'Amount (HKD)', 'Notes']],
      body: expenses.map((e) => [
        e.date || '',
        e.vendor || '',
        e.category || '',
        Number(e.amount || 0).toFixed(2),
        e.notes || ''
      ]),
      styles: { font: FONT_NAME, fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 64, 175], font: FONT_NAME, fontStyle: 'normal' },
      columnStyles: { 3: { halign: 'right' } },
      margin: { left: margin, right: margin }
    });

    for (let i = 0; i < expenses.length; i++) {
      const e = expenses[i];
      doc.addPage();
      useCn(doc, 14);
      doc.setFillColor(30, 64, 175);
      doc.rect(0, 0, pageWidth, 16, 'F');
      doc.setTextColor(255, 255, 255);
      write(doc, `RECEIPT #${i + 1}`, margin, 11, undefined, 13);

      doc.setTextColor(30, 41, 59);
      let y = 26;
      write(doc, 'Date: ' + (e.date || ''), margin, y, undefined, 11); y += 7;
      write(doc, 'Vendor: ' + (e.vendor || ''), margin, y, undefined, 11); y += 7;
      write(doc, 'Category: ' + (e.category || ''), margin, y, undefined, 11); y += 7;
      write(doc, 'Amount: HK$' + Number(e.amount || 0).toFixed(2), margin, y, undefined, 11); y += 7;
      if (e.notes) {
        write(doc, 'Notes: ' + e.notes, margin, y, { maxWidth: pageWidth - margin * 2 }, 10);
        y += 10;
      }

      const imgs = Array.isArray(e.images) ? e.images : [];
      for (const src of imgs.slice(0, 3)) {
        try {
          const img = await loadImage(src);
          const maxW = pageWidth - margin * 2;
          const maxH = pageHeight - y - 16;
          if (maxH < 30) break;
          let w = maxW;
          let h = (img.height / img.width) * w;
          if (h > maxH) {
            h = maxH;
            w = (img.width / img.height) * h;
          }
          const fmt = src.startsWith('data:image/png') ? 'PNG' : 'JPEG';
          doc.addImage(src, fmt, margin, y, w, h);
          y += h + 4;
        } catch (_) {}
      }
    }

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    if (typeof window.showPdfPreview === 'function') {
      window.showPdfPreview(url, blob);
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = `pwaclaim-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    }
    showToast('PDF 已準備', 'success');
  } catch (err) {
    console.error(err);
    showToast('PDF 失敗：' + err.message, 'error');
  }
}
