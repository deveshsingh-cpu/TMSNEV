import { jsPDF } from 'jspdf';
import { FeeInvoice, StudentMember } from '../types/index.js';
import { openHtmlPrintPreview } from './exportPrint.js';

export interface PrintableLetterTarget {
  member: StudentMember;
  letterNo: string;
  issueDate: string;
  deadlineDate: string;
  lateFineAmount?: number;
  baseOverdueAmount?: number;
}

export function getDefault30thOfCurrentMonth(refDateStr?: string): string {
  const todayIso = new Date().toISOString().slice(0, 10);
  const baseYm =
    refDateStr && /^\d{4}-\d{2}/.test(refDateStr)
      ? refDateStr.slice(0, 7)
      : todayIso.slice(0, 7);
  const [yrStr, moStr] = baseYm.split('-');
  const lastDay = new Date(Number(yrStr), Number(moStr), 0).getDate();
  const targetDay = Math.min(30, lastDay);
  return `${yrStr}-${moStr}-${String(targetDay).padStart(2, '0')}`;
}

export function formatLetterDateDisplay(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '30th of Month';
  const [yyyy, mm, dd] = isoDate.split('-');
  return `${dd}-${mm}-${yyyy}`;
}

export function getApplicableLateFineForStudent(
  member: StudentMember,
  invoices: FeeInvoice[],
  issueDateStr?: string
): number {
  const refIso = issueDateStr || new Date().toISOString().slice(0, 10);
  if ((Number(member.balanceDue) || 0) <= 0) return 0;
  const issueDay = Number(refIso.split('-')[2] || 1);
  if (issueDay > 10) return 100;
  const currentYm = refIso.slice(0, 7);
  const hasPastOverdueInvoice = invoices.some(
    (i) =>
      (i.studentId === member.id || i.admissionNo === member.admissionNo) &&
      i.balanceDue > 0 &&
      ((i.dueDate && i.dueDate < refIso) || (i.month && i.month < currentYm))
  );
  return hasPastOverdueInvoice ? 100 : 0;
}

