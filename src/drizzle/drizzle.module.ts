import { Global, Module, DynamicModule } from '@nestjs/common';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

export const DRIZZLE = Symbol('drizzle-connection');

@Global()
@Module({})
export class DrizzleModule {
  static forRoot(connectionString: string): DynamicModule {
    const sql = neon(connectionString);
    const db = drizzle(sql, { schema });

    return {
      module: DrizzleModule,
      providers: [
        {
          provide: DRIZZLE,
          useValue: db,
        },
      ],
      exports: [DRIZZLE],
    };
  }
}
