import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [JwtModule],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
