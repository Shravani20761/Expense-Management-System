import { Injectable } from '@nestjs/common';

@Injectable()
export class OcrService {
  async processReceipt(receiptUrl: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      vendor: "Mock Vendor Inc.",
      detectedAmount: 125.50,
      detectedCurrency: "USD",
      confidence: 0.95,
      rawText: "MOCK RECEIPT\nTOTAL: 125.50",
      lines: [
        { item: "Office Supplies", amount: 100 },
        { item: "Tax", amount: 25.50 }
      ]
    };
  }
}
