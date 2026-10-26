import { Global, Module } from '@nestjs/common';
import { ENV, loadEnvFile, parseEnv } from './env';

@Global()
@Module({
  providers: [
    {
      provide: ENV,
      useFactory: () => {
        loadEnvFile();
        return parseEnv();
      },
    },
  ],
  exports: [ENV],
})
export class ConfigModule {}
