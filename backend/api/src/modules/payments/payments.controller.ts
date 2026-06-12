import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InvoicesService } from './invoices.service';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get('invoices')
  listInvoices(@TenantId() tenantId: string) {
    return this.invoicesService.getByTenant(tenantId);
  }

  @Get('invoices/:id')
  getInvoice(@Param('id') id: string) {
    return this.invoicesService.getById(id);
  }
}
