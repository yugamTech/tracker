import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DailyChecksController } from './daily-checks.controller';
import { DailyChecksService } from './daily-checks.service';

@Module({
  imports: [JwtModule],
  controllers: [DailyChecksController],
  providers: [DailyChecksService],
})
export class DailyChecksModule {}
