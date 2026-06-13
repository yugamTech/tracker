import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { StudentsService } from '../students.service';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';
import { PersonId } from '../../../common/decorators/person-id.decorator';
import { IsString, IsOptional } from 'class-validator';

class CreateStudentDto {
  @IsString() name!: string;
  @IsOptional() @IsString() regId?: string;
  @IsString() ageGroupId!: string;
  @IsOptional() @IsString() routeId?: string;
  @IsOptional() @IsString() stopId?: string;
  // Parent linkage — when supplied, the service upserts the parent Person,
  // grants a PARENT membership, and creates the guardianship in one transaction.
  @IsOptional() @IsString() parentName?: string;
  @IsOptional() @IsString() parentPhone?: string;
  @IsOptional() @IsString() relation?: string;
}

class UpdateStudentDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() regId?: string;
  @IsOptional() @IsString() ageGroupId?: string;
  @IsOptional() @IsString() routeId?: string;
  @IsOptional() @IsString() stopId?: string;
  @IsOptional() @IsString() status?: 'ACTIVE' | 'INACTIVE';
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

  @Get('my')
  myStudents(@PersonId() personId: string) {
    return this.studentsService.getByGuardian(personId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.studentsService.findById(id);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateStudentDto) {
    return this.studentsService.create({ tenantId, ...dto });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.studentsService.update(id, dto);
  }
}
