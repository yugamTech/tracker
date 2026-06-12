import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PersonsService } from '../persons.service';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';

@ApiTags('persons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.personsService.list(tenantId);
  }
}
