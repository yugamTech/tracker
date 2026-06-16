import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

// Bulk Excel import (PRD-01 FR-16–21): template / validate (dry-run) / commit.
@Module({
  imports: [JwtModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