export function downloadWarningLettersPdf(
  targetMembers: PrintableLetterTarget[],
  options: {
    invoices: FeeInvoice[];
    schoolName?: string;
    selectedMonth?: string;
    customFilename?: string;
  }
) {
  if (targetMembers.length === 0) return;
  const { invoices, schoolName, selectedMonth = '2026-11', customFilename } = options;
  const todayIso = new Date().toISOString().slice(0, 10);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 12;
  const boxW = pageW - margin * 2;

  targetMembers.forEach((item, idx) => {
    if (idx > 0) doc.addPage();
    const { member, letterNo, issueDate, deadlineDate } = item;
    const stuInvoices = invoices.filter(
      (i) =>
        (i.studentId === member.id || i.admissionNo === member.admissionNo) && i.balanceDue > 0
    );
    const baseDues =
      item.baseOverdueAmount !== undefined
        ? Math.max(0, Number(item.baseOverdueAmount))
        : Math.max(0, Number(member.balanceDue) || 0);
    const lateFine =
      item.lateFineAmount !== undefined ? Math.max(0, Number(item.lateFineAmount)) : 0;
    const totalPayable = baseDues + lateFine;
    const periodStr =
      stuInvoices.length > 0
        ? stuInvoices.map((i) => i.month).join(', ')
        : `Up to ${selectedMonth}`;
    const formattedDeadline = formatLetterDateDisplay(deadlineDate);
    const formattedIssue = formatLetterDateDisplay(issueDate);

    // Outer Formal Letter Border
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.6);
    doc.roundedRect(margin, 10, boxW, 276, 2.5, 2.5);

    // School Header
    let y = 19;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `${(schoolName || 'Narendra Edu Valley').toUpperCase()} - TRANSPORT DEPARTMENT`,
      pageW / 2,
      y,
      { align: 'center' }
    );
    y += 6;
    doc.setFontSize(10.5);
    doc.setTextColor(185, 28, 28);
    doc.text('WARNING CUM REMINDER LETTER', pageW / 2, y, { align: 'center' });
    y += 4;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(margin + 6, y, pageW - margin - 6, y);

    // Letter Meta Row
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(`Letter Ref No: ${letterNo}`, margin + 6, y);
    doc.text(`Issue Date: ${formattedIssue}`, pageW - margin - 6, y, { align: 'right' });

    // Recipient Box
    y += 4;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin + 6, y, boxW - 12, 24, 1.5, 1.5, 'FD');
    let ry = y + 5;
    doc.setFontSize(8.8);
    doc.setFont('helvetica', 'bold');
    doc.text('To,', margin + 9, ry);
    ry += 4.6;
    doc.setFont('helvetica', 'normal');
    const guardianLine = `Guardian: ${member.fatherName || 'Parent / Guardian'} (Ward: ${member.name}, ID: ${member.admissionNo}, Class: ${member.class}-${member.section})`;
    doc.text(doc.splitTextToSize(guardianLine, boxW - 18)[0] || guardianLine, margin + 9, ry);
    ry += 4.6;
    const addrLine = `Address: ${member.address || member.villageName || 'Registered Address'} (${member.pickupDropStopName || 'Assigned Stop'})`;
    doc.text(doc.splitTextToSize(addrLine, boxW - 18)[0] || addrLine, margin + 9, ry);
    ry += 4.6;
    doc.text(
      `Phone No: ${member.mobile || member.emergencyContact || '-'}   |   Route: ${member.routeCode || 'Assigned Route'}`,
      margin + 9,
      ry
    );

    // Subject
    y += 29;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    const subjText = `Subject: Pending Transport Fee Dues (${periodStr}) - Deposit on or before ${formattedDeadline}`;
    doc.text(doc.splitTextToSize(subjText, boxW - 12)[0] || subjText, margin + 6, y);
    y += 2.5;
    doc.line(margin + 6, y, pageW - margin - 6, y);

    // Salutation & Body
    y += 5.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Dear Sir / Madam,', margin + 6, y);
    y += 4.8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.6);
    const introLines = doc.splitTextToSize(
      `This is an official reminder from the School Transport Department regarding the pending transport fee dues of your ward ${member.name} (Admission No: ${member.admissionNo}, Class: ${member.class}-${member.section}, Stop: ${member.pickupDropStopName || member.villageName || '-'}). Kindly review the statement of unpaid transport dues below:`,
      boxW - 12
    );
    doc.text(introLines, margin + 6, y);
    y += introLines.length * 4.2 + 2;

    // Dues Table
    const colX = [
      margin + 6,
      margin + 36,
      margin + 74,
      margin + 102,
      margin + 128,
      margin + 152,
      pageW - margin - 6,
    ];
    const drawTableRow = (
      cells: string[],
      rowY: number,
      opts?: { header?: boolean; bold?: boolean; highlightRed?: boolean }
    ) => {
      const rowH = 6.2;
      if (opts?.header) {
        doc.setFillColor(241, 245, 249);
        doc.rect(colX[0], rowY, colX[6] - colX[0], rowH, 'F');
      } else if (opts?.highlightRed) {
        doc.setFillColor(254, 242, 242);
        doc.rect(colX[0], rowY, colX[6] - colX[0], rowH, 'F');
      }
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.25);
      doc.rect(colX[0], rowY, colX[6] - colX[0], rowH);
      for (let c = 1; c < 6; c++) {
        doc.line(colX[c], rowY, colX[c], rowY + rowH);
      }
      doc.setFont('helvetica', opts?.header || opts?.bold ? 'bold' : 'normal');
      doc.setFontSize(8);
      doc.setTextColor(
        opts?.highlightRed ? 185 : 15,
        opts?.highlightRed ? 28 : 23,
        opts?.highlightRed ? 28 : 42
      );
      doc.text(cells[0] || '', colX[0] + 1.8, rowY + 4.2);
      doc.text(cells[1] || '', colX[1] + 1.8, rowY + 4.2);
      doc.text(cells[2] || '', colX[3] - 1.8, rowY + 4.2, { align: 'right' });
      doc.text(cells[3] || '', colX[4] - 1.8, rowY + 4.2, { align: 'right' });
      doc.text(cells[4] || '', colX[5] - 1.8, rowY + 4.2, { align: 'right' });
      doc.text(cells[5] || '', colX[6] - 1.8, rowY + 4.2, { align: 'right' });
      doc.setTextColor(15, 23, 42);
      return rowY + rowH;
    };

    y = drawTableRow(
      ['Period', 'Invoice Ref', 'Base Fee', 'Concession', 'Paid', 'Balance Due'],
      y,
      { header: true }
    );

    const maxInvoiceRows = Math.min(stuInvoices.length, 8);
    if (maxInvoiceRows > 0) {
      for (let r = 0; r < maxInvoiceRows; r++) {
        const inv = stuInvoices[r];
        y = drawTableRow(
          [
            String(inv.month || '').slice(0, 14),
            String(inv.invoiceNo || '').slice(0, 18),
            `Rs. ${inv.baseFee}`,
            `Rs. ${inv.concession}`,
            `Rs. ${inv.paidAmount}`,
            `Rs. ${inv.balanceDue}`,
          ],
          y
        );
      }
      if (stuInvoices.length > maxInvoiceRows) {
        const extraBal = stuInvoices
          .slice(maxInvoiceRows)
          .reduce((s, inv) => s + (inv.balanceDue || 0), 0);
        y = drawTableRow(
          [
            `+${stuInvoices.length - maxInvoiceRows} more`,
            'CONSOLIDATED',
            '-',
            '-',
            '-',
            `Rs. ${extraBal}`,
          ],
          y
        );
      }
    } else {
      y = drawTableRow(
        [
          periodStr.slice(0, 14),
          'OPEN-BAL',
          `Rs. ${member.monthlyFee || baseDues}`,
          `Rs. ${member.concessionAmount || 0}`,
          'Rs. 0',
          `Rs. ${baseDues}`,
        ],
        y
      );
    }

    const drawSummaryRow = (label: string, val: string, rowY: number, isTotal = false) => {
      const rowH = 6.2;
      if (isTotal) {
        doc.setFillColor(254, 242, 242);
        doc.rect(colX[0], rowY, colX[6] - colX[0], rowH, 'F');
      }
      doc.setDrawColor(148, 163, 184);
      doc.rect(colX[0], rowY, colX[6] - colX[0], rowH);
      doc.line(colX[5], rowY, colX[5], rowY + rowH);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isTotal ? 8.6 : 8);
      doc.setTextColor(isTotal ? 185 : 51, isTotal ? 28 : 65, isTotal ? 28 : 85);
      doc.text(label, colX[5] - 2.2, rowY + 4.2, { align: 'right' });
      doc.text(val, colX[6] - 1.8, rowY + 4.2, { align: 'right' });
      doc.setTextColor(15, 23, 42);
      return rowY + rowH;
    };

    y = drawSummaryRow(
      'Pending Transport Fee Dues:',
      `Rs. ${baseDues.toLocaleString('en-IN')}`,
      y,
      false
    );
    y = drawSummaryRow(
      lateFine > 0
        ? 'Applicable Late Fine (After 10th Due Date):'
        : 'Late Fine (Rs. 100 applicable if paid after 10th):',
      lateFine > 0 ? `+ Rs. ${lateFine.toLocaleString('en-IN')}` : 'Rs. 0',
      y,
      false
    );
    y = drawSummaryRow(
      'TOTAL OVERDUE AMOUNT PAYABLE:',
      `Rs. ${totalPayable.toLocaleString('en-IN')}`,
      y,
      true
    );

    // Deposit Deadline Notice
    y += 5.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(185, 28, 28);
    const deadlineNotice = doc.splitTextToSize(
      `Kindly deposit the total payable amount of Rs. ${totalPayable.toLocaleString('en-IN')} on or before ${formattedDeadline} to avoid suspension of transport facility.`,
      boxW - 12
    );
    doc.text(deadlineNotice, margin + 6, y);
    y += deadlineNotice.length * 4.2 + 1;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.3);
    doc.setTextColor(15, 23, 42);
    const noteLines = doc.splitTextToSize(
      `In case of any genuine difficulty, please visit the school transport office in person with a written application before ${formattedDeadline}.`,
      boxW - 12
    );
    doc.text(noteLines, margin + 6, y);
    y += noteLines.length * 4.2 + 6;

    // Signature Row
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.text('Regards,', margin + 6, y);
    doc.text('Transport Coordinator', margin + 6, y + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.text(schoolName || 'Narendra Edu Valley', margin + 6, y + 9);
    doc.setFont('helvetica', 'italic');
    doc.text('(Office Seal & Sign)', pageW - margin - 6, y + 9, { align: 'right' });

    // Tear-Off Acknowledgement Slip at Bottom
    const slipTop = Math.max(y + 15, 230);
    doc.setDrawColor(100, 116, 139);
    doc.setLineDashPattern([2, 1.5], 0);
    doc.line(margin + 4, slipTop, pageW - margin - 4, slipTop);
    doc.setLineDashPattern([], 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('TEAR-OFF ACKNOWLEDGEMENT SLIP', pageW / 2, slipTop - 1.5, { align: 'center' });

    const ackBoxY = slipTop + 3;
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(71, 85, 105);
    doc.roundedRect(margin + 6, ackBoxY, boxW - 12, 46, 1.8, 1.8, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(
      'ACKNOWLEDGEMENT SLIP (To be signed by Guardian & submitted to Transport Office)',
      pageW / 2,
      ackBoxY + 5.5,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.1);
    const ackText = doc.splitTextToSize(
      `Received Warning cum Reminder Letter No. ${letterNo} dated ${formattedIssue} regarding pending transport fee dues of Rs. ${baseDues.toLocaleString('en-IN')}${
        lateFine > 0
          ? ` + Late Fine Rs. ${lateFine.toLocaleString('en-IN')} (Total Payable: Rs. ${totalPayable.toLocaleString('en-IN')})`
          : ''
      } with deposit date ${formattedDeadline} in respect of ${member.name} (${member.admissionNo}, Class ${member.class}-${member.section}, Route ${member.routeCode || '-'}).`,
      boxW - 18
    );
    doc.text(ackText, margin + 9, ackBoxY + 11);

    const gY = ackBoxY + 29;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.text(`Guardian Name: ${member.fatherName || '____________________'}`, margin + 9, gY);
    doc.text(`Phone No: ${member.mobile || '________________'}`, pageW / 2 + 4, gY);
    doc.text('Date of Receipt: ____/____/2026', margin + 9, gY + 10);
    doc.text('Signature of Guardian: ______________________', pageW / 2 + 4, gY + 10);
  });

  const outName =
    customFilename ||
    (targetMembers.length === 1
      ? `warning_letter_${targetMembers[0].letterNo}.pdf`
      : `bulk_warning_letters_${todayIso}.pdf`);
  doc.save(outName.endsWith('.pdf') ? outName : `${outName}.pdf`);
}

