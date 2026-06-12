import {
  IsNumber,
  IsString,
  IsOptional,
  Min,
  Max,
  ValidateNested,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LocationPingDto {
  @IsString()
  tripId!: string;

  @IsNumber()
  @Min(-90) @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180) @Max(180)
  lng!: number;

  @IsNumber()
  @Min(0)
  accuracy!: number;

  @IsOptional()
  @IsNumber()
  speed?: number;

  /** Device-side timestamp (ISO 8601). Reconciled against server clock on ingest. */
  @IsString()
  deviceTs!: string;

  /** Monotonic per-trip counter from the device — used for dedup + ordering. */
  @IsNumber()
  sequence!: number;
}

/**
 * Batch payload from the driver app / simulator. A flush of the device's
 * offline buffer can contain many pings spanning the same trip.
 */
export class LocationPingBatchDto {
  @ValidateNested({ each: true })
  @Type(() => LocationPingDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  pings!: LocationPingDto[];
}
