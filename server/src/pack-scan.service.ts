import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const EXTRACTION_PROMPT = `
You are examining a photo of a Marlboro cigarette pack.
Extract the printed alphanumeric code that appears directly above the DotCode dot-matrix barcode symbol.
The code is human-readable text, for example: "8MC L96 4TW HRV".

Rules:
- Return found: true only if the alphanumeric code is clearly visible and legible.
- Return the exact code string including spaces, exactly as printed.
- Set confidence to "high" if fully legible, "medium" if partially obscured but readable, "low" if you are uncertain.
- Do NOT decode the dot-matrix DotCode symbol — only read the printed text above it.
- If no pack code is visible or the image is too blurry/dark, return found: false and code: "".
`.trim();

export interface ScanResult {
  found: boolean;
  code: string;
  confidence: 'high' | 'medium' | 'low';
}

@Injectable()
export class PackScanService {
  private model;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set. Copy .env.example to .env and add your key.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            found: { type: SchemaType.BOOLEAN },
            code: { type: SchemaType.STRING },
            confidence: { type: SchemaType.STRING },
          },
          required: ['found', 'code', 'confidence'],
        },
      },
    });
  }

  async extractCode(imageBase64: string): Promise<ScanResult> {
    try {
      const result = await this.model.generateContent([
        EXTRACTION_PROMPT,
        {
          inlineData: {
            data: imageBase64,
            mimeType: 'image/jpeg',
          },
        },
      ]);

      const raw = JSON.parse(result.response.text());
      const confidence = (['high', 'medium', 'low'] as const).includes(raw.confidence)
        ? raw.confidence
        : 'low';

      return {
        found: Boolean(raw.found),
        code: String(raw.code ?? ''),
        confidence,
      };
    } catch (err) {
      throw new InternalServerErrorException(`Gemini extraction failed: ${err.message}`);
    }
  }
}