export function printWarningCumReminderLetters(
  targetMembers: PrintableLetterTarget[],
  options: {
    invoices: FeeInvoice[];
    schoolName?: string;
    selectedMonth?: string;
  }
) {
  if (targetMembers.length === 0) return;
  const { invoices, schoolName, selectedMonth = '2026-11' } = options;
  const todayIso = new Date().toISOString().slice(0, 10);

  const pagesHtml = targetMembers
    .map((item) => {
      const { member, letterNo, issueDate, deadlineDate } = item;
      const stuInvoices = invoices.filter(
        (i) =>
          (i.studentId === member.id || i.admissionNo === member.admissionNo) && i.balanceDue > 0
      );
      const baseDues =
        item.baseOverdueAmount !== undefined
          ? Math.max(0, Number(item.baseOverdueAmount))
          : Math.max(0, Number(member.balanceDue) || 0);
      const lateFine =
        item.lateFineAmount !== undefined ? Math.max(0, Number(item.lateFineAmount)) : 0;
      const totalPayable = baseDues + lateFine;
      const formattedDeadline = formatLetterDateDisplay(deadlineDate);
      const formattedIssue = formatLetterDateDisplay(issueDate);
      const periodStr =
        stuInvoices.length > 0
          ? stuInvoices.map((i) => i.month).join(', ')
          : `Up to ${selectedMonth}`;
      const duesRowsHtml =
        stuInvoices.length > 0
          ? stuInvoices
              .map(
                (inv) => `
                  <tr>
                    <td>${inv.month}</td>
                    <td>${inv.invoiceNo}</td>
                    <td style="text-align:right;">Rs. ${inv.baseFee}</td>
                    <td style="text-align:right;">Rs. ${inv.concession}</td>
                    <td style="text-align:right;">Rs. ${inv.paidAmount}</td>
                    <td style="text-align:right;font-weight:bold;">Rs. ${inv.balanceDue}</td>
                  </tr>
                `
              )
              .join('')
          : `
                <tr>
                  <td>${periodStr}</td>
                  <td>OPEN-BAL</td>
                  <td style="text-align:right;">Rs. ${member.monthlyFee || baseDues}</td>
                  <td style="text-align:right;">Rs. ${member.concessionAmount || 0}</td>
                  <td style="text-align:right;">Rs. 0</td>
                  <td style="text-align:right;font-weight:bold;">Rs. ${baseDues}</td>
                </tr>
              `;

      return `
        <div class="page">
          <div class="letter-box">
            <div class="header">
              <h1>${schoolName || 'Narendra Edu Valley'} — Transport Department</h1>
              <h2>WARNING CUM REMINDER LETTER</h2>
            </div>
            <div class="meta-row">
              <div><strong>Letter Ref No:</strong> ${letterNo}</div>
              <div><strong>Issue Date:</strong> ${formattedIssue}</div>
            </div>
            <div class="recipient">
              <div><strong>To,</strong></div>
              <div><strong>Name of Guardian:</strong> ${member.fatherName || 'Parent / Guardian'} (Guardian of <strong>${member.name}</strong>, ID: ${member.admissionNo}, Class: ${member.class}-${member.section})</div>
              <div><strong>Address:</strong> ${member.address || member.villageName || 'Registered Address'} (${member.pickupDropStopName || 'Stop'})</div>
              <div><strong>Phone No:</strong> ${member.mobile || member.emergencyContact || '—'} &nbsp;|&nbsp; <strong>Route:</strong> ${member.routeCode || 'Assigned Route'}</div>
            </div>
            <div class="subject">
              <strong>Subject:</strong> Pending Transport Fee Dues for <u>${periodStr}</u> — Deposit Date: <strong>${formattedDeadline}</strong>
            </div>
            <div class="body-text">
              <p><strong>Dear Sir / Madam,</strong></p>
              <p>
                This is an official reminder from the School Transport Department regarding the pending transport fee dues of your ward
                <strong>${member.name}</strong> (Admission No: <strong>${member.admissionNo}</strong>, Class: <strong>${member.class}-${member.section}</strong>,
                Stop: <strong>${member.pickupDropStopName || member.villageName || 'Assigned Stop'}</strong>). The detailed statement of unpaid transport dues is given below:
              </p>
              <table class="dues-table">
                <thead>
                  <tr>
                    <th>Billing Period</th>
                    <th>Invoice Ref</th>
                    <th style="text-align:right;">Base Fee</th>
                    <th style="text-align:right;">Concession</th>
                    <th style="text-align:right;">Paid</th>
                    <th style="text-align:right;">Balance Due</th>
                  </tr>
                </thead>
                <tbody>
                  ${duesRowsHtml}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="5" style="text-align:right;font-weight:bold;">Pending Transport Fee Dues:</td>
                    <td style="text-align:right;font-weight:bold;">Rs. ${baseDues.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td colspan="5" style="text-align:right;font-weight:bold;color:${lateFine > 0 ? '#be123c' : '#475569'};">
                      ${lateFine > 0 ? 'Applicable Late Fine (After 10th Due Date):' : 'Late Fine (Rs. 100 applicable if paid after 10th):'}
                    </td>
                    <td style="text-align:right;font-weight:bold;color:${lateFine > 0 ? '#be123c' : '#475569'};">
                      ${lateFine > 0 ? `+ Rs. ${lateFine.toLocaleString('en-IN')}` : 'Rs. 0'}
                    </td>
                  </tr>
                  <tr style="background:#fef2f2;">
                    <td colspan="5" style="text-align:right;font-weight:800;font-size:13px;color:#991b1b;">TOTAL OVERDUE AMOUNT PAYABLE:</td>
                    <td style="text-align:right;font-weight:800;font-size:13px;color:#b91c1c;">Rs. ${totalPayable.toLocaleString('en-IN')}</td>
                  </tr>
                </tfoot>
              </table>
              <p>
                <strong style="color:#b91c1c;">Kindly deposit the total payable amount of Rs. ${totalPayable.toLocaleString('en-IN')} on or before ${formattedDeadline} to avoid suspension of transport facility.</strong>
                In case of any genuine economic difficulty, please visit the school office in person with a written application before the deposit date (${formattedDeadline}).
              </p>
            </div>
            <div class="sign-row">
              <div>
                <strong>Regards,</strong><br/>
                <strong>Transport Coordinator</strong><br/>
                ${schoolName || 'Narendra Edu Valley'}
              </div>
              <div style="text-align:right;">
                <br/>
                <em>(Office Seal &amp; Sign)</em>
              </div>
            </div>

            <div class="cut-line">✂ ------------------------------------------------ TEAR-OFF ACKNOWLEDGEMENT SLIP ------------------------------------------------</div>

            <div class="ack-box">
              <div class="ack-title">ACKNOWLEDGEMENT SLIP (To be signed by Guardian &amp; submitted to Transport Office)</div>
              <p style="margin:6px 0;font-size:12px;">
                Received Warning cum Reminder Letter No. <strong>${letterNo}</strong> dated <strong>${formattedIssue}</strong> regarding pending transport fee dues of
                <strong>Rs. ${baseDues.toLocaleString('en-IN')}</strong>${
                  lateFine > 0
                    ? ` + Applicable Late Fine <strong>Rs. ${lateFine.toLocaleString('en-IN')}</strong> (Total Payable: <strong>Rs. ${totalPayable.toLocaleString('en-IN')}</strong>)`
                    : ''
                } for Period <strong>${periodStr}</strong> (Deposit Date: <strong>${formattedDeadline}</strong>) in respect of
                <strong>${member.name}</strong> (${member.admissionNo}, Class ${member.class}-${member.section}, Route ${member.routeCode || '—'}).
              </p>
              <div class="ack-grid">
                <div><strong>Guardian Name:</strong> ${member.fatherName || '________________'}</div>
                <div><strong>Phone No:</strong> ${member.mobile || '________________'}</div>
                <div><strong>Date of Receipt:</strong> ____/____/2026</div>
                <div><strong>Signature of Guardian:</strong> ________________________</div>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  const html = `
    <html>
      <head>
        <title>Warning cum Reminder Letter</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: 16px; }
          .page { page-break-after: always; padding: 10px 0; }
          .page:last-child { page-break-after: auto; }
          .letter-box { border: 2px solid #0f172a; border-radius: 10px; padding: 22px; max-width: 760px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 10px; margin-bottom: 12px; }
          .header h1 { margin: 0; font-size: 18px; text-transform: uppercase; }
          .header h2 { margin: 4px 0 0; font-size: 14px; color: #b91c1c; letter-spacing: 0.5px; }
          .meta-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 12px; }
          .recipient { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; font-size: 12.5px; line-height: 1.5; margin-bottom: 12px; }
          .subject { font-size: 13px; margin-bottom: 10px; padding: 6px 0; border-bottom: 1px solid #e2e8f0; }
          .body-text { font-size: 12.5px; line-height: 1.55; }
          .dues-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
          .dues-table th, .dues-table td { border: 1px solid #94a3b8; padding: 6px 8px; }
          .dues-table th { background: #f1f5f9; text-align: left; }
          .sign-row { display: flex; justify-content: space-between; margin-top: 20px; font-size: 12.5px; }
          .cut-line { margin: 14px 0 10px; text-align: center; font-size: 11px; color: #64748b; font-weight: bold; }
          .ack-box { border: 1.5px dashed #334155; border-radius: 8px; padding: 12px; background: #fffbeb; }
          .ack-title { font-weight: bold; font-size: 12px; text-align: center; text-transform: uppercase; margin-bottom: 6px; }
          .ack-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; margin-top: 10px; }
        </style>
      </head>
      <body>${pagesHtml}</body>
    </html>
  `;

  const baseFile =
    targetMembers.length === 1
      ? `warning_letter_${targetMembers[0].letterNo}`
      : `bulk_warning_letters_${todayIso}`;

  openHtmlPrintPreview({
    title:
      targetMembers.length === 1
        ? `Warning cum Reminder Letter — ${targetMembers[0].member.name} (${targetMembers[0].letterNo})`
        : `Bulk Warning cum Reminder Letters (${targetMembers.length} Members)`,
    subtitle: `Deposit Date: ${formatLetterDateDisplay(targetMembers[0].deadlineDate)} • Includes Dues Statement, Applicable Late Fine & Acknowledgement Slip`,
    html,
    filename: baseFile,
    printButtonLabel:
      targetMembers.length === 1 ? '🖨️ Print Letter' : `🖨️ Print Letters (${targetMembers.length})`,
    pdfButtonLabel:
      targetMembers.length === 1 ? '📄 Save as PDF' : `📄 Save as PDF (${targetMembers.length})`,
    onSavePdf: () =>
      downloadWarningLettersPdf(targetMembers, {
        invoices,
        schoolName,
        selectedMonth,
        customFilename: `${baseFile}.pdf`,
      }),
  });
}
