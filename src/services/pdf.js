/**
 * PDF Generation – real Chinese font (Noto Sans TC), not canvas drawing
 */

import { state } from '../state.js';
import { showToast } from '../ui/toast.js';
import { ensureChineseFont, setPdfFont, FONT_NAME } from './pdf-font.js';

export async function generatePDF() {
  const expenses = state.expenses || [];
  if (expenses.length === 0) {
    showToast('未有開支可以生成 PDF', 'warning');
    return;
  }

  if (!window.jspdf) {
    showToast('jsPDF 尚未載入，請重新整理', 'error');
    return;
  }

  showToast('正在載入中文字型並生成 PDF…', 'info');

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    try {
      await ensureChineseFont(doc);
    } catch (fontErr) {
      console.error(fontErr);
      showToast('中文字型載入失敗：' + fontErr.message, 'error');
      return;
    }

    const settings = JSON.parse(localStorage.getItem('expense_settings') || '{}');
    const claimant = settings.name || 'User';
    const company = settings.company || 'Expense Claim';

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageWidth, 22, 'F');

    doc.setTextColor(255, 255, 255);
    setPdfFont(doc, 16);
    doc.text('EXPENSE CLAIM SUMMARY', pageWidth / 2, 12, { align: 'center' });
    setPdfFont(doc, 9);
    doc.text(company + '  ·  ' + new Date().toLocaleDateString('en-GB'), pageWidth / 2, 18, { align: 'center' });

    doc.setTextColor(30, 41, 59);
    setPdfFont(doc, 11);
    doc.text('Claimant: ' + claimant, margin, 32);
    doc.text('Total Receipts: ' + expenses.length, margin, 39);

    const totalAmount = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    setPdfFont(doc, 13);
    doc.setTextColor(16, 185, 129);
    doc.text('Total: HK$' + totalAmount.toFixed(2), pageWidth - margin, 35, { align: 'right' });

    if (doc.autoTable) {
      doc.autoTable({
        startY: 46,
        head: [['#', 'Date', 'Vendor', 'Category', 'Amount', 'Notes']],
        body: expenses.map((e, i) => [
          String(i + 1),
          e.date || '',
          e.vendor || '',
          e.category || '',
          'HK$' + Number(e.amount || 0).toFixed(2),
          (e.notes || '').substring(0, 40)
        ]),
        margin: { left: margin, right: margin },
        styles: {
          font: FONT_NAME,
          fontStyle: 'normal',
          fontSize: 8,
          cellPadding: 2.5,
          textColor: [30, 41, 59],
          overflow: 'linebreak'
        },
        headStyles: {
          font: FONT_NAME,
          fontStyle: 'normal',
          fillColor: [30, 64, 175],
          textColor: 255,
          fontSize: 8
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 22 },
          2: { cellWidth: 42 },
          3: { cellWidth: 22 },
          4: { cellWidth: 24, halign: 'right' },
          5: { cellWidth: 'auto' }
        }
      });
    } else {
      let y = 50;
      expenses.forEach((e, i) => {
        setPdfFont(doc, 9);
        doc.setTextColor(30, 41, 59);
        doc.text((i + 1) + '. ' + (e.date || '') + '  ' + (e.vendor || '') + '  HK$' + Number(e.amount || 0).toFixed(2), margin, y);
        y += 7;
        if (y > pageHeight - 20) {
          doc.addPage();
          y = 20;
        }
      });
    }

    for (let i = 0; i < expenses.length; i++) {
      const exp = expenses[i];
      doc.addPage();
      setPdfFont(doc, 11);

      doc.setFillColor(30, 64, 175);
      doc.rect(0, 0, pageWidth, 18, 'F');

      doc.setTextColor(255, 255, 255);
      setPdfFont(doc, 11);
      doc.text('RECEIPT #' + (i + 1) + ' of ' + expenses.length, margin, 12);
      setPdfFont(doc, 9);
      doc.text((exp.date || '') + ' · HK$' + Number(exp.amount || 0).toFixed(2), pageWidth - margin, 12, { align: 'right' });

      doc.setTextColor(15, 23, 42);
      setPdfFont(doc, 14);
      doc.text(exp.vendor || '—', margin, 28);

      setPdfFont(doc, 10);
      doc.setTextColor(71, 85, 105);
      doc.text('Category: ' + (exp.category || '-'), margin, 36);
      if (exp.notes) {
        doc.text('Notes: ' + exp.notes, margin, 43);
      }

      let imgY = 50;
      const maxImgWidth = pageWidth - margin * 2;
      const receiptImages = exp.images || [];

      if (receiptImages.length > 0) {
        for (let j = 0; j < receiptImages.length; j++) {
          const imgData = receiptImages[j];
          if (j > 0 && imgY > pageHeight - 60) {
            doc.addPage();
            setPdfFont(doc, 10);
            imgY = 25;
          }
          try {
            const imgProps = doc.getImageProperties(imgData);
            let imgWidth = maxImgWidth;
            let imgHeight = (imgProps.height * imgWidth) / imgProps.width;
            const maxHeight = pageHeight - imgY - 25;
            if (imgHeight > maxHeight) {
              const ratio = maxHeight / imgHeight;
              imgHeight = maxHeight;
              imgWidth = imgWidth * ratio;
            }
            if (receiptImages.length > 1) {
              setPdfFont(doc, 9);
              doc.setTextColor(71, 85, 105);
              doc.text('Photo ' + (j + 1) + ' of ' + receiptImages.length, margin, imgY - 3);
            }
            doc.addImage(imgData, 'JPEG', margin, imgY, imgWidth, imgHeight);
            imgY += imgHeight + 12;
          } catch (imgErr) {
            console.error('Image add failed', imgErr);
            setPdfFont(doc, 9);
            doc.setTextColor(239, 68, 68);
            doc.text('[Image #' + (j + 1) + ' failed to load]', margin, imgY);
            imgY += 10;
          }
        }
      } else {
        setPdfFont(doc, 10);
        doc.setTextColor(148, 163, 184);
        doc.text('(No receipt photo attached)', margin, imgY + 10);
      }

      setPdfFont(doc, 7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        'Expense Claim PWA · Confidential · Page ' + doc.internal.getNumberOfPages(),
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      );
    }

    const safeName = String(claimant).replace(/\s+/g, '') || 'User';
    const fileName = 'Expense_Claim_' + safeName + '_' + new Date().toISOString().slice(0, 10) + '.pdf';
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);

    if (typeof window.showPdfPreview === 'function') {
      window.showPdfPreview(url, fileName, blob);
    } else {
      doc.save(fileName);
      showToast('PDF 已生成：' + fileName, 'success');
    }
  } catch (err) {
    console.error('PDF generation failed', err);
    showToast('PDF 生成失敗：' + err.message, 'error');
  }
}
