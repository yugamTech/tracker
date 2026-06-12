import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { StudentsService } from '../students.service';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';
import { IsString, IsOptional } from 'class-validator';

class CreateStudentDto {
  @IsString() name!: string;
  @IsOptional() @IsString() regId?: string;
  @IsString() ageGroupId!: string;
  @IsOptional() @IsString() routeId?: string;
  @IsOptional() @IsString() stopId?: string;
}

@ApiTags('students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.studentsService.list(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.studentsService.findById(id);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateStudentDto) {
    return this.studentsService.create({ tenantId, ...dto });
  }
}
