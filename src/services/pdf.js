/**
 * PDF Generation Service
 * Ported & adapted from original (supports Chinese via canvas)
 */

import { state } from '../state.js';
import { showToast } from '../ui/toast.js';
import { addChineseText } from '../utils.js';

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

  showToast('正在生成 PDF（支援中文）...', 'info');

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const settings = JSON.parse(localStorage.getItem('expense_settings') || '{}');
    const claimant = settings.name || localStorage.getItem('grok_name') || 'User';
    const company = settings.company || 'Expense Claim';

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    // ========== PAGE 1: SUMMARY ==========
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageWidth, 22, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('EXPENSE CLAIM SUMMARY', pageWidth / 2, 14, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    addChineseText(doc, `${company}  •  ${new Date().toLocaleDateString('en-GB')}`, pageWidth / 2 - 40, 19, 18, '#ffffff', 100);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.text('Claimant:', margin, 32);
    addChineseText(doc, claimant, margin + 22, 32, 26, '#0f172a', 80);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Total Receipts: ${expenses.length}`, margin, 40);

    const totalAmount = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    doc.setFontSize(13);
    doc.setTextColor(16, 185, 129);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: HK$${totalAmount.toFixed(2)}`, pageWidth - margin, 36, { align: 'right' });

    // Summary table
    if (doc.autoTable) {
      doc.autoTable({
        startY: 48,
        head: [['#', 'Date', 'Vendor', 'Category', 'Amount', 'Notes']],
        body: expenses.map((e, i) => [
          i + 1,
          e.date,
          e.vendor || '',
          e.category || '',
          'HK$' + Number(e.amount).toFixed(2),
          (e.notes || '').substring(0, 40)
        ]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [30, 64, 175], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });
    } else {
      let y = 50;
      expenses.forEach((e, i) => {
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text(`${i + 1}. ${e.date}  ${e.vendor}  HK$${Number(e.amount).toFixed(2)}`, margin, y);
        y += 7;
        if (y > pageHeight - 20) {
          doc.addPage();
          y = 20;
        }
      });
    }

    // ========== RECEIPT DETAIL PAGES ==========
    for (let i = 0; i < expenses.length; i++) {
      const exp = expenses[i];
      doc.addPage();

      doc.setFillColor(30, 64, 175);
      doc.rect(0, 0, pageWidth, 18, 'F');

      doc.setTextColor(255);
      doc.setFontSize(11);
      doc.text(`RECEIPT #${i + 1} of ${expenses.length}`, margin, 12);

      doc.setFontSize(9);
      doc.text(`${exp.date} • HK$${Number(exp.amount).toFixed(2)}`, pageWidth - margin, 12, { align: 'right' });

      doc.setTextColor(15, 23, 42);
      addChineseText(doc, exp.vendor || '—', margin, 28, 32, '#0f172a', 160);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`Category: ${exp.category || '-'}`, margin, 36);
      if (exp.notes) {
        doc.text('Notes:', margin, 43);
        addChineseText(doc, exp.notes, margin + 16, 43, 22, '#475569', 140);
      }

      let imgY = 50;
      const maxImgWidth = pageWidth - margin * 2;
      const receiptImages = exp.images || [];

      if (receiptImages.length > 0) {
        for (let j = 0; j < receiptImages.length; j++) {
          const imgData = receiptImages[j];

          if (j > 0 && imgY > pageHeight - 60) {
            doc.addPage();
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
              doc.setFontSize(9);
              doc.setTextColor(71, 85, 105);
              doc.text(`Photo ${j + 1} of ${receiptImages.length}`, margin, imgY - 3);
            }

            doc.addImage(imgData, 'JPEG', margin, imgY, imgWidth, imgHeight);
            imgY += imgHeight + 12;
          } catch (imgErr) {
            console.error('Image add failed', imgErr);
            doc.setTextColor(239, 68, 68);
            doc.setFontSize(9);
            doc.text(`[Image #${j + 1} failed to load]`, margin, imgY);
            imgY += 10;
          }
        }
      } else {
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        doc.text('(No receipt photo attached)', margin, imgY + 10);
      }

      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Expense Claim PWA • Confidential • Page ${doc.internal.getNumberOfPages()}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      );
    }

    const safeName = claimant.replace(/\s+/g, '') || 'User';
    const fileName = `Expense_Claim_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    showToast(`PDF 已生成：${fileName}`, 'success');
  } catch (err) {
    console.error('PDF generation failed', err);
    showToast('PDF 生成失敗：' + err.message, 'error');
  }
}
