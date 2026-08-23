import { IsEmail } from 'class-validator';

export class AddOrgAdminDto {
  @IsEmail()
  email: string;
}
