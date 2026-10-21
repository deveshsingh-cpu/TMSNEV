import React, { useState, useEffect } from 'react';
import {
  CreditCard, IndianRupee, Printer, CheckCircle,
  AlertTriangle, Phone, FileText,
  Calendar, Search, ShieldCheck, UserX, Plus, X, Upload, Eye, Trash2, Lock
} from 'lucide-react';
import {
  FeeInvoice, FeeReceipt, FollowUpRecord, WarningLetter,
  StudentMember, UserRole, MemberTypeMaster
} from '../../types/index.js';
import { PrintExportToolbar, FilterPopover, openHtmlPrintPreview } from '../../utils/exportPrint.js';

interface FeesViewProps {
  schoolName?: string;
  currentRole?: UserRole;
  classes?: string[];
  memberTypes?: MemberTypeMaster[];
  invoices: FeeInvoice[];
  receipts: FeeReceipt[];
  followUps: FollowUpRecord[];
  warningLetters: WarningLetter[];
  students: StudentMember[];
  initialSubTab?: string;
  preselectedStudentIdForCollect?: string | null;
  onClearPreselectedStudent?: () => void;
  onRunBilling: (month: string) => Promise<{ createdCount: number; totalBilled: number }>;
  onRecordReceipt: (data: any) => Promise<any>;
  onAddFollowUp?: (data: Partial<FollowUpRecord>) => Promise<any>;
  onDeleteFollowUp?: (id: string) => Promise<any>;
  onIssueWarningLetter?: (data: Partial<WarningLetter>) => Promise<any>;
  onEvaluateSuspensions: (threshold: number) => Promise<{ suspendedCount: number; affectedStudents: string[] }>;
  onSuspendStudent?: (studentId: string, reason: string) => Promise<any>;
  onPrintReceipt: (receipt: FeeReceipt) => void;
  onPrintWarningLetter: (letter: WarningLetter) => void;
  onOpenStudentProfile?: (studentId: string, tab?: string) => void;
}

