import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DriverProfilesController } from './driver-profiles.controller';
import { DriverProfilesService } from './driver-profiles.service';

@Module({
  imports: [JwtModule],
  controllers: [DriverProfilesController],
  providers: [DriverProfilesService],
})
export class DriverProfilesModule {}
