import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { MembersService } from '../members.service';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';

@ApiTags('members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  list(@TenantId() tenantId: string, @Query('role') role?: string) {
    return this.membersService.list(tenantId, role);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.membersService.findById(id);
  }
}
