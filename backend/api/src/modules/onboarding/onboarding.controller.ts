import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { PersonId } from '../../common/decorators/person-id.decorator';
import { Role } from '@yaanam/types';
import { OnboardingService } from './onboarding.service';

// Minimal shape of a multer memory-storage file (avoids a @types/multer dep).
interface UploadedExcel {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

@ApiTags('onboarding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  /** Column metadata for every entity type (drives the UI template picker). */
  @Get('templates')
  templates() {
    return this.onboarding.listTemplates();
  }

  /** Download the fixed-format .xlsx template for an entity type (FR-16). */
  @Get('template')
  async template(@Query('type') type: string, @Res() res: Response) {
    const entity = this.onboarding.assertType(type);
    const buffer = await this.onboarding.generateTemplate(entity);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${entity}-template.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer); // bypasses ResponseInterceptor (binary, not JSON)
  }

  /** Dry-run: validate the upload, return counts + per-row errors, write nothing. */
  @Post('validate')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  validate(
    @Query('type') type: string,
    @TenantId() tenantId: string,
    @PersonId() personId: string,
    @UploadedFile() file: UploadedExcel,
  ) {
    const entity = this.onboarding.assertType(type);
    if (!file?.buffer) throw new BadRequestException('No file uploaded (field name must be "file").');
    return this.onboarding.validate(entity, tenantId, personId, file.buffer);
  }

  /** Commit: apply the upload atomically and record an ImportBatch (FR-20). */
  @Post('commit')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  commit(
    @Query('type') type: string,
    @TenantId() tenantId: string,
    @PersonId() personId: string,
    @UploadedFile() file: UploadedExcel,
  ) {
    const entity = this.onboarding.assertType(type);
    if (!file?.buffer) throw new BadRequestException('No file uploaded (field name must be "file").');
    return this.onboarding.commit(entity, tenantId, personId, file.buffer);
  }
}
