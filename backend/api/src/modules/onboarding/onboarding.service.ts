import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import {
  ENTITY_TEMPLATES,
  ENTITY_TYPES,
  buildTemplateWorkbook,
  parseWorkbook,
  type ImportEntityType,
} from './onboarding.templates';
import { IMPORTERS, type RowError } from './onboarding.importers';

export interface ValidationResult {
  type: ImportEntityType;
  totalRows: number;
  willCreate: number;
  willUpdate: number;
  errors: RowError[];
}

export interface CommitResult extends ValidationResult {
  batchId: string;
  status: 'COMMITTED' | 'FAILED';
  createdCount: number;
  updatedCount: number;
  errorCount: number;
}

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Column metadata for every entity type — drives the UI's template picker. */
  listTemplates() {
    return ENTITY_TYPES.map((type) => ENTITY_TEMPLATES[type]);
  }

  assertType(type: string): ImportEntityType {
    if (!ENTITY_TYPES.includes(type as ImportEntityType)) {
      throw new BadRequestException(`Unknown import type "${type}". Expected one of ${ENTITY_TYPES.join(', ')}`);
    }
    return type as ImportEntityType;
  }

  generateTemplate(type: ImportEntityType): Promise<Buffer> {
    return buildTemplateWorkbook(type);
  }

  /** Dry-run (FR-17/FR-18): parse + validate, write NOTHING. */
  async validate(type: ImportEntityType, tenantId: string, createdById: string, file: Buffer): Promise<ValidationResult> {
    const rows = await this.parseOrThrow(type, file);
    const plan = await IMPORTERS[type](this.prisma, { tenantId, createdById }, rows);
    return {
      type,
      totalRows: rows.length,
      willCreate: plan.willCreate,
      willUpdate: plan.willUpdate,
      errors: plan.errors,
    };
  }

  /**
   * Commit (FR-20): apply every valid row inside ONE transaction, then record an
   * ImportBatch — both atomic, so an unexpected mid-batch DB error rolls back the
   * whole import and the audit row. Rows with validation errors are reported but
   * skipped (the dry-run already surfaced them for the admin to fix). On failure
   * we best-effort record a FAILED batch for the audit trail and rethrow.
   */
  async commit(type: ImportEntityType, tenantId: string, createdById: string, file: Buffer): Promise<CommitResult> {
    const rows = await this.parseOrThrow(type, file);
    const plan = await IMPORTERS[type](this.prisma, { tenantId, createdById }, rows);
    const errorCount = plan.errors.length;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const { created, updated } = await plan.apply(tx);
        const batch = await tx.importBatch.create({
          data: {
            tenantId,
            entityType: type,
            status: 'COMMITTED',
            createdById,
            createdCount: created,
            updatedCount: updated,
            errorCount,
            errorReport: errorCount ? (plan.errors as unknown as object) : undefined,
          },
        });
        return { batch, created, updated };
      });

      return {
        type,
        batchId: result.batch.id,
        status: 'COMMITTED',
        totalRows: rows.length,
        willCreate: plan.willCreate,
        willUpdate: plan.willUpdate,
        createdCount: result.created,
        updatedCount: result.updated,
        errorCount,
        errors: plan.errors,
      };
    } catch (err) {
      // Audit the failure (best-effort, outside the rolled-back tx) then surface it.
      const failed = await this.prisma.importBatch.create({
        data: {
          tenantId,
          entityType: type,
          status: 'FAILED',
          createdById,
          errorCount: errorCount || 1,
          errorReport: {
            errors: plan.errors,
            fatal: err instanceof Error ? err.message : String(err),
          } as unknown as object,
        },
      }).catch(() => null);
      throw new BadRequestException({
        message: 'Import failed and was rolled back — no changes were saved.',
        batchId: failed?.id,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async parseOrThrow(type: ImportEntityType, file: Buffer): Promise<{ rowNumber: number; values: Record<string, string> }[]> {
    try {
      const rows = await parseWorkbook(type, file);
      if (rows.length === 0) throw new BadRequestException('The uploaded file has no data rows.');
      return rows;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Could not read the uploaded file — please upload the .xlsx template.');
    }
  }
}
