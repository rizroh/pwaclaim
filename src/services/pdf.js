/**
 * PDF Generation – Noto Sans TC font for ALL pages (summary + receipt)
 */

import { state } from '../state.js';
import { showToast } from '../ui/toast.js';
import { ensureChineseFont, FONT_NAME } from './pdf-font.js';

/** Always re-apply CJK font (jsPDF resets font on addPage) */
function useCn(doc, size = 10) {
  try {
    doc.setFont(FONT_NAME, 'normal');
  } catch (_) {
    try {
      doc.setFont(FONT_NAME);
    } catch (__) {
      doc.setFont('helvetica', 'normal');
    }
  }
  doc.setFontSize(size);
}

function write(doc, text, x, y, opts, size) {
  if (size) useCn(doc, size);
  else useCn(doc);
  doc.text(String(text ?? ''), x, y, opts);
}

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

    // ========== PAGE 1: SUMMARY ==========
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

    useCn(doc, 8);
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
        },
        didParseCell: function (data) {
          // force font on every cell
          data.cell.styles.font = FONT_NAME;
          data.cell.styles.fontStyle = 'normal';
        }
      });
    }

    // ========== RECEIPT DETAIL PAGES ==========
    for (let i = 0; i < expenses.length; i++) {
      const exp = expenses[i];
      doc.addPage();
      // CRITICAL: re-apply font after every addPage
      useCn(doc, 11);

      doc.setFillColor(30, 64, 175);
      doc.rect(0, 0, pageWidth, 18, 'F');

      doc.setTextColor(255, 255, 255);
      write(doc, 'RECEIPT #' + (i + 1) + ' of ' + expenses.length, margin, 12, undefined, 11);
      write(
        doc,
        (exp.date || '') + ' · HK$' + Number(exp.amount || 0).toFixed(2),
        pageWidth - margin,
        12,
        { align: 'right' },
        9
      );

      // Vendor / Category / Notes — must useCn each time
      doc.setTextColor(15, 23, 42);
      write(doc, exp.vendor || '—', margin, 28, undefined, 14);

      doc.setTextColor(71, 85, 105);
      write(doc, 'Category: ' + (exp.category || '-'), margin, 36, undefined, 10);
      if (exp.notes) {
        write(doc, 'Notes: ' + exp.notes, margin, 43, undefined, 10);
      }

      let imgY = 52;
      const maxImgWidth = pageWidth - margin * 2;
      const receiptImages = exp.images || [];

      if (receiptImages.length > 0) {
        for (let j = 0; j < receiptImages.length; j++) {
          const imgData = receiptImages[j];
          if (j > 0 && imgY > pageHeight - 60) {
            doc.addPage();
            useCn(doc, 10); // re-apply after addPage
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
              doc.setTextColor(71, 85, 105);
              write(doc, 'Photo ' + (j + 1) + ' of ' + receiptImages.length, margin, imgY - 3, undefined, 9);
            }
            doc.addImage(imgData, 'JPEG', margin, imgY, imgWidth, imgHeight);
            imgY += imgHeight + 12;
          } catch (imgErr) {
            console.error('Image add failed', imgErr);
            doc.setTextColor(239, 68, 68);
            write(doc, '[Image #' + (j + 1) + ' failed to load]', margin, imgY, undefined, 9);
            imgY += 10;
          }
        }
      } else {
        doc.setTextColor(148, 163, 184);
        write(doc, '(No receipt photo attached)', margin, imgY + 10, undefined, 10);
      }

      doc.setTextColor(148, 163, 184);
      write(
        doc,
        'Expense Claim PWA · Confidential · Page ' + doc.internal.getNumberOfPages(),
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' },
        7
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
