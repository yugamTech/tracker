import { IsString, IsPhoneNumber } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @IsPhoneNumber('IN')
  phone!: string;
}
