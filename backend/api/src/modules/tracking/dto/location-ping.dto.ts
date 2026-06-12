import { IsNumber, IsString, IsOptional, Min, Max } from 'class-validator';

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

  @IsString()
  deviceTs!: string;

  @IsNumber()
  sequence!: number;
}
