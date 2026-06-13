import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FcmAdapter } from './fcm.adapter';

// PrismaModule and RedisModule are @Global(), so they need no explicit import.
@Module({
  imports: [JwtModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, FcmAdapter],
  exports: [NotificationsService],
})
export class NotificationsModule {}
