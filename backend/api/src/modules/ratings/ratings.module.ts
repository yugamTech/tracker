import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [JwtModule, NotificationsModule],
  controllers: [RatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
