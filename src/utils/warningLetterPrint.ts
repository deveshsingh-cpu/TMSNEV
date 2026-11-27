import { jsPDF } from 'jspdf';
import {
  FeeInvoice,
  StudentMember,
  WarningLetterLanguage,
  WarningLetterStage,
} from '../types/index.js';
import { openHtmlPrintPreview } from './exportPrint.js';

export interface PrintableLetterTarget {
  member: StudentMember;
  letterNo: string;
  issueDate: string;
  deadlineDate: string;
  effectiveStopDate?: string;
  letterStage?: WarningLetterStage;
  letterLanguage?: WarningLetterLanguage;
  lateFineAmount?: number;
  baseOverdueAmount?: number;
}

export interface WarningLetterPrintOptions {
  invoices?: FeeInvoice[];
  schoolName?: string;
  selectedMonth?: string;
  customFilename?: string;
  letterStage?: WarningLetterStage;
  letterLanguage?: WarningLetterLanguage;
  effectiveStopDate?: string;
}

export function escapeHtml(val: unknown): string {
  if (val === undefined || val === null) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function resolveWarningLetterStage(
  stage?: string,
  warningLevel?: string
): WarningLetterStage {
  if (stage === 'letter_1' || stage === 'letter_2' || stage === 'letter_3') {
    return stage;
  }
  const lvl = String(warningLevel || '').toLowerCase();
  if (lvl.includes('letter 3') || lvl.includes('stopped') || lvl.includes('withdrawn') || lvl.includes('level 3')) {
    return 'letter_3';
  }
  if (lvl.includes('letter 2') || lvl.includes('stoppage')) {
    return 'letter_2';
  }
  return 'letter_1';
}

export function resolveWarningLetterLanguage(lang?: string): WarningLetterLanguage {
  return lang === 'hi' ? 'hi' : 'en';
}

export function getWarningLetterStageLabel(
  stage: WarningLetterStage,
  lang: WarningLetterLanguage = 'en'
): string {
  if (lang === 'hi') {
    if (stage === 'letter_2') return 'पत्र 2: अंतिम चेतावनी (सुविधा बंद तिथि)';
    if (stage === 'letter_3') return 'पत्र 3: परिवहन सुविधा बंद / वापस';
    return 'पत्र 1: चेतावनी सह स्मरण पत्र';
  }
  if (stage === 'letter_2') return 'Letter 2: Final Notice (Will Stop Transport)';
  if (stage === 'letter_3') return 'Letter 3: Transport Stopped / Withdrawn';
  return 'Letter 1: Reminder Notice';
}

export function getWarningLevelForStage(stage: WarningLetterStage) {
  if (stage === 'letter_2') return 'Letter 2: Final Stoppage Warning' as const;
  if (stage === 'letter_3') return 'Letter 3: Transport Stopped / Withdrawn' as const;
  return 'Letter 1: Reminder Notice' as const;
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

export function formatLetterDateDisplay(isoDate?: string): string {
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

interface ResolvedLetterContent {
  stage: WarningLetterStage;
  lang: WarningLetterLanguage;
  schoolDisplay: string;
  deptHeading: string;
  letterTitle: string;
  titleColorHex: string;
  titleColorRgb: [number, number, number];
  refLabel: string;
  dateLabel: string;
  toLabel: string;
  guardianLabel: string;
  wardLabel: string;
  admNoLabel: string;
  classLabel: string;
  addressLabel: string;
  phoneLabel: string;
  routeLabel: string;
  stopLabel: string;
  subjectLabel: string;
  subjectText: string;
  salutation: string;
  introParagraph: string;
  thPeriod: string;
  thInvoice: string;
  thBaseFee: string;
  thConcession: string;
  thPaid: string;
  thBalanceDue: string;
  summaryPendingLabel: string;
  summaryFineAppliedLabel: string;
  summaryFineConditionalLabel: string;
  summaryTotalLabel: string;
  currencyPrefix: string;
  primaryNoticeParagraph: string;
  secondaryNoteParagraph: string;
  regardsLabel: string;
  coordinatorLabel: string;
  sealSignLabel: string;
  cutLineText: string;
  ackTitle: string;
  ackBodyText: string;
  ackGuardianLabel: string;
  ackPhoneLabel: string;
  ackReceiptDateLabel: string;
  ackSignLabel: string;
  periodStr: string;
  baseDues: number;
  lateFine: number;
  totalPayable: number;
  formattedIssue: string;
  formattedDeadline: string;
  formattedStopDate: string;
  stuInvoices: FeeInvoice[];
}

function buildResolvedLetterContent(
  item: PrintableLetterTarget,
  options: WarningLetterPrintOptions
): ResolvedLetterContent {
  const { invoices = [], schoolName, selectedMonth = '2026-11' } = options;
  const { member, letterNo, issueDate, deadlineDate } = item;
  const stage = resolveWarningLetterStage(
    item.letterStage || options.letterStage
  );
  const lang = resolveWarningLetterLanguage(
    item.letterLanguage || options.letterLanguage
  );
  const stopDateIso =
    item.effectiveStopDate ||
    options.effectiveStopDate ||
    deadlineDate ||
    getDefault30thOfCurrentMonth(issueDate);

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
      : lang === 'hi'
      ? `${selectedMonth} तक`
      : `Up to ${selectedMonth}`;

  const formattedDeadline = formatLetterDateDisplay(deadlineDate);
  const formattedIssue = formatLetterDateDisplay(issueDate);
  const formattedStopDate = formatLetterDateDisplay(stopDateIso);
  const formattedBase = baseDues.toLocaleString('en-IN');
  const formattedFine = lateFine.toLocaleString('en-IN');
  const formattedTotal = totalPayable.toLocaleString('en-IN');
  const schoolDisplay = schoolName || 'Narendra Edu Valley';
  const wardName = member.name || (lang === 'hi' ? 'छात्र/छात्रा' : 'Student');
  const admNo = member.admissionNo || '-';
  const cleanClassStr =
    lang === 'hi'
      ? String(member.class || '-').replace(/^class\s+/i, '').trim() || '-'
      : member.class || '-';
  const classSec = `${cleanClassStr}-${member.section || '-'}`;
  const stopName = member.pickupDropStopName || member.villageName || (lang === 'hi' ? 'निर्धारित स्टॉप' : 'Assigned Stop');
  const routeName = member.routeCode || (lang === 'hi' ? 'निर्धारित रूट' : 'Assigned Route');

  if (lang === 'hi') {
    const letterTitle =
      stage === 'letter_3'
        ? 'परिवहन सुविधा बंद / वापस लिए जाने की सूचना (पत्र - 3)'
        : stage === 'letter_2'
        ? 'अंतिम चेतावनी एवं परिवहन सुविधा बंद करने की सूचना (पत्र - 2)'
        : 'चेतावनी सह स्मरण पत्र (पत्र - 1)';

    const subjectText =
      stage === 'letter_3'
        ? `परिवहन सुविधा दिनांक ${formattedStopDate} से बंद कर दी गई है — कृपया अपने पाल्य को स्वयं विद्यालय लाएँ (${periodStr})`
        : stage === 'letter_2'
        ? `अंतिम चेतावनी: बकाया परिवहन शुल्क (${periodStr}) जमा न होने पर दिनांक ${formattedStopDate} से परिवहन सुविधा बंद कर दी जाएगी`
        : `लंबित परिवहन शुल्क बकाया (${periodStr}) — जमा करने की तिथि: ${formattedDeadline}`;

    const introParagraph =
      stage === 'letter_3'
        ? `आपको सूचित किया जाता है कि आपके पाल्य ${wardName} (प्रवेश संख्या: ${admNo}, कक्षा: ${classSec}, स्टॉप: ${stopName}) के लंबित परिवहन शुल्क का लगातार भुगतान न किए जाने के कारण विद्यालय परिवहन विभाग द्वारा परिवहन सेवा बंद कर दी गई है। बकाया परिवहन शुल्क का विस्तृत विवरण नीचे दिया गया है:`
        : stage === 'letter_2'
        ? `पूर्व सूचना एवं स्मरण के बावजूद आपके पाल्य ${wardName} (प्रवेश संख्या: ${admNo}, कक्षा: ${classSec}, स्टॉप: ${stopName}) का लंबित परिवहन शुल्क अभी तक जमा नहीं किया गया है। कृपया इसे विद्यालय परिवहन विभाग की ओर से अंतिम चेतावनी सूचना समझें। बकाया परिवहन शुल्क का विवरण नीचे दिया गया है:`
        : `यह पत्र विद्यालय परिवहन विभाग की ओर से आपके पाल्य ${wardName} (प्रवेश संख्या: ${admNo}, कक्षा: ${classSec}, स्टॉप: ${stopName}) के लंबित परिवहन शुल्क बकाया के संबंध में एक आधिकारिक स्मरण पत्र है। बकाया परिवहन शुल्क का विस्तृत विवरण नीचे दिया गया है:`;

    const primaryNoticeParagraph =
      stage === 'letter_3'
        ? `परिवहन सुविधा बंद सूचना: आपके पाल्य की विद्यालय परिवहन सुविधा दिनांक ${formattedStopDate} से बंद एवं वापस ले ली गई है। कृपया अपने पाल्य को स्वयं अपने साथ विद्यालय लेकर आएँ और ले जाएँ (अपनी स्वयं की व्यवस्था से), क्योंकि परिवहन सुविधा समाप्त कर दी गई है।`
        : stage === 'letter_2'
        ? `अंतिम सूचना: यदि कुल देय बकाया राशि ₹${formattedTotal} दिनांक ${formattedDeadline} तक या उससे पहले जमा नहीं की गई, तो दिनांक ${formattedStopDate} से आपके पाल्य की विद्यालय परिवहन सुविधा बिना किसी अन्य सूचना के बंद कर दी जाएगी।`
        : `परिवहन सुविधा के निलंबन से बचने के लिए कृपया कुल देय राशि ₹${formattedTotal} दिनांक ${formattedDeadline} या उससे पहले अनिवार्य रूप से जमा करें।`;

    const secondaryNoteParagraph =
      stage === 'letter_3'
        ? `जब तक कुल लंबित बकाया ₹${formattedTotal} का पूरा भुगतान कर विद्यालय कार्यालय से पुनः परिवहन अनुमति प्राप्त नहीं की जाती, तब तक विद्यालय वाहन द्वारा पिकअप या ड्रॉप सेवा उपलब्ध नहीं होगी। यदि कोई वास्तविक आर्थिक कठिनाई हो, तो कृपया लिखित आवेदन के साथ स्वयं विद्यालय कार्यालय में संपर्क करें।`
        : stage === 'letter_2'
        ? `कृपया असुविधा से बचने हेतु दिनांक ${formattedDeadline} (${formattedStopDate} से पूर्व) तक विद्यालय कार्यालय में पूरा शुल्क जमा कर रसीद प्राप्त करें; दिनांक ${formattedStopDate} से वाहन स्टॉप पर नहीं रुकेगा। यदि कोई वास्तविक आर्थिक कठिनाई हो, तो कृपया जमा तिथि (${formattedDeadline}) से पूर्व लिखित आवेदन के साथ स्वयं विद्यालय कार्यालय में संपर्क करें।`
        : `यदि कोई वास्तविक आर्थिक कठिनाई हो, तो कृपया जमा तिथि (${formattedDeadline}) से पूर्व लिखित आवेदन के साथ स्वयं विद्यालय कार्यालय में संपर्क करें।`;

    const ackBodyText =
      stage === 'letter_3'
        ? `परिवहन सुविधा बंद / वापस लिए जाने की सूचना पत्र (पत्र - 3) संख्या ${letterNo} दिनांक ${formattedIssue} प्राप्त किया — बकाया राशि ₹${formattedBase}${
            lateFine > 0 ? ` + विलंब शुल्क ₹${formattedFine} (कुल देय: ₹${formattedTotal})` : ''
          }, प्रभावी बंद तिथि: ${formattedStopDate}, पाल्य: ${wardName} (${admNo}, कक्षा ${classSec}, रूट ${routeName})।`
        : stage === 'letter_2'
        ? `अंतिम चेतावनी एवं परिवहन बंद सूचना पत्र (पत्र - 2) संख्या ${letterNo} दिनांक ${formattedIssue} प्राप्त किया — बकाया राशि ₹${formattedBase}${
            lateFine > 0 ? ` + विलंब शुल्क ₹${formattedFine} (कुल देय: ₹${formattedTotal})` : ''
          }, सुविधा बंद होने की तिथि: ${formattedStopDate}, पाल्य: ${wardName} (${admNo}, कक्षा ${classSec}, रूट ${routeName})।`
        : `चेतावनी सह स्मरण पत्र संख्या ${letterNo} दिनांक ${formattedIssue} प्राप्त किया — लंबित परिवहन शुल्क ₹${formattedBase}${
            lateFine > 0 ? ` + विलंब शुल्क ₹${formattedFine} (कुल देय: ₹${formattedTotal})` : ''
          }, अवधि ${periodStr} (जमा तिथि: ${formattedDeadline}), पाल्य: ${wardName} (${admNo}, कक्षा ${classSec}, रूट ${routeName})।`;

    return {
      stage,
      lang,
      schoolDisplay,
      deptHeading: `${schoolDisplay} — परिवहन विभाग`,
      letterTitle,
      titleColorHex: stage === 'letter_3' ? '#7f1d1d' : stage === 'letter_2' ? '#991b1b' : '#b91c1c',
      titleColorRgb: stage === 'letter_3' ? [127, 29, 29] : stage === 'letter_2' ? [153, 27, 27] : [185, 28, 28],
      refLabel: 'पत्र क्रमांक:',
      dateLabel: 'जारी दिनांक:',
      toLabel: 'सेवा में,',
      guardianLabel: 'अभिभावक का नाम:',
      wardLabel: 'पाल्य (छात्र/छात्रा):',
      admNoLabel: 'प्रवेश संख्या:',
      classLabel: 'कक्षा:',
      addressLabel: 'पता:',
      phoneLabel: 'मोबाइल नं.:',
      routeLabel: 'रूट:',
      stopLabel: 'स्टॉप:',
      subjectLabel: 'विषय:',
      subjectText,
      salutation: 'महोदय / महोदया,',
      introParagraph,
      thPeriod: 'माह / अवधि',
      thInvoice: 'बिल संख्या',
      thBaseFee: 'मूल शुल्क',
      thConcession: 'रियायत',
      thPaid: 'जमा',
      thBalanceDue: 'बकाया राशि',
      summaryPendingLabel: 'लंबित परिवहन शुल्क बकाया:',
      summaryFineAppliedLabel: 'विलंब शुल्क (10 तारीख के बाद देय):',
      summaryFineConditionalLabel: 'विलंब शुल्क (10 तारीख के बाद भुगतान पर ₹100 लागू):',
      summaryTotalLabel: 'कुल देय बकाया राशि:',
      currencyPrefix: '₹',
      primaryNoticeParagraph,
      secondaryNoteParagraph,
      regardsLabel: 'भवदीय,',
      coordinatorLabel: 'परिवहन समन्वयक',
      sealSignLabel: '(कार्यालय मुहर एवं हस्ताक्षर)',
      cutLineText: '✂ ------------------------ पावती रसीद (यहाँ से फाड़कर कार्यालय में जमा करें) ------------------------',
      ackTitle: 'पावती रसीद (अभिभावक द्वारा हस्ताक्षरित कर परिवहन कार्यालय में जमा करें)',
      ackBodyText,
      ackGuardianLabel: 'अभिभावक का नाम:',
      ackPhoneLabel: 'मोबाइल नंबर:',
      ackReceiptDateLabel: 'प्राप्ति दिनांक:',
      ackSignLabel: 'अभिभावक के हस्ताक्षर:',
      periodStr,
      baseDues,
      lateFine,
      totalPayable,
      formattedIssue,
      formattedDeadline,
      formattedStopDate,
      stuInvoices,
    };
  }

  // English variants (Letter 1, Letter 2, Letter 3)
  const letterTitle =
    stage === 'letter_3'
      ? 'NOTICE: TRANSPORT FACILITY STOPPED / WITHDRAWN (LETTER 3)'
      : stage === 'letter_2'
      ? 'FINAL WARNING & TRANSPORT STOPPAGE NOTICE (LETTER 2)'
      : 'WARNING CUM REMINDER LETTER';

  const subjectText =
    stage === 'letter_3'
      ? `Transport Facility Stopped / Withdrawn w.e.f. ${formattedStopDate} — Bring Your Ward Yourself (${periodStr})`
      : stage === 'letter_2'
      ? `FINAL WARNING: Transport Facility Will Be Stopped w.e.f. ${formattedStopDate} Due to Pending Dues (${periodStr})`
      : `Pending Transport Fee Dues for ${periodStr} — Deposit Date: ${formattedDeadline}`;

  const introParagraph =
    stage === 'letter_3'
      ? `Please be informed that due to continued non-payment of pending transport fee dues of your ward ${wardName} (Admission No: ${admNo}, Class: ${classSec}, Stop: ${stopName}), the School Transport Department has discontinued your ward's transport facility. The statement of unpaid dues is given below:`
      : stage === 'letter_2'
      ? `Despite earlier reminder notices, the pending transport fee dues of your ward ${wardName} (Admission No: ${admNo}, Class: ${classSec}, Stop: ${stopName}) have not been cleared till date. Please treat this as a final warning notice from the School Transport Department. The detailed statement of unpaid dues is given below:`
      : `This is an official reminder from the School Transport Department regarding the pending transport fee dues of your ward ${wardName} (Admission No: ${admNo}, Class: ${classSec}, Stop: ${stopName}). The detailed statement of unpaid transport dues is given below:`;

  const primaryNoticeParagraph =
    stage === 'letter_3'
      ? `TRANSPORT FACILITY STOPPED / WITHDRAWN: Your ward's school transport facility is STOPPED with effect from ${formattedStopDate}. Kindly bring your ward to school along with you (at your own arrangement), as the transport facility has been withdrawn.`
      : stage === 'letter_2'
      ? `FINAL NOTICE: If the total payable amount of Rs. ${formattedTotal} is NOT deposited in full on or before ${formattedDeadline}, the school transport facility for your ward WILL BE STOPPED WITH EFFECT FROM ${formattedStopDate} without any further notice.`
      : `Kindly deposit the total payable amount of Rs. ${formattedTotal} on or before ${formattedDeadline} to avoid suspension of transport facility.`;

  const secondaryNoteParagraph =
    stage === 'letter_3'
      ? `School transport pickup and drop service will remain suspended until all pending transport dues of Rs. ${formattedTotal} are cleared in full and fresh reinstatement approval is issued by the transport office. In case of any genuine economic difficulty, please visit the school office in person with a written application.`
      : stage === 'letter_2'
      ? `You are advised to deposit the overdue amount on or before ${formattedDeadline} (prior to stoppage date ${formattedStopDate}), as from ${formattedStopDate} onwards the transport vehicle will not stop for pickup or drop. In case of any genuine economic difficulty, please visit the school office in person with a written application before the deposit date (${formattedDeadline}).`
      : `In case of any genuine economic difficulty, please visit the school office in person with a written application before the deposit date (${formattedDeadline}).`;

  const ackBodyText =
    stage === 'letter_3'
      ? `Received Transport Facility Stopped / Withdrawn Notice (Letter 3) No. ${letterNo} dated ${formattedIssue} regarding pending dues of Rs. ${formattedBase}${
          lateFine > 0
            ? ` + Applicable Late Fine Rs. ${formattedFine} (Total Payable: Rs. ${formattedTotal})`
            : ''
        }, effective stoppage date ${formattedStopDate}, in respect of ${wardName} (${admNo}, Class ${classSec}, Route ${routeName}).`
      : stage === 'letter_2'
      ? `Received Final Warning & Stoppage Notice (Letter 2) No. ${letterNo} dated ${formattedIssue} regarding pending dues of Rs. ${formattedBase}${
          lateFine > 0
            ? ` + Applicable Late Fine Rs. ${formattedFine} (Total Payable: Rs. ${formattedTotal})`
            : ''
        } with transport stoppage date ${formattedStopDate} in respect of ${wardName} (${admNo}, Class ${classSec}, Route ${routeName}).`
      : `Received Warning cum Reminder Letter No. ${letterNo} dated ${formattedIssue} regarding pending transport fee dues of Rs. ${formattedBase}${
          lateFine > 0
            ? ` + Applicable Late Fine Rs. ${formattedFine} (Total Payable: Rs. ${formattedTotal})`
            : ''
        } for Period ${periodStr} (Deposit Date: ${formattedDeadline}) in respect of ${wardName} (${admNo}, Class ${classSec}, Route ${routeName}).`;

  return {
    stage,
    lang,
    schoolDisplay,
    deptHeading: `${schoolDisplay} — Transport Department`,
    letterTitle,
    titleColorHex: stage === 'letter_3' ? '#7f1d1d' : stage === 'letter_2' ? '#991b1b' : '#b91c1c',
    titleColorRgb: stage === 'letter_3' ? [127, 29, 29] : stage === 'letter_2' ? [153, 27, 27] : [185, 28, 28],
    refLabel: 'Letter Ref No:',
    dateLabel: 'Issue Date:',
    toLabel: 'To,',
    guardianLabel: 'Name of Guardian:',
    wardLabel: 'Ward:',
    admNoLabel: 'ID:',
    classLabel: 'Class:',
    addressLabel: 'Address:',
    phoneLabel: 'Phone No:',
    routeLabel: 'Route:',
    stopLabel: 'Stop:',
    subjectLabel: 'Subject:',
    subjectText,
    salutation: 'Dear Sir / Madam,',
    introParagraph,
    thPeriod: 'Billing Period',
    thInvoice: 'Invoice Ref',
    thBaseFee: 'Base Fee',
    thConcession: 'Concession',
    thPaid: 'Paid',
    thBalanceDue: 'Balance Due',
    summaryPendingLabel: 'Pending Transport Fee Dues:',
    summaryFineAppliedLabel: 'Applicable Late Fine (After 10th Due Date):',
    summaryFineConditionalLabel: 'Late Fine (Rs. 100 applicable if paid after 10th):',
    summaryTotalLabel: 'TOTAL OVERDUE AMOUNT PAYABLE:',
    currencyPrefix: 'Rs. ',
    primaryNoticeParagraph,
    secondaryNoteParagraph,
    regardsLabel: 'Regards,',
    coordinatorLabel: 'Transport Coordinator',
    sealSignLabel: '(Office Seal & Sign)',
    cutLineText: '✂ ------------------------------------------------ TEAR-OFF ACKNOWLEDGEMENT SLIP ------------------------------------------------',
    ackTitle: 'ACKNOWLEDGEMENT SLIP (To be signed by Guardian & submitted to Transport Office)',
    ackBodyText,
    ackGuardianLabel: 'Guardian Name:',
    ackPhoneLabel: 'Phone No:',
    ackReceiptDateLabel: 'Date of Receipt:',
    ackSignLabel: 'Signature of Guardian:',
    periodStr,
    baseDues,
    lateFine,
    totalPayable,
    formattedIssue,
    formattedDeadline,
    formattedStopDate,
    stuInvoices,
  };
}

export function buildSingleWarningLetterPageXhtml(
  item: PrintableLetterTarget,
  options: WarningLetterPrintOptions = {}
): string {
  const c = buildResolvedLetterContent(item, options);
  const { member, letterNo } = item;
  const guardianFallback = c.lang === 'hi' ? 'अभिभावक' : 'Parent / Guardian';
  const addrFallback = c.lang === 'hi' ? 'पंजीकृत पता' : 'Registered Address';
  const stopFallback = c.lang === 'hi' ? 'स्टॉप' : 'Stop';
  const routeFallback = c.lang === 'hi' ? 'निर्धारित रूट' : 'Assigned Route';
  const issueYear = (item.issueDate || new Date().toISOString().slice(0, 10)).slice(0, 4) || '2026';

  const openBalLabel = c.lang === 'hi' ? 'प्रारंभिक बकाया' : 'OPEN-BAL';
  const duesRowsHtml =
    c.stuInvoices.length > 0
      ? c.stuInvoices
          .map(
            (inv) => `
                  <tr>
                    <td>${escapeHtml(inv.month)}</td>
                    <td>${escapeHtml(inv.invoiceNo)}</td>
                    <td style="text-align:right;">${escapeHtml(c.currencyPrefix)}${inv.baseFee}</td>
                    <td style="text-align:right;">${escapeHtml(c.currencyPrefix)}${inv.concession}</td>
                    <td style="text-align:right;">${escapeHtml(c.currencyPrefix)}${inv.paidAmount}</td>
                    <td style="text-align:right;font-weight:bold;">${escapeHtml(c.currencyPrefix)}${inv.balanceDue}</td>
                  </tr>
                `
          )
          .join('')
      : `
                <tr>
                  <td>${escapeHtml(c.periodStr)}</td>
                  <td>${escapeHtml(openBalLabel)}</td>
                  <td style="text-align:right;">${escapeHtml(c.currencyPrefix)}${member.monthlyFee || c.baseDues}</td>
                  <td style="text-align:right;">${escapeHtml(c.currencyPrefix)}${member.concessionAmount || 0}</td>
                  <td style="text-align:right;">${escapeHtml(c.currencyPrefix)}0</td>
                  <td style="text-align:right;font-weight:bold;">${escapeHtml(c.currencyPrefix)}${c.baseDues}</td>
                </tr>
              `;

  const urgentBoxStyle =
    c.stage === 'letter_3'
      ? 'background:#fef2f2;border:2px solid #991b1b;border-radius:6px;padding:10px 12px;margin:10px 0;'
      : c.stage === 'letter_2'
      ? 'background:#fff1f2;border:1.5px solid #dc2626;border-radius:6px;padding:9px 12px;margin:10px 0;'
      : '';

  return `
    <div class="page">
      <div class="letter-box">
        <div class="header">
          <h1>${escapeHtml(c.deptHeading)}</h1>
          <h2 style="color:${c.titleColorHex};">${escapeHtml(c.letterTitle)}</h2>
        </div>
        <div class="meta-row">
          <div><strong>${escapeHtml(c.refLabel)}</strong> ${escapeHtml(letterNo)}</div>
          <div><strong>${escapeHtml(c.dateLabel)}</strong> ${escapeHtml(c.formattedIssue)}</div>
        </div>
        <div class="recipient">
          <div><strong>${escapeHtml(c.toLabel)}</strong></div>
          <div><strong>${escapeHtml(c.guardianLabel)}</strong> ${escapeHtml(member.fatherName || guardianFallback)} (${escapeHtml(c.wardLabel)} <strong>${escapeHtml(member.name)}</strong>, ${escapeHtml(c.admNoLabel)} ${escapeHtml(member.admissionNo)}, ${escapeHtml(c.classLabel)} ${escapeHtml(member.class)}-${escapeHtml(member.section)})</div>
          <div><strong>${escapeHtml(c.addressLabel)}</strong> ${escapeHtml(member.address || member.villageName || addrFallback)} (${escapeHtml(member.pickupDropStopName || stopFallback)})</div>
          <div><strong>${escapeHtml(c.phoneLabel)}</strong> ${escapeHtml(member.mobile || member.emergencyContact || '—')} &#160;|&#160; <strong>${escapeHtml(c.routeLabel)}</strong> ${escapeHtml(member.routeCode || routeFallback)}</div>
        </div>
        <div class="subject">
          <strong>${escapeHtml(c.subjectLabel)}</strong> ${escapeHtml(c.subjectText)}
        </div>
        <div class="body-text">
          <p><strong>${escapeHtml(c.salutation)}</strong></p>
          <p>${escapeHtml(c.introParagraph)}</p>
          <table class="dues-table">
            <thead>
              <tr>
                <th>${escapeHtml(c.thPeriod)}</th>
                <th>${escapeHtml(c.thInvoice)}</th>
                <th style="text-align:right;">${escapeHtml(c.thBaseFee)}</th>
                <th style="text-align:right;">${escapeHtml(c.thConcession)}</th>
                <th style="text-align:right;">${escapeHtml(c.thPaid)}</th>
                <th style="text-align:right;">${escapeHtml(c.thBalanceDue)}</th>
              </tr>
            </thead>
            <tbody>
              ${duesRowsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="5" style="text-align:right;font-weight:bold;">${escapeHtml(c.summaryPendingLabel)}</td>
                <td style="text-align:right;font-weight:bold;">${escapeHtml(c.currencyPrefix)}${escapeHtml(c.baseDues.toLocaleString('en-IN'))}</td>
              </tr>
              <tr>
                <td colspan="5" style="text-align:right;font-weight:bold;color:${c.lateFine > 0 ? '#be123c' : '#475569'};">
                  ${escapeHtml(c.lateFine > 0 ? c.summaryFineAppliedLabel : c.summaryFineConditionalLabel)}
                </td>
                <td style="text-align:right;font-weight:bold;color:${c.lateFine > 0 ? '#be123c' : '#475569'};">
                  ${escapeHtml(c.lateFine > 0 ? `+ ${c.currencyPrefix}${c.lateFine.toLocaleString('en-IN')}` : `${c.currencyPrefix}0`)}
                </td>
              </tr>
              <tr style="background:#fef2f2;">
                <td colspan="5" style="text-align:right;font-weight:800;font-size:13px;color:#991b1b;">${escapeHtml(c.summaryTotalLabel)}</td>
                <td style="text-align:right;font-weight:800;font-size:13px;color:#b91c1c;">${escapeHtml(c.currencyPrefix)}${escapeHtml(c.totalPayable.toLocaleString('en-IN'))}</td>
              </tr>
            </tfoot>
          </table>
          <div style="${urgentBoxStyle}">
            <p style="margin:0 0 5px 0;">
              <strong style="color:${c.titleColorHex};">${escapeHtml(c.primaryNoticeParagraph)}</strong>
            </p>
            <p style="margin:0;">${escapeHtml(c.secondaryNoteParagraph)}</p>
          </div>
        </div>
        <div class="sign-row">
          <div>
            <strong>${escapeHtml(c.regardsLabel)}</strong><br/>
            <strong>${escapeHtml(c.coordinatorLabel)}</strong><br/>
            ${escapeHtml(c.schoolDisplay)}
          </div>
          <div style="text-align:right;">
            <br/>
            <em>${escapeHtml(c.sealSignLabel)}</em>
          </div>
        </div>

        <div class="cut-line">${escapeHtml(c.cutLineText)}</div>

        <div class="ack-box">
          <div class="ack-title">${escapeHtml(c.ackTitle)}</div>
          <p style="margin:6px 0;font-size:11.5px;">${escapeHtml(c.ackBodyText)}</p>
          <div class="ack-grid">
            <div><strong>${escapeHtml(c.ackGuardianLabel)}</strong> ${escapeHtml(member.fatherName || '________________')}</div>
            <div><strong>${escapeHtml(c.ackPhoneLabel)}</strong> ${escapeHtml(member.mobile || '________________')}</div>
            <div><strong>${escapeHtml(c.ackReceiptDateLabel)}</strong> ____/____/${escapeHtml(issueYear)}</div>
            <div><strong>${escapeHtml(c.ackSignLabel)}</strong> ________________________</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

const SHARED_LETTER_CSS = `
  body { font-family: 'Noto Sans Devanagari', 'Kohinoor Devanagari', 'Mangal', 'Nirmala UI', Arial, sans-serif; color: #0f172a; margin: 0; padding: 16px; background: #ffffff; }
  .page { page-break-after: always; padding: 10px 0; }
  .page:last-child { page-break-after: auto; }
  .letter-box { border: 2px solid #0f172a; border-radius: 10px; padding: 20px 22px; max-width: 760px; margin: 0 auto; background: #ffffff; }
  .header { text-align: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 10px; margin-bottom: 12px; }
  .header h1 { margin: 0; font-size: 17px; text-transform: uppercase; color: #0f172a; }
  .header h2 { margin: 4px 0 0; font-size: 13.5px; color: #b91c1c; letter-spacing: 0.3px; }
  .meta-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 10px; }
  .recipient { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 9px 12px; font-size: 12px; line-height: 1.5; margin-bottom: 10px; }
  .subject { font-size: 12.5px; margin-bottom: 10px; padding: 6px 0; border-bottom: 1px solid #e2e8f0; }
  .body-text { font-size: 12px; line-height: 1.5; }
  .dues-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 11.5px; }
  .dues-table th, .dues-table td { border: 1px solid #94a3b8; padding: 5px 7px; }
  .dues-table th { background: #f1f5f9; text-align: left; }
  .sign-row { display: flex; justify-content: space-between; margin-top: 16px; font-size: 12px; }
  .cut-line { margin: 12px 0 8px; text-align: center; font-size: 10.5px; color: #64748b; font-weight: bold; }
  .ack-box { border: 1.5px dashed #334155; border-radius: 8px; padding: 11px; background: #fffbeb; }
  .ack-title { font-weight: bold; font-size: 11.5px; text-align: center; text-transform: uppercase; margin-bottom: 5px; }
  .ack-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; font-size: 11.5px; margin-top: 8px; }
`;

export function buildWarningLettersDocumentHtml(
  targetMembers: PrintableLetterTarget[],
  options: WarningLetterPrintOptions = {}
): string {
  const pagesHtml = targetMembers
    .map((item) => buildSingleWarningLetterPageXhtml(item, options))
    .join('');

  const first = targetMembers[0];
  const stage = resolveWarningLetterStage(first?.letterStage || options.letterStage);
  const lang = resolveWarningLetterLanguage(first?.letterLanguage || options.letterLanguage);
  const docTitle = getWarningLetterStageLabel(stage, lang);

  return `
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(docTitle)}</title>
        <style>${SHARED_LETTER_CSS}</style>
      </head>
      <body>${pagesHtml}</body>
    </html>
  `;
}

async function renderXhtmlPageToPngDataUrl(pageXhtml: string): Promise<string> {
  const width = 794;
  const height = 1123;
  const scale = 2;
  const svgMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject x="0" y="0" width="${width}" height="${height}">
        <div xmlns="http://www.w3.org/1999/xhtml" style="background:#ffffff;padding:18px;box-sizing:border-box;width:${width}px;height:${height}px;font-family:'Noto Sans Devanagari','Kohinoor Devanagari','Mangal','Nirmala UI',Arial,sans-serif;color:#0f172a;">
          <style>${SHARED_LETTER_CSS}</style>
          ${pageXhtml}
        </div>
      </foreignObject>
    </svg>
  `.trim();

  const img = new Image();
  const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (err) => reject(err);
    img.src = dataUri;
  });

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/png');
}

export async function downloadWarningLettersPdf(
  targetMembers: PrintableLetterTarget[],
  options: WarningLetterPrintOptions = {}
) {
  if (targetMembers.length === 0) return;
  const { customFilename } = options;
  const todayIso = new Date().toISOString().slice(0, 10);

  const hasNonLatinContent = targetMembers.some((item) => {
    const lang = resolveWarningLetterLanguage(item.letterLanguage || options.letterLanguage);
    return (
      lang === 'hi' ||
      /[^\u0000-\u00ff]/.test(
        `${item.member.name || ''}${item.member.fatherName || ''}${item.member.address || ''}`
      )
    );
  });

  // For Hindi / Devanagari Unicode letters, jsPDF's built-in Helvetica cannot shape Devanagari glyphs.
  // Render exact UTF-8 browser-shaped XHTML pages onto high-DPI canvases and embed into A4 PDF!
  if (hasNonLatinContent) {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      for (let i = 0; i < targetMembers.length; i++) {
        if (i > 0) doc.addPage();
        const pageXhtml = buildSingleWarningLetterPageXhtml(targetMembers[i], options);
        const pngDataUrl = await renderXhtmlPageToPngDataUrl(pageXhtml);
        doc.addImage(pngDataUrl, 'PNG', 0, 0, 210, 297);
      }
      const outName =
        customFilename ||
        (targetMembers.length === 1
          ? `warning_letter_${targetMembers[0].letterNo}.pdf`
          : `bulk_warning_letters_${todayIso}.pdf`);
      doc.save(outName.endsWith('.pdf') ? outName : `${outName}.pdf`);
      return;
    } catch {
      // If browser blocks foreignObject canvas export, fall back cleanly to Print / Save as PDF preview
      printWarningCumReminderLetters(targetMembers, options, true);
      return;
    }
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 12;
  const boxW = pageW - margin * 2;

  targetMembers.forEach((item, idx) => {
    if (idx > 0) doc.addPage();
    const { member, letterNo } = item;
    const c = buildResolvedLetterContent(item, options);

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
      `${c.schoolDisplay.toUpperCase()} - TRANSPORT DEPARTMENT`,
      pageW / 2,
      y,
      { align: 'center' }
    );
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(...c.titleColorRgb);
    doc.text(c.letterTitle, pageW / 2, y, { align: 'center' });
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
    doc.text(`Issue Date: ${c.formattedIssue}`, pageW - margin - 6, y, { align: 'right' });

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
    doc.setFontSize(9);
    const subjLines = doc.splitTextToSize(`Subject: ${c.subjectText}`, boxW - 12);
    doc.text(subjLines[0] || `Subject: ${c.subjectText}`, margin + 6, y);
    y += 2.5;
    doc.line(margin + 6, y, pageW - margin - 6, y);

    // Salutation & Body
    y += 5.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(c.salutation, margin + 6, y);
    y += 4.8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const introLines = doc.splitTextToSize(c.introParagraph, boxW - 12);
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
      for (let colIdx = 1; colIdx < 6; colIdx++) {
        doc.line(colX[colIdx], rowY, colX[colIdx], rowY + rowH);
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

    const maxInvoiceRows = Math.min(c.stuInvoices.length, 8);
    if (maxInvoiceRows > 0) {
      for (let r = 0; r < maxInvoiceRows; r++) {
        const inv = c.stuInvoices[r];
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
      if (c.stuInvoices.length > maxInvoiceRows) {
        const extraBal = c.stuInvoices
          .slice(maxInvoiceRows)
          .reduce((s, inv) => s + (inv.balanceDue || 0), 0);
        y = drawTableRow(
          [
            `+${c.stuInvoices.length - maxInvoiceRows} more`,
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
          c.periodStr.slice(0, 14),
          'OPEN-BAL',
          `Rs. ${member.monthlyFee || c.baseDues}`,
          `Rs. ${member.concessionAmount || 0}`,
          'Rs. 0',
          `Rs. ${c.baseDues}`,
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
      c.summaryPendingLabel,
      `Rs. ${c.baseDues.toLocaleString('en-IN')}`,
      y,
      false
    );
    y = drawSummaryRow(
      c.lateFine > 0 ? c.summaryFineAppliedLabel : c.summaryFineConditionalLabel,
      c.lateFine > 0 ? `+ Rs. ${c.lateFine.toLocaleString('en-IN')}` : 'Rs. 0',
      y,
      false
    );
    y = drawSummaryRow(
      c.summaryTotalLabel,
      `Rs. ${c.totalPayable.toLocaleString('en-IN')}`,
      y,
      true
    );

    // Stage-Specific Warning / Stoppage / Withdrawn Block
    y += 5;
    if (c.stage === 'letter_2' || c.stage === 'letter_3') {
      const boxH = 26;
      doc.setFillColor(c.stage === 'letter_3' ? 254 : 255, c.stage === 'letter_3' ? 242 : 241, 242);
      doc.setDrawColor(...c.titleColorRgb);
      doc.setLineWidth(c.stage === 'letter_3' ? 0.55 : 0.4);
      doc.roundedRect(margin + 6, y, boxW - 12, boxH, 1.5, 1.5, 'FD');
      y += 4.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...c.titleColorRgb);
      const primaryLines = doc.splitTextToSize(c.primaryNoticeParagraph, boxW - 18);
      doc.text(primaryLines, margin + 9, y);
      y += primaryLines.length * 4 + 1.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      const secLines = doc.splitTextToSize(c.secondaryNoteParagraph, boxW - 18);
      doc.text(secLines, margin + 9, y);
      y += secLines.length * 3.8 + 6;
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.setTextColor(185, 28, 28);
      const deadlineNotice = doc.splitTextToSize(c.primaryNoticeParagraph, boxW - 12);
      doc.text(deadlineNotice, margin + 6, y);
      y += deadlineNotice.length * 4.2 + 1;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.3);
      doc.setTextColor(15, 23, 42);
      const noteLines = doc.splitTextToSize(c.secondaryNoteParagraph, boxW - 12);
      doc.text(noteLines, margin + 6, y);
      y += noteLines.length * 4.2 + 5;
    }

    // Signature Row
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(15, 23, 42);
    doc.text(c.regardsLabel, margin + 6, y);
    doc.text(c.coordinatorLabel, margin + 6, y + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.text(c.schoolDisplay, margin + 6, y + 9);
    doc.setFont('helvetica', 'italic');
    doc.text(c.sealSignLabel, pageW - margin - 6, y + 9, { align: 'right' });

    // Tear-Off Acknowledgement Slip at Bottom
    const slipTop = Math.max(y + 14, 230);
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
    doc.setFontSize(8.4);
    doc.text(c.ackTitle, pageW / 2, ackBoxY + 5.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const ackText = doc.splitTextToSize(c.ackBodyText, boxW - 18);
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
  options: WarningLetterPrintOptions = { invoices: [] },
  autoPrint = false
) {
  if (targetMembers.length === 0) return;
  const { invoices = [], schoolName, selectedMonth = '2026-11' } = options;
  const todayIso = new Date().toISOString().slice(0, 10);

  const html = buildWarningLettersDocumentHtml(targetMembers, options);
  const first = targetMembers[0];
  const stage = resolveWarningLetterStage(first?.letterStage || options.letterStage);
  const lang = resolveWarningLetterLanguage(first?.letterLanguage || options.letterLanguage);
  const stageShort = getWarningLetterStageLabel(stage, lang);
  const langLabel = lang === 'hi' ? 'Hindi (हिन्दी)' : 'English';
  const stopOrDeposit =
    stage === 'letter_1'
      ? `Deposit Date: ${formatLetterDateDisplay(first.deadlineDate)}`
      : `${stage === 'letter_3' ? 'Stopped Effective Date' : 'Stop Transport From'}: ${formatLetterDateDisplay(
          first.effectiveStopDate || options.effectiveStopDate || first.deadlineDate
        )}`;

  const baseFile =
    targetMembers.length === 1
      ? `warning_letter_${targetMembers[0].letterNo}`
      : `bulk_warning_letters_${todayIso}`;

  openHtmlPrintPreview({
    title:
      targetMembers.length === 1
        ? `${stageShort} — ${first.member.name} (${first.letterNo})`
        : `Bulk ${stageShort} (${targetMembers.length} Members)`,
    subtitle: `${stopOrDeposit} • Language: ${langLabel} • Includes Dues Statement & Acknowledgement Slip`,
    html,
    filename: baseFile,
    autoPrint,
    printButtonLabel:
      targetMembers.length === 1 ? '🖨️ Print Letter' : `🖨️ Print Letters (${targetMembers.length})`,
    pdfButtonLabel:
      targetMembers.length === 1 ? '📄 Save as PDF' : `📄 Save as PDF (${targetMembers.length})`,
    onSavePdf: () =>
      downloadWarningLettersPdf(targetMembers, {
        invoices,
        schoolName,
        selectedMonth,
        letterStage: options.letterStage,
        letterLanguage: options.letterLanguage,
        effectiveStopDate: options.effectiveStopDate,
        customFilename: `${baseFile}.pdf`,
      }),
  });
}
