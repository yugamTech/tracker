import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FcmAdapter } from './fcm.adapter';
import { StructuredMessagesController } from './structured-messages.controller';
import { StructuredMessagesService } from './structured-messages.service';

// PrismaModule and RedisModule are @Global(), so they need no explicit import.
@Module({
  imports: [JwtModule],
  controllers: [NotificationsController, StructuredMessagesController],
  providers: [NotificationsService, FcmAdapter, StructuredMessagesService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
