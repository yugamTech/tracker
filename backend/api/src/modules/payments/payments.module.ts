import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PaymentsController } from './payments.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [JwtModule],
  controllers: [PaymentsController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class PaymentsModule {}
