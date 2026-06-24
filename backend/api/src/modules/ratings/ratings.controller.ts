import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsInt, IsBoolean, IsOptional, IsString, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { ActiveMembershipDec } from '../../common/decorators/active-membership.decorator';
import type { ActiveMembership } from '@yaanam/types';
import { RatingsService } from './ratings.service';

class SubmitResolutionRatingDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  // Explicit yes/no — drives close vs reopen+escalate (not inferred from stars).
  @IsBoolean() satisfied!: boolean;
  @IsOptional() @IsString() comment?: string;
}

@ApiTags('ratings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  // The parent's satisfaction step for a RESOLVED complaint. The service enforces
  // that the caller is the complaint's raiser and that it is awaiting a rating.
  @Post('resolution/:complaintId')
  submitResolution(
    @Param('complaintId') complaintId: string,
    @Body() dto: SubmitResolutionRatingDto,
    @TenantId() tenantId: string,
    @ActiveMembershipDec() membership: ActiveMembership,
  ) {
    return this.ratings.submitResolutionRating({
      complaintId,
      tenantId,
      personId: membership.personId,
      rating: dto.rating,
      satisfied: dto.satisfied,
      comment: dto.comment,
    });
  }
}
