import { Module, Global } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { ConfigService } from '@nestjs/config';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const connectionString = configService.get<string>('DATABASE_URL') || process.env.DATABASE_URL;
        if (!connectionString) {
          // Dummy connection for build phase or fallback
          const dummyClient = postgres('postgresql://dummy:dummy@localhost:5432/dummy');
          return drizzle(dummyClient, { schema });
        }
        const queryClient = postgres(connectionString);
        return drizzle(queryClient, { schema });
      },
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