export const FeesView: React.FC<FeesViewProps> = ({
  schoolName,
  currentRole = 'Admin',
  classes = [],
  memberTypes = [],
  invoices,
  receipts,
  followUps,
  warningLetters,
  students,
  initialSubTab,
  preselectedStudentIdForCollect,
  onClearPreselectedStudent,
  onRunBilling,
  onRecordReceipt,
  onAddFollowUp,
  onDeleteFollowUp,
  onIssueWarningLetter,
  onEvaluateSuspensions,
  onSuspendStudent,
  onPrintReceipt,
  onPrintWarningLetter,
  onOpenStudentProfile,
}) => {
  const isAdmin = currentRole === 'Admin';
  const todayStr = new Date().toISOString().split('T')[0];

  const [activeTab, setActiveTab] = useState<'billing' | 'receipts' | 'recovery'>('receipts');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'info' | 'warning'; text: string } | null>(null);

  useEffect(() => {
    if (initialSubTab === 'invoices') setActiveTab('billing');
    else if (initialSubTab === 'recovery' || initialSubTab === 'defaulters') setActiveTab('recovery');
    else if (initialSubTab === 'collect') setActiveTab('receipts');
  }, [initialSubTab]);

  const [selectedMonth, setSelectedMonth] = useState('2026-10');
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isRunningBilling, setIsRunningBilling] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [previewScreenshot, setPreviewScreenshot] = useState<{ title: string; url: string } | null>(null);

  // Individual Suspension Selection Modal (No auto-suspension!)
  const [isIndividualSuspendModalOpen, setIsIndividualSuspendModalOpen] = useState(false);
  const [suspendReasonMap, setSuspendReasonMap] = useState<Record<string, string>>({});

  // --- Improvised Fee Collection Form State ---
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberFilterClass, setMemberFilterClass] = useState('all');
  const [memberFilterType, setMemberFilterType] = useState('all');
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id || '');

  // Month-by-Month selection & per-month Admin discount
  const [selectedMonthIds, setSelectedMonthIds] = useState<string[]>([]);
  const [monthDiscounts, setMonthDiscounts] = useState<Record<string, number>>({});
  const [lateFineWaiver, setLateFineWaiver] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(todayStr);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Bank' | 'UPI'>('UPI');
  const [referenceNo, setReferenceNo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [upiScreenshot, setUpiScreenshot] = useState<string>('');
  const [upiScreenshotName, setUpiScreenshotName] = useState<string>('');

  // Open Collect Fee Modal if preselectedStudentIdForCollect is passed
  useEffect(() => {
    if (preselectedStudentIdForCollect) {
      setSelectedStudentId(preselectedStudentIdForCollect);
      setIsReceiptModalOpen(true);
      if (onClearPreselectedStudent) onClearPreselectedStudent();
    }
  }, [preselectedStudentIdForCollect]);

  // Narrowed down member list for Collect Fee modal
  const narrowedMembers = students.filter((s) => {
    if (memberFilterClass !== 'all' && s.class !== memberFilterClass) return false;
    if (memberFilterType !== 'all' && s.memberType !== memberFilterType) return false;
    if (memberSearchQuery.trim()) {
      const q = memberSearchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q) ||
        s.class.toLowerCase().includes(q) ||
        (s.memberType && s.memberType.toLowerCase().includes(q)) ||
        s.fatherName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Selected Member object
  const selectedMember = students.find((s) => s.id === selectedStudentId) || narrowedMembers[0] || students[0];

  // Build pending monthly dues rows for the selected member
  const memberAllInvoices = invoices.filter((i) => i.studentId === selectedMember?.id);
  const memberUnpaidInvoices = memberAllInvoices.filter((i) => i.balanceDue > 0 && i.status !== 'Paid');

  // If member has balanceDue > 0 but no unpaid invoice objects in state, synthesize a pending month row so amount always comes from dues
  const effectiveDueRows: {
    id: string;
    month: string;
    description: string;
    duesAmount: number;
    isSynthetic?: boolean;
  }[] =
    memberUnpaidInvoices.length > 0
      ? memberUnpaidInvoices.map((inv) => ({
          id: inv.id,
          month: inv.month,
          description: `${inv.month} — Transport Fee (${selectedMember?.pickupDropStopName || 'Assigned Stop'}, ${selectedMember?.villageName || ''})`,
          duesAmount: inv.balanceDue,
        }))
      : selectedMember && selectedMember.balanceDue > 0
      ? [
          {
            id: `syn-${selectedMember.id}-oct`,
            month: 'October 2026',
            description: `October 2026 — Transport Dues (${selectedMember.pickupDropStopName || 'Stop'})`,
            duesAmount: selectedMember.balanceDue,
            isSynthetic: true,
          },
        ]
      : [];

  // Auto-select all pending months whenever selectedMember changes
  useEffect(() => {
    if (selectedMember) {
      setSelectedMonthIds(effectiveDueRows.map((r) => r.id));
      setMonthDiscounts({});
      setLateFineWaiver(0);
      setPaymentDate(todayStr);
    }
  }, [selectedMember?.id, invoices.length]);

  const toggleMonthSelection = (rowId: string) => {
    setSelectedMonthIds((prev) =>
      prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]
    );
  };

  const toggleSelectAllMonths = () => {
    if (selectedMonthIds.length === effectiveDueRows.length) {
      setSelectedMonthIds([]);
    } else {
      setSelectedMonthIds(effectiveDueRows.map((r) => r.id));
    }
  };

  // Late Fee Mechanism: Any fee paid after due date (10th of current month) adds ₹100 extra as Late Fine.
  // Can only be waived off by Admin through discount.
  const effectivePayDateStr = isAdmin ? paymentDate : todayStr;
  const payDayOfMonth = Number((effectivePayDateStr || todayStr).split('-')[2] || 1);
  const isPaidAfter10th = payDayOfMonth > 10;

  // Totals for selected months
  const selectedRows = effectiveDueRows.filter((r) => selectedMonthIds.includes(r.id));
  const lateFineApplicable = isPaidAfter10th && selectedRows.length > 0 ? 100 : 0;
  const effectiveLateFineWaiver = isAdmin ? Math.min(lateFineApplicable, Math.max(0, Number(lateFineWaiver || 0))) : 0;
  const netLateFine = Math.max(0, lateFineApplicable - effectiveLateFineWaiver);

  const totalSelectedDues = selectedRows.reduce((sum, r) => sum + r.duesAmount, 0) + lateFineApplicable;
  const totalSelectedDiscount =
    selectedRows.reduce(
      (sum, r) => sum + Math.min(r.duesAmount, Number(monthDiscounts[r.id] || 0)),
      0
    ) + effectiveLateFineWaiver;
  const totalNetPayable = Math.max(0, totalSelectedDues - totalSelectedDiscount);

  // Member overall fee summary for confirmation card
  const memberTotalAccrued =
    memberAllInvoices.reduce((s, i) => s + i.baseFee, 0) ||
    (selectedMember ? selectedMember.monthlyFee * 3 : 0);
  const memberTotalConcession = memberAllInvoices.reduce((s, i) => s + i.concession, 0);
  const memberTotalPaid = receipts
    .filter((r) => r.studentId === selectedMember?.id)
    .reduce((s, r) => s + r.amount, 0);

  const handleUpiFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUpiScreenshotName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUpiScreenshot(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // --- Follow-Up & Warning Letter Modals State ---
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [folStudentId, setFolStudentId] = useState(
    students.find((s) => s.balanceDue > 0)?.id || students[0]?.id || ''
  );
  const [folDate, setFolDate] = useState(todayStr);
  const [folContactPerson, setFolContactPerson] = useState('');
  const [folPhone, setFolPhone] = useState('');
  const [folOutcome, setFolOutcome] = useState<FollowUpRecord['outcome']>('Promise to Pay');
  const [folPromiseDate, setFolPromiseDate] = useState('');
  const [folNotes, setFolNotes] = useState('');

  useEffect(() => {
    const st = students.find((s) => s.id === folStudentId);
    if (st) {
      setFolContactPerson(`${st.fatherName} (Parent)`);
      setFolPhone(st.mobile);
    }
  }, [folStudentId, students]);

  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [warnStudentId, setWarnStudentId] = useState(
    students.find((s) => s.balanceDue > 0)?.id || students[0]?.id || ''
  );
  const [warnLevel, setWarnLevel] = useState<WarningLetter['warningLevel']>(
    'Level 2: Urgent Notice'
  );
  const [warnDeadline, setWarnDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [warnSentVia, setWarnSentVia] = useState<WarningLetter['sentVia']>('Printed Slip');

  // Helper to print Formal Warning cum Reminder Letter (Single or Bulk) with Dues History & Acknowledgement Slip
  const printWarningCumReminderLetters = (targetMembers: { member: StudentMember; letterNo: string; issueDate: string; deadlineDate: string }[]) => {
    if (targetMembers.length === 0) return;
    const pagesHtml = targetMembers
      .map(({ member, letterNo, issueDate, deadlineDate }) => {
        const stuInvoices = invoices.filter(
          (i) => (i.studentId === member.id || i.admissionNo === member.admissionNo) && i.balanceDue > 0
        );
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
                  <td style="text-align:right;">Rs. ${member.monthlyFee}</td>
                  <td style="text-align:right;">Rs. ${member.concessionAmount || 0}</td>
                  <td style="text-align:right;">Rs. 0</td>
                  <td style="text-align:right;font-weight:bold;">Rs. ${member.balanceDue}</td>
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
                <div><strong>Date:</strong> ${issueDate}</div>
              </div>
              <div class="recipient">
                <div><strong>To,</strong></div>
                <div><strong>Name of Guardian:</strong> ${member.fatherName || 'Parent / Guardian'} (Guardian of <strong>${member.name}</strong>, ID: ${member.admissionNo}, Class: ${member.class}-${member.section})</div>
                <div><strong>Address:</strong> ${member.address || member.villageName || 'Registered Address'} (${member.pickupDropStopName || 'Stop'})</div>
                <div><strong>Phone No:</strong> ${member.mobile || member.emergencyContact || '—'}</div>
              </div>
              <div class="subject">
                <strong>Subject:</strong> Fee Due for <u>${periodStr}</u> (Route: ${member.routeCode || 'Assigned Route'})
              </div>
              <div class="body-text">
                <p><strong>Dear Sir / Madam,</strong></p>
                <p>
                  This is an official reminder from the School Transport Department regarding the pending transport fee dues of your ward
                  <strong>${member.name}</strong> (Admission No: <strong>${member.admissionNo}</strong>, Class: <strong>${member.class}-${member.section}</strong>,
                  Stop: <strong>${member.pickupDropStopName}</strong>). The detailed statement of unpaid transport dues is attached below for your kind perusal:
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
                      <td colspan="5" style="text-align:right;font-weight:bold;">TOTAL OVERDUE AMOUNT PAYABLE:</td>
                      <td style="text-align:right;font-weight:bold;color:#b91c1c;">Rs. ${member.balanceDue.toLocaleString('en-IN')}</td>
                    </tr>
                  </tfoot>
                </table>
                <p>
                  <strong>Kindly pay before the 20th (${deadlineDate}) to avoid suspension of transport facility.</strong>
                  In case of any genuine economic difficulty, please visit the school office in person with a written application before the given date (${deadlineDate}).
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
                  Received Warning cum Reminder Letter No. <strong>${letterNo}</strong> dated <strong>${issueDate}</strong> regarding pending transport fee dues of
                  <strong>Rs. ${member.balanceDue.toLocaleString('en-IN')}</strong> for Period <strong>${periodStr}</strong> in respect of
                  <strong>${member.name}</strong> (${member.admissionNo}, Class ${member.class}-${member.section}, Route ${member.routeCode}).
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
            .sign-row { display: flex; justify-content: space-between; margin-top: 22px; font-size: 12.5px; }
            .cut-line { margin: 16px 0 12px; text-align: center; font-size: 11px; color: #64748b; font-weight: bold; }
            .ack-box { border: 1.5px dashed #334155; border-radius: 8px; padding: 12px; background: #fffbeb; }
            .ack-title { font-weight: bold; font-size: 12px; text-align: center; text-transform: uppercase; margin-bottom: 6px; }
            .ack-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; margin-top: 10px; }
          </style>
        </head>
        <body>${pagesHtml}</body>
      </html>
    `;

    openHtmlPrintPreview({
      title:
        targetMembers.length === 1
          ? `Warning cum Reminder Letter & Slip — ${targetMembers[0].member.name} (${targetMembers[0].letterNo})`
          : `Bulk Warning cum Reminder Letters (${targetMembers.length} Members)`,
      subtitle: 'Includes Guardian Details, Dues History Statement, 20th Deadline & Tear-off Acknowledgement Slip',
      html,
      filename:
        targetMembers.length === 1
          ? `warning_letter_${targetMembers[0].letterNo}`
          : `bulk_warning_letters_${selectedMonth}`,
    });
  };

  const handlePrintSingleReceipt = (rec: FeeReceipt) => {
    const memberObj = students.find(
      (s) =>
        s.id === rec.studentId ||
        s.admissionNo === rec.admissionNo ||
        s.name.toLowerCase() === (rec.studentName || '').toLowerCase()
    );
    const html = `
      <html>
        <head>
          <title>Fee Receipt ${rec.receiptNo}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 28px; color: #0f172a; background: #fff; }
            .box { border: 2px solid #0f172a; border-radius: 12px; padding: 24px; max-width: 680px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 16px; }
            .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; }
            .header p { margin: 4px 0 0; font-size: 12px; color: #475569; font-weight: bold; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; margin-bottom: 18px; }
            .amount-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 18px; }
            .footer { display: flex; justify-content: space-between; margin-top: 32px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="box">
            <div class="header">
              <h1>${schoolName || 'Narendra Edu Valley'}</h1>
              <p>OFFICIAL TRANSPORT FEE RECEIPT</p>
            </div>
            <div class="grid">
              <div><strong>Receipt No:</strong> ${rec.receiptNo}</div>
              <div><strong>Date:</strong> ${rec.date}</div>
              <div><strong>Member Name:</strong> ${rec.studentName}</div>
              <div><strong>ID / Adm No:</strong> ${rec.admissionNo}</div>
              <div><strong>Class / Sec:</strong> ${memberObj ? `${memberObj.class}-${memberObj.section}` : '—'}</div>
              <div><strong>Route &amp; Stop:</strong> ${memberObj ? `${memberObj.routeCode} • ${memberObj.pickupDropStopName}` : 'Assigned Route'}</div>
            </div>
            <div class="amount-box">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <span>Fee Description / Months:</span>
                <strong>${rec.feeBreakupDescription || 'Transport Fee'}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <span>Dues Before Payment:</span>
                <strong>Rs. ${(rec.balanceDueBefore ?? rec.amount).toLocaleString('en-IN')}</strong>
              </div>
              ${(rec.discountAmount ?? 0) > 0 ? `
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;color:#b45309;">
                <span>Discount / Waiver Allowed:</span>
                <strong>- Rs. ${(rec.discountAmount ?? 0).toLocaleString('en-IN')}</strong>
              </div>` : ''}
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:16px;color:#047857;">
                <span><strong>Amount Paid (${rec.paymentMode}):</strong></span>
                <strong>Rs. ${rec.amount.toLocaleString('en-IN')}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span>Balance Due After Payment:</span>
                <strong>Rs. ${(rec.balanceDueAfter ?? 0).toLocaleString('en-IN')}</strong>
              </div>
              ${rec.referenceNo ? `<div style="margin-top:6px;font-size:12px;"><strong>Reference / UTR:</strong> ${rec.referenceNo}</div>` : ''}
            </div>
            <div style="font-size:12px;color:#475569;"><strong>Remarks:</strong> ${rec.remarks || 'Transport fee received'}</div>
            <div class="footer">
              <div>Received By: <strong>${rec.receivedBy}</strong></div>
              <div>Authorized Signatory</div>
            </div>
          </div>
        </body>
      </html>
    `;
    openHtmlPrintPreview({
      title: `Transport Fee Receipt — ${rec.receiptNo} (${rec.studentName})`,
      subtitle: `Paid Rs. ${rec.amount.toLocaleString('en-IN')} via ${rec.paymentMode} on ${rec.date}`,
      html,
      filename: `fee_receipt_${rec.receiptNo}`,
    });
  };

  const handleBulkWarningLettersBy15th = async () => {
    const overdueMembers = students.filter(
      (s) => s.balanceDue > 0 && s.transportStatus !== 'Left'
    );
    if (overdueMembers.length === 0) {
      setStatusMessage({
        type: 'info',
        text: 'No members currently have pending fees for bulk Warning cum Reminder Letter generation.',
      });
      return;
    }
    const deadline20th = `${selectedMonth}-20`;
    const batchTargets: { member: StudentMember; letterNo: string; issueDate: string; deadlineDate: string }[] = [];

    for (let i = 0; i < overdueMembers.length; i++) {
      const st = overdueMembers[i];
      const letterNo = `WCR-${selectedMonth.replace('-', '')}-${String(i + 1).padStart(3, '0')}`;
      if (onIssueWarningLetter) {
        await onIssueWarningLetter({
          date: todayStr,
          issueDate: todayStr,
          studentId: st.id,
          studentName: st.name,
          admissionNo: st.admissionNo,
          parentName: st.fatherName,
          fatherName: st.fatherName,
          address: st.address,
          overdueAmount: st.balanceDue,
          periodOverdue: `Pending Dues up to ${selectedMonth}`,
          deadlineDate: deadline20th,
          proposedSuspensionDate: deadline20th,
          warningLevel: 'Level 2: Urgent Notice',
          sentVia: 'Printed Slip',
          issuedBy: currentRole,
        });
      }
      batchTargets.push({
        member: st,
        letterNo,
        issueDate: todayStr,
        deadlineDate: deadline20th,
      });
    }

    setStatusMessage({
      type: 'success',
      text: `Generated & opened print dialog for ${batchTargets.length} Bulk Warning cum Reminder Letters (for all members with pending dues by 15th).`,
    });
    printWarningCumReminderLetters(batchTargets);
  };

  // Eligible list for manual individual suspension: neither permission extension received nor overall dues clear
  const eligibleForManualSuspension = students.filter(
    (s) =>
      s.transportStatus === 'Active' &&
      s.balanceDue > 0 &&
      (!s.activePermissionLetter || s.activePermissionLetter.allowedUntilDate < todayStr)
  );

  const handleRunBilling = async () => {
    try {
      setIsRunningBilling(true);
      const res = await onRunBilling(selectedMonth);
      setStatusMessage({
        type: res.createdCount > 0 ? 'success' : 'info',
        text:
          res.createdCount > 0
            ? `Manual Auto-Due Complete: Generated ${res.createdCount} transport fee invoices for ${selectedMonth} totaling ₹${res.totalBilled.toLocaleString('en-IN')} (Left School members excluded).`
            : `All active members already have monthly fee dues generated for ${selectedMonth}. Zero duplicates created.`,
      });
    } finally {
      setIsRunningBilling(false);
    }
  };

  const handleReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) {
      setStatusMessage({ type: 'warning', text: 'Please select a member.' });
      return;
    }
    if (selectedRows.length === 0) {
      setStatusMessage({ type: 'warning', text: 'Please select at least one pending month to collect fees.' });
      return;
    }

    const lateFineDesc =
      lateFineApplicable > 0
        ? netLateFine > 0
          ? ` + Late Fine ₹${netLateFine} (Paid after 10th)`
          : ` (Late Fine ₹100 Waived by Admin)`
        : '';
    const descriptionStr = `Transport Fee (${selectedRows.map((r) => r.month).join(', ')})${lateFineDesc}`;

    await onRecordReceipt({
      studentId: selectedMember.id,
      amount: totalNetPayable,
      discountAmount: totalSelectedDiscount,
      lateFineAmount: netLateFine,
      invoiceDiscounts: isAdmin ? monthDiscounts : {},
      selectedInvoiceIds: selectedRows.filter((r) => !r.isSynthetic).map((r) => r.id),
      feeBreakupDescription: descriptionStr,
      date: isAdmin ? paymentDate : todayStr,
      paymentMode,
      referenceNo,
      upiScreenshot: upiScreenshot || undefined,
      receivedBy: `${currentRole}`,
      remarks: remarks || descriptionStr,
    });

    setIsReceiptModalOpen(false);
    setReferenceNo('');
    setRemarks('');
    setUpiScreenshot('');
    setUpiScreenshotName('');
    setStatusMessage({
      type: 'success',
      text: `Fee receipt recorded for ${selectedMember.name} — Paid ₹${totalNetPayable.toLocaleString('en-IN')}.`,
    });
  };

  const handleSaveFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddFollowUp) return;
    const st = students.find((s) => s.id === folStudentId);
    if (!st) return;
    await onAddFollowUp({
      date: folDate || todayStr,
      studentId: st.id,
      admissionNo: st.admissionNo,
      studentName: st.name,
      contactPerson: folContactPerson || st.fatherName,
      phone: folPhone || st.mobile,
      overdueAmount: st.balanceDue,
      promiseDate: folPromiseDate || undefined,
      outcome: folOutcome,
      notes: folNotes || 'Called parent regarding transport fee deposit.',
      officerName: currentRole,
    });
    setIsFollowUpModalOpen(false);
    setFolNotes('');
    setFolPromiseDate('');
  };

  const handleSaveWarningLetterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onIssueWarningLetter) return;
    const st = students.find((s) => s.id === warnStudentId);
    if (!st) return;
    const created = await onIssueWarningLetter({
      date: todayStr,
      issueDate: todayStr,
      studentId: st.id,
      studentName: st.name,
      admissionNo: st.admissionNo,
      parentName: st.fatherName,
      fatherName: st.fatherName,
      address: st.address,
      overdueAmount: st.balanceDue,
      periodOverdue: `Pending Transport Dues (${selectedMonth})`,
      deadlineDate: warnDeadline,
      proposedSuspensionDate: warnDeadline,
      warningLevel: warnLevel,
      sentVia: warnSentVia,
      issuedBy: currentRole,
    });
    setIsWarningModalOpen(false);
    printWarningCumReminderLetters([
      {
        member: st,
        letterNo: created?.letterNo || `WCR-${Date.now().toString().slice(-4)}`,
        issueDate: todayStr,
        deadlineDate: warnDeadline,
      },
    ]);
  };

  const handleTriggerSuspension = async () => {
    if (currentRole === 'Transport Assistant') {
      setStatusMessage({
        type: 'warning',
        text: 'Transport Assistant is not authorized to suspend members. Only Transport Coordinator or Admin can initiate suspension.',
      });
      return;
    }
    setIsIndividualSuspendModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Unified Header & Toolbar (Scoped strictly to active Sidebar screen) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            {activeTab === 'billing'
              ? 'Monthly Invoices'
              : activeTab === 'recovery'
              ? 'Overdue Follow-ups & Recovery'
              : 'Collect Fees & Receipts'}
          </h2>
          <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
            {activeTab === 'billing'
              ? `${invoices.length} Invoices`
              : activeTab === 'recovery'
              ? `${followUps.length} Follow-ups`
              : `${receipts.length} Receipts`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab === 'billing' && (
            <>
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <label className="text-xs text-slate-600 font-semibold">Month:</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="text-xs bg-transparent font-bold text-slate-900 focus:outline-hidden"
                />
              </div>

              <PrintExportToolbar
                title={`Monthly Transport Fee Invoices (${selectedMonth})`}
                filename={`fee_invoices_${selectedMonth}`}
                schoolName={schoolName}
                filteredData={invoices}
                allData={invoices}
                hasActiveFilters={true}
                filterSummary={`Billing Month: ${selectedMonth}`}
                columns={[
                  { header: 'Invoice No', accessor: (i) => i.invoiceNo },
                  { header: 'Member Name', accessor: (i) => i.studentName },
                  { header: 'Admission No', accessor: (i) => i.admissionNo },
                  { header: 'Month', accessor: (i) => i.month },
                  { header: 'Base Fee (INR)', accessor: (i) => i.baseFee },
                  { header: 'Discount/Concession (INR)', accessor: (i) => i.concession },
                  { header: 'Net Amount (INR)', accessor: (i) => i.netAmount },
                  { header: 'Paid Amount (INR)', accessor: (i) => i.paidAmount },
                  { header: 'Balance Due (INR)', accessor: (i) => i.balanceDue },
                  { header: 'Status', accessor: (i) => i.status },
                ]}
              />

              <button
                onClick={handleRunBilling}
                disabled={isRunningBilling}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                <span>{isRunningBilling ? 'Running Auto-Due...' : `Run Auto-Due (${selectedMonth})`}</span>
              </button>
            </>
          )}

          {activeTab === 'receipts' && (
            <>
              <PrintExportToolbar
                title="Transport Fee Receipts & Collections Register"
                filename="fee_receipts"
                schoolName={schoolName}
                filteredData={receipts}
                allData={receipts}
                columns={[
                  { header: 'Receipt No', accessor: (r) => r.receiptNo },
                  { header: 'Payment Date', accessor: (r) => r.date },
                  { header: 'Member Name', accessor: (r) => r.studentName },
                  { header: 'Admission No', accessor: (r) => r.admissionNo },
                  { header: 'Fee Description', accessor: (r) => r.feeBreakupDescription || r.remarks || 'Transport Fee' },
                  { header: 'Dues Before (INR)', accessor: (r) => r.balanceDueBefore ?? r.amount },
                  { header: 'Discount (INR)', accessor: (r) => r.discountAmount ?? 0 },
                  { header: 'Paid Amount (INR)', accessor: (r) => r.amount },
                  { header: 'Balance After (INR)', accessor: (r) => r.balanceDueAfter ?? 0 },
                  { header: 'Payment Mode', accessor: (r) => r.paymentMode },
                  { header: 'Transaction Ref', accessor: (r) => r.referenceNo || '—' },
                  { header: 'Received By', accessor: (r) => r.receivedBy },
                ]}
              />

              <button
                onClick={() => {
                  setPaymentDate(todayStr);
                  setIsReceiptModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                <IndianRupee className="w-4 h-4" />
                <span>+ Collect Fee &amp; Issue Receipt</span>
              </button>
            </>
          )}

          {activeTab === 'recovery' && (
            <>
              <PrintExportToolbar
                title="Fee Follow-Up & Promise Date Register"
                filename="fee_followups"
                schoolName={schoolName}
                filteredData={followUps}
                allData={followUps}
                columns={[
                  { header: 'Call Date', accessor: (f) => f.date },
                  { header: 'Member Name', accessor: (f) => f.studentName },
                  { header: 'Admission No', accessor: (f) => f.admissionNo },
                  { header: 'Person Talked To', accessor: (f) => f.contactPerson },
                  { header: 'Phone', accessor: (f) => f.phone },
                  { header: 'Overdue Dues (INR)', accessor: (f) => f.overdueAmount },
                  { header: 'Response / Notes', accessor: (f) => f.notes },
                  { header: 'Next Follow-up / Promise Date', accessor: (f) => f.promiseDate || '—' },
                  { header: 'Recorded By', accessor: (f) => f.officerName },
                ]}
              />

              <button
                onClick={() => setIsFollowUpModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                <span>+ Log Call Follow-up</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: RECEIPTS & COLLECTIONS (With Attachment Preview & Breakup)   */}
      {/* =================================================================== */}
      {activeTab === 'receipts' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-slate-900 text-sm">Fee Receipts &amp; Collections Ledger</h3>
              <span className="text-xs font-bold text-slate-600">{receipts.length} Receipts</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Receipt No</th>
                    <th className="py-3 px-3">Payment Date</th>
                    <th className="py-3 px-3">Member</th>
                    <th className="py-3 px-3">Fees Type / Months</th>
                    <th className="py-3 px-3">Dues</th>
                    <th className="py-3 px-3">Discount</th>
                    <th className="py-3 px-3">Paid</th>
                    <th className="py-3 px-3">Balance</th>
                    <th className="py-3 px-3">Mode &amp; Ref</th>
                    <th className="py-3 px-3">Attachment</th>
                    <th className="py-3 px-3">Remark</th>
                    <th className="py-3 px-4 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receipts.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-700">{rec.receiptNo}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{rec.date}</td>
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => onOpenStudentProfile && onOpenStudentProfile(rec.studentId, 'fees')}
                          className="font-bold text-slate-900 hover:text-indigo-600 hover:underline text-left cursor-pointer"
                        >
                          {rec.studentName}
                        </button>
                        <div className="font-mono text-[10px] text-slate-500">{rec.admissionNo}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-700 max-w-48">
                        {rec.feeBreakupDescription || 'Transport Fee'}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-700">
                        ₹{(rec.balanceDueBefore ?? rec.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 font-medium text-amber-700">
                        ₹{(rec.discountAmount ?? 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 font-bold text-emerald-700 text-sm">
                        ₹{rec.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 font-bold text-rose-600">
                        ₹{(rec.balanceDueAfter ?? 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-800">{rec.paymentMode}</span>
                        {rec.referenceNo && (
                          <span className="text-[10px] text-slate-500 block font-mono">
                            Ref: {rec.referenceNo}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {rec.upiScreenshot ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewScreenshot({
                                title: `Payment Attachment — ${rec.receiptNo} (${rec.studentName})`,
                                url: rec.upiScreenshot!,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-500 text-[11px] font-bold cursor-pointer shadow-2xs"
                            title="View Payment Screenshot / Proof"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-40 truncate" title={rec.remarks}>
                        {rec.remarks || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handlePrintSingleReceipt(rec)}
                          className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5 text-amber-400" />
                          <span>Print</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-semibold ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : statusMessage.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-slate-700 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: MONTHLY INVOICES & MANUAL AUTO-DUE GENERATION                */}
      {/* =================================================================== */}
      {activeTab === 'billing' && (
        <div className="space-y-5">

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Issued Transport Invoices ({invoices.length})</h3>
              <span className="text-xs text-slate-500">Click Collect Fee to clear any invoice</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Invoice No</th>
                    <th className="py-3 px-3">Member Name</th>
                    <th className="py-3 px-3">Admission No</th>
                    <th className="py-3 px-3">Billing Month</th>
                    <th className="py-3 px-3">Base Tariff</th>
                    <th className="py-3 px-3">Discount</th>
                    <th className="py-3 px-3">Net Payable</th>
                    <th className="py-3 px-3">Paid</th>
                    <th className="py-3 px-3">Balance Due</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{inv.invoiceNo}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{inv.studentName}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{inv.admissionNo}</td>
                      <td className="py-3 px-3 text-slate-700 font-medium">{inv.month}</td>
                      <td className="py-3 px-3 text-slate-700">₹{inv.baseFee}</td>
                      <td className="py-3 px-3 text-amber-700 font-medium">₹{inv.concession}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">₹{inv.netAmount}</td>
                      <td className="py-3 px-3 text-emerald-700 font-semibold">₹{inv.paidAmount}</td>
                      <td className="py-3 px-3 font-bold text-rose-600">₹{inv.balanceDue}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {inv.balanceDue > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudentId(inv.studentId);
                              setIsReceiptModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                          >
                            Collect Fee
                          </button>
                        ) : (
                          <span className="text-emerald-600 font-bold text-[11px]">Cleared</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: OVERDUE FOLLOW-UP & RECOVERY CYCLE (Interactive Cards!)       */}
      {/* =================================================================== */}
      {activeTab === 'recovery' && (
        <div className="space-y-6">
          {/* Interactive Recovery Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => setIsFollowUpModalOpen(true)}
              className="bg-white hover:bg-amber-50/50 rounded-2xl border-2 border-amber-200 hover:border-amber-400 p-4 shadow-2xs space-y-2 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 uppercase">Stage 1: 10th of Month</span>
                <Phone className="w-4 h-4 text-amber-500" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Overdue Call Follow-up</h4>
              <p className="text-slate-600 text-xs leading-relaxed">
                Record date, person talked to, response received, and next follow-up / promised payment date.
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFollowUpModalOpen(true);
                }}
                className="mt-2 w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Fee Follow-up Call</span>
              </button>
            </div>

            <div
              onClick={() => setIsWarningModalOpen(true)}
              className="bg-white hover:bg-rose-50/50 rounded-2xl border-2 border-rose-200 hover:border-rose-400 p-4 shadow-2xs space-y-2 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-700 uppercase">Stage 2: 15th of Month</span>
                <FileText className="w-4 h-4 text-rose-500" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Warning cum Reminder Letters</h4>
              <p className="text-slate-600 text-xs leading-relaxed">
                Auto-fetches Guardian Name, Address, Phone, Dues History table, 20th deadline, and Tear-off Acknowledgement Slip.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsWarningModalOpen(true);
                  }}
                  className="py-2 px-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Single Letter</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBulkWarningLettersBy15th();
                  }}
                  className="py-2 px-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Bulk Print (15th)</span>
                </button>
              </div>
            </div>

            <div
              onClick={handleTriggerSuspension}
              className="bg-white hover:bg-rose-50/50 rounded-2xl border-2 border-rose-200 hover:border-rose-400 p-4 shadow-2xs space-y-2 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-800 uppercase">Stage 3: 20th of Month</span>
                <UserX className="w-4 h-4 text-rose-600" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Individual Suspension Selection</h4>
              <p className="text-slate-600 text-xs leading-relaxed">
                Suspension is never auto-triggered. Choose individually from {eligibleForManualSuspension.length} member(s) with unpaid dues &amp; no permission letter.
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTriggerSuspension();
                }}
                className="mt-2 w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>Select Members for Suspension ({eligibleForManualSuspension.length})</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Follow-up Calls Log */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Fee Follow-Up Call Register</h3>
                  <p className="text-[11px] text-slate-500">
                    Missed promise dates trigger automatic recall alerts on Dashboard
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFollowUpModalOpen(true)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Follow-up</span>
                </button>
              </div>

              <div className="space-y-3">
                {followUps.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No follow-up calls logged yet.</p>
                ) : (
                  followUps.map((f) => {
                    const stu = students.find((s) => s.id === f.studentId);
                    const isMissedPromise =
                      f.promiseDate && f.promiseDate <= todayStr && (stu ? stu.balanceDue > 0 : (f.overdueAmount || 0) > 0);
                    return (
                      <div
                        key={f.id}
                        className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                          isMissedPromise
                            ? 'bg-rose-50/70 border-rose-300'
                            : 'bg-slate-50 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <button
                              type="button"
                              onClick={() => onOpenStudentProfile && onOpenStudentProfile(f.studentId || f.memberId || '', 'fees')}
                              className="font-bold text-slate-900 hover:text-indigo-600 hover:underline cursor-pointer"
                            >
                              {f.studentName || f.memberName}
                            </button>{' '}
                            <span className="text-slate-400 font-mono">({f.admissionNo})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md font-bold text-[10px]">
                              {f.outcome}
                            </span>
                            {isAdmin && onDeleteFollowUp && (
                              <button
                                type="button"
                                onClick={() => onDeleteFollowUp(f.id)}
                                className="p-1 text-rose-600 hover:bg-rose-100 rounded cursor-pointer"
                                title="Delete Follow-up (Admin Only)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-slate-700 font-medium">“{f.notes}”</p>
                        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 gap-2">
                          <span>
                            Talked to: <strong className="text-slate-800">{f.contactPerson}</strong> ({f.phone})
                          </span>
                          <span>
                            Call Date: <strong>{f.date}</strong> • By: {f.officerName}
                          </span>
                          {f.promiseDate && (
                            <span
                              className={`font-bold px-2 py-0.5 rounded ${
                                isMissedPromise
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-indigo-50 text-indigo-700'
                              }`}
                            >
                              Promise Date: {f.promiseDate} {isMissedPromise ? ' (OVERDUE — RECALL!)' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Formal Warning cum Reminder Letters */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Issued Warning cum Reminder Letters</h3>
                  <p className="text-[11px] text-slate-500">
                    Includes Guardian details, Dues History table, 20th deadline &amp; Acknowledgement Slip
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBulkWarningLettersBy15th}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Bulk Print Pending (15th)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsWarningModalOpen(true)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>Issue Single Letter</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {warningLetters.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No Warning cum Reminder letters issued yet.</p>
                ) : (
                  warningLetters.map((wl) => {
                    const memberObj = students.find(
                      (s) => s.id === wl.studentId || s.admissionNo === wl.admissionNo
                    );
                    return (
                      <div
                        key={wl.id}
                        className="p-3.5 bg-rose-50/40 rounded-xl border border-rose-200 text-xs flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-rose-950">{wl.letterNo}</span>
                            <span className="text-slate-400">•</span>
                            <span className="font-bold text-slate-900">{wl.studentName}</span>
                          </div>
                          <div className="text-slate-600">
                            Guardian: <strong>{wl.fatherName || wl.parentName || memberObj?.fatherName || '—'}</strong> • Overdue:{' '}
                            <strong className="text-rose-700">₹{wl.overdueAmount}</strong> ({wl.periodOverdue || 'Dues'})
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Pay Before: <strong>{wl.proposedSuspensionDate || wl.deadlineDate || '20th of Month'}</strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const matchedOrFallback: StudentMember =
                              students.find(
                                (s) =>
                                  s.id === wl.studentId ||
                                  s.admissionNo === wl.admissionNo ||
                                  s.name.toLowerCase() === (wl.studentName || '').toLowerCase()
                              ) || {
                                id: wl.studentId || 'stu-fallback',
                                admissionNo: wl.admissionNo || 'ADM-000',
                                name: wl.studentName || 'Member',
                                memberType: 'Student',
                                class: '—',
                                section: '—',
                                gender: 'M',
                                campus: 'Main',
                                academicSession: '2026-27',
                                fatherName: wl.fatherName || wl.parentName || 'Parent / Guardian',
                                mobile: '—',
                                address: wl.address || 'Registered Guardian Address',
                                routeId: '',
                                routeCode: 'Assigned Route',
                                villageId: '',
                                villageName: '',
                                pickupDropStopId: '',
                                pickupDropStopName: 'Assigned Stop',
                                serviceType: 'both',
                                transportStatus: 'Active',
                                emergencyContact: '—',
                                monthlyFee: wl.overdueAmount || 0,
                                concessionAmount: 0,
                                balanceDue: wl.overdueAmount || 0,
                                joiningDate: todayStr,
                                version: 1,
                              };

                            printWarningCumReminderLetters([
                              {
                                member: matchedOrFallback,
                                letterNo: wl.letterNo,
                                issueDate: wl.issueDate || wl.date || todayStr,
                                deadlineDate:
                                  wl.proposedSuspensionDate || wl.deadlineDate || `${selectedMonth}-20`,
                              },
                            ]);
                          }}
                          className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-amber-400" />
                          <span>Print Letter &amp; Slip</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* IMPROVISED COLLECT FEE MODAL (Search, Confirm Details, Month Table) */}
      {/* =================================================================== */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Collect Transport Fee &amp; Issue Receipt</h3>
                <p className="text-[11px] text-slate-300">
                  Search &amp; select member, verify basic details, select month-wise dues, and record payment
                </p>
              </div>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReceiptSubmit} className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* STEP 1: Narrow Down & Choose Member */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Step 1: Search &amp; Narrow Down Member List
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      placeholder="Search Name, Admission No, Father..."
                      className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl bg-white text-xs"
                    />
                  </div>

                  <select
                    value={memberFilterClass}
                    onChange={(e) => setMemberFilterClass(e.target.value)}
                    className="p-2 border border-slate-200 rounded-xl bg-white text-xs font-medium"
                  >
                    <option value="all">All Classes</option>
                    {classes.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <select
                    value={memberFilterType}
                    onChange={(e) => setMemberFilterType(e.target.value)}
                    className="p-2 border border-slate-200 rounded-xl bg-white text-xs font-medium"
                  >
                    <option value="all">All Member Types</option>
                    {memberTypes.map((mt) => (
                      <option key={mt.id} value={mt.name}>
                        {mt.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Select Transport Member ({narrowedMembers.length} matching):
                  </label>
                  <select
                    value={selectedMember?.id || ''}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl bg-white font-bold text-slate-900"
                  >
                    {narrowedMembers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.admissionNo}) — {s.memberType} • {s.class}-{s.section} • Due: ₹{s.balanceDue}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* STEP 2: Member Basic Details & Fee Summary Confirmation Table (Like Reference Screenshot) */}
              {selectedMember && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 px-3.5 py-2 font-bold text-slate-800 border-b border-slate-200">
                      Member Details (Reconfirm):
                    </div>
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-slate-200">
                        <tr>
                          <td className="p-2.5 font-bold text-slate-600 bg-slate-50/60 w-32">Admission / ID:</td>
                          <td className="p-2.5 font-mono font-bold text-slate-900">{selectedMember.admissionNo}</td>
                          <td className="p-2.5 font-bold text-slate-600 bg-slate-50/60 w-28">Member Name:</td>
                          <td className="p-2.5 font-bold text-slate-900">{selectedMember.name}</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-bold text-slate-600 bg-slate-50/60">Class &amp; Type:</td>
                          <td className="p-2.5 text-slate-800">
                            {selectedMember.class}-{selectedMember.section} ({selectedMember.memberType})
                          </td>
                          <td className="p-2.5 font-bold text-slate-600 bg-slate-50/60">Father / Guardian:</td>
                          <td className="p-2.5 text-slate-800">{selectedMember.fatherName}</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-bold text-slate-600 bg-slate-50/60">Route &amp; Stop:</td>
                          <td className="p-2.5 text-slate-800" colSpan={3}>
                            <span className="font-mono font-bold text-amber-800">{selectedMember.routeCode}</span> •{' '}
                            {selectedMember.pickupDropStopName} ({selectedMember.villageName})
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 px-3.5 py-2 font-bold text-slate-800 border-b border-slate-200">
                      Fees Details Summary:
                    </div>
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-slate-200">
                        <tr>
                          <td className="p-2.5 font-bold text-slate-600 bg-slate-50/60">Total Fees:</td>
                          <td className="p-2.5 font-bold text-slate-900">₹{memberTotalAccrued.toLocaleString('en-IN')}</td>
                          <td className="p-2.5 font-bold text-slate-600 bg-slate-50/60">Paid Fees:</td>
                          <td className="p-2.5 font-bold text-emerald-700">₹{memberTotalPaid.toLocaleString('en-IN')}</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-bold text-slate-600 bg-slate-50/60">Discount:</td>
                          <td className="p-2.5 font-bold text-amber-700">₹{memberTotalConcession.toLocaleString('en-IN')}</td>
                          <td className="p-2.5 font-bold text-slate-600 bg-slate-50/60">Bal. Fees:</td>
                          <td className="p-2.5 font-black text-rose-600 text-sm">
                            ₹{selectedMember.balanceDue.toLocaleString('en-IN')}
                          </td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-bold text-slate-600 bg-slate-50/60">Monthly Rate:</td>
                          <td className="p-2.5 text-slate-800" colSpan={3}>
                            ₹{selectedMember.monthlyFee}/month • Mobile: {selectedMember.mobile}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* STEP 3: Month-wise Dues Breakdown Table (With Admin-only Discount against each month) */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={
                        effectiveDueRows.length > 0 &&
                        selectedMonthIds.length === effectiveDueRows.length
                      }
                      onChange={toggleSelectAllMonths}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                    <span className="font-bold text-xs">
                      Select Pending Months to Pay (Amount auto-calculated from dues)
                    </span>
                  </div>
                  <span className="text-[11px] text-amber-300 font-semibold">
                    {isAdmin
                      ? 'Admin Privilege: You can enter Discount against each month'
                      : 'Note: Month-wise Discount can only be applied by Admin'}
                  </span>
                </div>

                {effectiveDueRows.length === 0 ? (
                  <div className="p-6 text-center text-emerald-700 bg-emerald-50/50 font-bold">
                    No pending monthly dues for {selectedMember?.name}. All billed months are cleared!
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">Select</th>
                          <th className="py-2.5 px-3">Month &amp; Description of Dues</th>
                          <th className="py-2.5 px-3 text-right">Dues Amount (₹)</th>
                          <th className="py-2.5 px-3 text-center">
                            Discount (₹){' '}
                            {!isAdmin && <span className="text-[10px] text-rose-600">(Admin Only)</span>}
                          </th>
                          <th className="py-2.5 px-4 text-right">Net Payable (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {effectiveDueRows.map((row) => {
                          const isChecked = selectedMonthIds.includes(row.id);
                          const disc = Math.min(
                            row.duesAmount,
                            Math.max(0, Number(monthDiscounts[row.id] || 0))
                          );
                          const netMonth = Math.max(0, row.duesAmount - disc);

                          return (
                            <tr
                              key={row.id}
                              className={isChecked ? 'bg-amber-50/30' : 'opacity-60 bg-slate-50'}
                            >
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleMonthSelection(row.id)}
                                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                                />
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                {row.description}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                                ₹{row.duesAmount.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {isAdmin ? (
                                  <input
                                    type="number"
                                    min={0}
                                    max={row.duesAmount}
                                    disabled={!isChecked}
                                    value={monthDiscounts[row.id] ?? 0}
                                    onChange={(e) =>
                                      setMonthDiscounts((prev) => ({
                                        ...prev,
                                        [row.id]: Number(e.target.value),
                                      }))
                                    }
                                    className="w-24 p-1.5 border border-slate-300 rounded-lg text-right font-mono font-bold bg-white"
                                  />
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-500 font-mono text-[11px]">
                                    <Lock className="w-3 h-3" /> ₹0
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono font-black text-emerald-700 text-sm">
                                ₹{isChecked ? netMonth.toLocaleString('en-IN') : 0}
                              </td>
                            </tr>
                          );
                        })}

                        {/* LATE FEE MECHANISM ROW: Automatically adds ₹100 if paid after 10th of month; only Admin can waive via discount */}
                        {lateFineApplicable > 0 && (
                          <tr className="bg-rose-50/70 border-t border-rose-200">
                            <td className="py-2.5 px-3 text-center font-bold text-rose-700">Auto</td>
                            <td className="py-2.5 px-3 font-bold text-rose-900">
                              Late Fine (Payment after 10th due date of month — ₹100 compulsory fine)
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-800">
                              ₹100
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {isAdmin ? (
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={lateFineWaiver}
                                  onChange={(e) => setLateFineWaiver(Number(e.target.value))}
                                  title="Admin Only: Waive off Late Fine via Discount"
                                  className="w-24 p-1.5 border border-rose-300 rounded-lg text-right font-mono font-bold bg-white text-rose-900"
                                />
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-100 text-rose-700 font-mono text-[11px]">
                                  <Lock className="w-3 h-3" /> Admin Waiver Only
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-black text-rose-700 text-sm">
                              ₹{netLateFine}
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                        <tr>
                          <td colSpan={2} className="py-2.5 px-3 text-right uppercase">
                            Total Selected ({selectedRows.length} Month{selectedRows.length === 1 ? '' : 's'}
                            {lateFineApplicable > 0 ? ' + ₹100 Late Fine' : ''}):
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            ₹{totalSelectedDues.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-amber-800">
                            - ₹{totalSelectedDiscount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-base text-emerald-700">
                            ₹{totalNetPayable.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* STEP 4: Bottom Net Payable, Payment Mode, Date (Backdate Admin Only), Ref, Remarks, Attachment */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Net Payable Amount (₹)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={`₹${totalNetPayable.toLocaleString('en-IN')}`}
                    className="w-full p-2.5 border border-emerald-300 rounded-xl bg-emerald-50 font-mono font-black text-emerald-800 text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Payment Mode *
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-bold text-slate-900"
                  >
                    <option value="UPI">UPI (QR / App)</option>
                    <option value="Cash">Cash at Counter</option>
                    <option value="Bank">Bank Transfer / NEFT / Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Payment Date *</span>
                    {!isAdmin && (
                      <span className="text-[10px] text-amber-700 font-semibold">Auto-selected (Admin backdate)</span>
                    )}
                  </label>
                  <input
                    type="date"
                    value={isAdmin ? paymentDate : todayStr}
                    readOnly={!isAdmin}
                    disabled={!isAdmin}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className={`w-full p-2.5 border rounded-xl font-mono font-bold ${
                      isAdmin
                        ? 'border-slate-200 bg-white text-slate-900'
                        : 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Transaction Ref / UTR / Cheque No
                  </label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="e.g., UPI/4291028490 or Cheque #00412"
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Remarks (If any)
                  </label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g., Transport fee cleared via UPI"
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white"
                  />
                </div>

                <div className="sm:col-span-3 pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-800">
                      Attach Payment Proof / UPI Screenshot (Visible in Fee Records)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {upiScreenshotName
                        ? `Attached: ${upiScreenshotName}`
                        : 'Upload screenshot or slip (JPEG, PNG, WEBP, PDF)'}
                    </div>
                  </div>
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs">
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    <span>{upiScreenshot ? 'Change Attachment' : 'Upload Attachment'}</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleUpiFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedRows.length === 0}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Save &amp; Print Receipt (₹{totalNetPayable.toLocaleString('en-IN')})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: RECORD FEE FOLLOW-UP CALL                                    */}
      {/* =================================================================== */}
      {isFollowUpModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Fee Follow-up Call</h3>
                <p className="text-[11px] text-slate-500">
                  Log conversation details and promised date (triggers recall popup if unpaid)
                </p>
              </div>
              <button
                onClick={() => setIsFollowUpModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFollowUpSubmit} className="space-y-3.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Member *</label>
                <select
                  value={folStudentId}
                  onChange={(e) => setFolStudentId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-semibold"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.admissionNo}) — Overdue: ₹{s.balanceDue}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Call Date *</label>
                  <input
                    type="date"
                    value={folDate}
                    onChange={(e) => setFolDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Next Follow-up / Promise Date *
                  </label>
                  <input
                    type="date"
                    value={folPromiseDate}
                    onChange={(e) => setFolPromiseDate(e.target.value)}
                    className="w-full p-2.5 border border-amber-300 bg-amber-50/40 rounded-xl font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Person Talked To *
                  </label>
                  <input
                    type="text"
                    value={folContactPerson}
                    onChange={(e) => setFolContactPerson(e.target.value)}
                    placeholder="e.g., Father / Mother"
                    className="w-full p-2.5 border border-slate-200 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    value={folPhone}
                    onChange={(e) => setFolPhone(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Call Outcome *</label>
                <select
                  value={folOutcome}
                  onChange={(e) => setFolOutcome(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-semibold"
                >
                  <option value="Promise to Pay">Promise to Pay</option>
                  <option value="Exemption Requested">Time Extension / Permission Requested</option>
                  <option value="Disputed">Fee Query / Disputed</option>
                  <option value="Unreachable">Call Not Received / Unreachable</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Response Received / Remarks *
                </label>
                <textarea
                  rows={3}
                  value={folNotes}
                  onChange={(e) => setFolNotes(e.target.value)}
                  placeholder="e.g., Spoke to father; promised to deposit transport dues on 25th..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFollowUpModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl cursor-pointer"
                >
                  Save Follow-up Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ISSUE FORMAL WARNING LETTER                                  */}
      {/* =================================================================== */}
      {isWarningModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Issue Formal Overdue Warning Letter</h3>
              <button
                onClick={() => setIsWarningModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWarningLetterSubmit} className="space-y-3.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Overdue Member *</label>
                <select
                  value={warnStudentId}
                  onChange={(e) => setWarnStudentId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-semibold"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.admissionNo}) — Overdue: ₹{s.balanceDue}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Warning Level *</label>
                <select
                  value={warnLevel}
                  onChange={(e) => setWarnLevel(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-semibold"
                >
                  <option value="Level 1: Polite Reminder">Level 1: Polite Reminder</option>
                  <option value="Level 2: Urgent Notice">Level 2: Urgent Notice</option>
                  <option value="Level 3: Final Suspension Warning">Level 3: Final Suspension Warning</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Payment Deadline / Suspension Date *
                  </label>
                  <input
                    type="date"
                    value={warnDeadline}
                    onChange={(e) => setWarnDeadline(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Dispatch Mode *</label>
                  <select
                    value={warnSentVia}
                    onChange={(e) => setWarnSentVia(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="Printed Slip">Printed Slip (Diary / Handover)</option>
                    <option value="WhatsApp">WhatsApp Notice</option>
                    <option value="SMS">SMS Alert</option>
                    <option value="Registered Letter">Registered Post</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWarningModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Issue &amp; Print Warning Letter</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: INDIVIDUAL SUSPENSION SELECTION LIST (NO AUTO-SUSPENSION)    */}
      {/* =================================================================== */}
      {isIndividualSuspendModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Individual Member Suspension List (Unpaid Dues &amp; No Permission Extension)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Suspension is never auto-triggered. Choose individual members below whose permission extension application is not received and whose overall dues are not clear.
                </p>
              </div>
              <button
                onClick={() => setIsIndividualSuspendModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Member &amp; ID</th>
                    <th className="py-2.5 px-3">Guardian &amp; Phone</th>
                    <th className="py-2.5 px-3">Route &amp; Stop</th>
                    <th className="py-2.5 px-3">Overall Dues</th>
                    <th className="py-2.5 px-3">Suspension Reason</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {eligibleForManualSuspension.map((m) => (
                    <tr key={m.id} className="hover:bg-rose-50/30">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{m.name}</div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {m.admissionNo} • {m.class}-{m.section}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800">{m.fatherName}</div>
                        <div className="font-mono text-[10px] text-slate-500">{m.mobile}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold text-slate-900">{m.routeCode}</span> • {m.pickupDropStopName}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-rose-600">
                        ₹{m.balanceDue.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={
                            suspendReasonMap[m.id] ??
                            `Overdue fee ₹${m.balanceDue} unpaid after 20th cutoff & no permission application received`
                          }
                          onChange={(e) =>
                            setSuspendReasonMap((prev) => ({ ...prev, [m.id]: e.target.value }))
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            const reason =
                              suspendReasonMap[m.id] ||
                              `Overdue fee ₹${m.balanceDue} unpaid after 20th cutoff & no permission application received`;
                            if (onSuspendStudent) {
                              await onSuspendStudent(m.id, reason);
                              setStatusMessage({
                                type: 'success',
                                text: `${m.name} (${m.admissionNo}) has been ${
                                  isAdmin ? 'suspended' : 'submitted for Admin suspension approval'
                                }.`,
                              });
                            }
                          }}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[11px] cursor-pointer whitespace-nowrap"
                        >
                          {isAdmin ? 'Suspend Member' : 'Request Suspension'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {eligibleForManualSuspension.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        All members have either cleared their dues, hold an active Permission Extension Letter, or are already suspended.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsIndividualSuspendModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Attachment Preview Modal */}
      {previewScreenshot && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h4 className="font-bold text-sm">{previewScreenshot.title}</h4>
              <button
                onClick={() => setPreviewScreenshot(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 bg-slate-100 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img
                src={previewScreenshot.url}
                alt={previewScreenshot.title}
                className="max-w-full max-h-[65vh] rounded-xl border border-slate-300 shadow-md object-contain bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
