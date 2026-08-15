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

  // Wait for Chinese web fonts so canvas text is not tofu/mojibake
  try {
    if (document.fonts && document.fonts.load) {
      await document.fonts.load('500 28px "Noto Sans TC"');
      await document.fonts.ready;
    }
  } catch (_) {}

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

    // Summary table — draw manually so Chinese uses canvas (autoTable cannot render CJK)
    const col = {
      num: margin,
      date: margin + 8,
      vendor: margin + 32,
      cat: margin + 95,
      amt: pageWidth - margin - 28,
      notes: margin + 32
    };
    let y = 48;
    const rowH = 9;
    const headerH = 8;

    // header bar
    doc.setFillColor(30, 64, 175);
    doc.rect(margin, y - 5, pageWidth - margin * 2, headerH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('#', col.num, y);
    doc.text('Date', col.date, y);
    doc.text('Vendor', col.vendor, y);
    doc.text('Category', col.cat, y);
    doc.text('Amount', col.amt, y, { align: 'right' });
    y += headerH + 2;

    expenses.forEach((e, i) => {
      // new page if needed (leave room for notes line)
      if (y > pageHeight - 22) {
        doc.addPage();
        y = 20;
        doc.setFillColor(30, 64, 175);
        doc.rect(margin, y - 5, pageWidth - margin * 2, headerH, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('#', col.num, y);
        doc.text('Date', col.date, y);
        doc.text('Vendor', col.vendor, y);
        doc.text('Category', col.cat, y);
        doc.text('Amount', col.amt, y, { align: 'right' });
        y += headerH + 2;
      }

      // zebra
      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y - 4.5, pageWidth - margin * 2, rowH + (e.notes ? 5 : 0), 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(String(i + 1), col.num, y);
      doc.text(String(e.date || ''), col.date, y);

      // Chinese-safe fields via canvas
      const vendor = (e.vendor || '').substring(0, 28);
      const category = (e.category || '').substring(0, 14);
      const notes = (e.notes || '').substring(0, 36);
      addChineseText(doc, vendor, col.vendor, y, 18, '#0f172a', 58);
      addChineseText(doc, category, col.cat, y, 18, '#334155', 28);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text('HK$' + Number(e.amount || 0).toFixed(2), col.amt, y, { align: 'right' });

      y += rowH;
      if (notes) {
        addChineseText(doc, notes, col.notes, y - 1, 15, '#64748b', 140);
        y += 5;
      }
    });

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
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    // Preview modal if available
    if (typeof window.showPdfPreview === 'function') {
      window.showPdfPreview(url, fileName, blob);
    } else {
      doc.save(fileName);
      showToast(`PDF 已生成：${fileName}`, 'success');
    }
  } catch (err) {
    console.error('PDF generation failed', err);
    showToast('PDF 生成失敗：' + err.message, 'error');
  }
}
