import { IsString, IsPhoneNumber, Length, IsOptional, IsArray } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @IsPhoneNumber('IN')
  phone!: string;

  @IsString()
  @Length(4, 8)
  otp!: string;

  /**
   * The roles the calling app serves (e.g. driver app sends ['DRIVER','CONDUCTOR']).
   * Login is admitted only if the number holds a membership in one of these roles,
   * so a parent can't sign into the driver app. Omitted = no role restriction.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedRoles?: string[];
}
