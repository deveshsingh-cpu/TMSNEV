import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { FuelBillExtractionResult } from '../../types/index.js';

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8 MB safety cap
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

export class BillReaderError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'BillReaderError';
    this.statusCode = statusCode;
  }
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new BillReaderError(
      'Bill reader requires a configured Gemini API key. Open Settings > Secrets to set or verify GEMINI_API_KEY.',
      503
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseValidatedDataUrl(rawDataUrl: string): { mimeType: string; base64Data: string } {
  const trimmed = String(rawDataUrl || '').trim();
  const match = trimmed.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) {
    throw new BillReaderError(
      'Invalid bill attachment format. Only compressed image or PDF data URLs can be read.',
      400
    );
  }
  const rawMime = match[1].toLowerCase().trim();
  const mimeType = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new BillReaderError(
      `Unsupported bill file type (${mimeType}). Attach a JPG, PNG, WebP, or PDF receipt.`,
      400
    );
  }
  const base64Data = match[2].replace(/\s+/g, '');
  const byteLength = Buffer.from(base64Data, 'base64').byteLength;
  if (byteLength === 0 || byteLength > MAX_ATTACHMENT_BYTES) {
    throw new BillReaderError(
      'Attached bill file exceeds the 8 MB limit or is empty. Please upload a clearer photo.',
      400
    );
  }
  return { mimeType, base64Data };
}

function toPositiveNumber(val: unknown): number | null {
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function mapGeminiApiError(err: any): BillReaderError {
  const rawMsg = String(err?.message || err || 'Failed to read attached bill.');
  const status = Number(err?.status || err?.statusCode || 0);
  if (
    status === 400 ||
    status === 403 ||
    /API_KEY_INVALID|PERMISSION_DENIED|API key not valid/i.test(rawMsg)
  ) {
    return new BillReaderError(
      'Gemini API key error while reading bill. Check your API key in Settings > Secrets.',
      403
    );
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|rate limit|quota/i.test(rawMsg)) {
    return new BillReaderError(
      'Gemini rate limit or quota reached while reading bills. Please wait a moment and try again.',
      429
    );
  }
  if (status === 404 || /NOT_FOUND/i.test(rawMsg)) {
    return new BillReaderError(
      'Requested Gemini model is unavailable right now. Please try again shortly.',
      502
    );
  }
  return new BillReaderError(rawMsg, status >= 400 && status < 600 ? status : 502);
}

export async function readFuelBillFromDataUrl(
  rawDataUrl: string,
  context?: {
    expectedAmount?: number;
    vehicleNumber?: string;
    narrationHint?: string;
  }
): Promise<FuelBillExtractionResult> {
  const { mimeType, base64Data } = parseValidatedDataUrl(rawDataUrl);
  const ai = getGeminiClient();

  const contextLines: string[] = [];
  if (context?.vehicleNumber && context.vehicleNumber !== 'General') {
    contextLines.push(`Vehicle Reg/Label: ${context.vehicleNumber}`);
  }
  if (context?.expectedAmount && Number(context.expectedAmount) > 0) {
    contextLines.push(`Expense Amount Entered in Ledger: ₹${context.expectedAmount}`);
  }
  if (context?.narrationHint) {
    contextLines.push(`Ledger Narration: ${context.narrationHint}`);
  }

  const prompt = [
    'Read this fuel pump receipt, cash memo, UPI slip, or handwritten bill attached to a school transport expense entry in Chainpur, Siwan, Bihar (841203).',
    'Extract carefully ONLY what is actually visible or clearly written on the slip (never guess values that are not printed or written):',
    '- fuelType: "Diesel" (HSD / High Speed Diesel / Diesel / डीजल), "Petrol" (MS / Motor Spirit / Petrol / XP95 / Power / पेट्रोल), "CNG", or "Unknown" if not shown.',
    '- ratePerUnit: Pump rate per Litre (₹/L) or per kg (₹/kg) printed on the bill (0 if not shown).',
    '- quantity: Fuel quantity dispensed in Litres or kg (0 if not shown).',
    '- totalAmount: Total bill amount in ₹ (0 if not shown).',
    '- billNumber: Receipt / Invoice / Transaction / Voucher number (empty string if not shown).',
    '- vendorName: Petrol pump / station name (empty string if not shown).',
    '- billDate: Date on bill in YYYY-MM-DD format (empty string if not legible).',
    '- isReadableBill: true if key numbers/text on the attachment can be read, false if blurred/blank/unrelated.',
    '- summary: One crisp plain-English sentence explaining what was read from the slip (and noting if rate or quantity was missing from the slip).',
    contextLines.length > 0 ? `Ledger Context:\n${contextLines.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  let lastErr: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isReadableBill: { type: Type.BOOLEAN },
              fuelType: {
                type: Type.STRING,
                description: 'One of Diesel, Petrol, CNG, Unknown',
              },
              ratePerUnit: { type: Type.NUMBER },
              quantity: { type: Type.NUMBER },
              totalAmount: { type: Type.NUMBER },
              billNumber: { type: Type.STRING },
              vendorName: { type: Type.STRING },
              billDate: { type: Type.STRING },
              summary: { type: Type.STRING },
            },
            required: ['isReadableBill', 'fuelType', 'ratePerUnit', 'quantity', 'totalAmount', 'summary'],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);

      const rawFt = String(parsed.fuelType || '').trim().toLowerCase();
      const fuelType: FuelBillExtractionResult['fuelType'] =
        rawFt === 'diesel'
          ? 'Diesel'
          : rawFt === 'petrol'
          ? 'Petrol'
          : rawFt === 'cng'
          ? 'CNG'
          : 'Unknown';

      let ratePerUnit = toPositiveNumber(parsed.ratePerUnit);
      let quantity = toPositiveNumber(parsed.quantity);
      const totalAmount = toPositiveNumber(parsed.totalAmount);

      const effectiveAmt = totalAmount || toPositiveNumber(context?.expectedAmount) || null;
      if (ratePerUnit && !quantity && effectiveAmt) {
        quantity = Math.round((effectiveAmt / ratePerUnit) * 100) / 100;
      } else if (quantity && !ratePerUnit && effectiveAmt) {
        ratePerUnit = Math.round((effectiveAmt / quantity) * 100) / 100;
      }

      return {
        isReadableBill: Boolean(parsed.isReadableBill),
        fuelType,
        ratePerUnit,
        quantity,
        totalAmount,
        billNumber: String(parsed.billNumber || '').trim() || null,
        vendorName: String(parsed.vendorName || '').trim() || null,
        billDate: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.billDate || '').trim())
          ? String(parsed.billDate).trim()
          : null,
        summary:
          String(parsed.summary || '').trim() ||
          (parsed.isReadableBill
            ? 'Bill read successfully.'
            : 'Receipt image was unclear or did not list fuel prices.'),
      };
    } catch (err: any) {
      lastErr = err;
      const mapped = mapGeminiApiError(err);
      if (mapped.statusCode === 400 || mapped.statusCode === 403 || attempt === 2) {
        throw mapped;
      }
      const backoffMs = 500 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw mapGeminiApiError(lastErr);
}
