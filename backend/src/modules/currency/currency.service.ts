import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE } from '../../drizzle/drizzle.module';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '../../drizzle/schema';
import { eq, desc } from 'drizzle-orm';

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);

  constructor(
    private configService: ConfigService,
    @Inject(DRIZZLE) private db: NeonHttpDatabase<typeof schema>,
  ) {}

  async getConversionRates(baseCurrency: string): Promise<Record<string, number>> {
    const latestLog = await this.db.query.currencyConversionLogs.findFirst({
      where: eq(schema.currencyConversionLogs.baseCurrency, baseCurrency),
      orderBy: [desc(schema.currencyConversionLogs.fetchedAt)],
    });

    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    if (latestLog && new Date().getTime() - new Date(latestLog.fetchedAt).getTime() < TWELVE_HOURS) {
      return latestLog.rates as Record<string, number>;
    }

    const baseUrl = this.configService.get<string>('EXCHANGERATE_API_BASE');
    try {
      const response = await fetch(`${baseUrl}/${baseCurrency}`);
      const data = await response.json();

      if (data && data.rates) {
        await this.db.insert(schema.currencyConversionLogs).values({
          baseCurrency,
          rates: data.rates,
        });
        return data.rates;
      }
    } catch (e) {
      this.logger.error(`Failed to fetch exchange rates for ${baseCurrency}`, e);
    }
    
    return (latestLog?.rates as Record<string, number>) || {};
  }
}
