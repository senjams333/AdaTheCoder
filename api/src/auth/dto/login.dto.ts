import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const email = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** POST /api/auth/login */
export class LoginDto {
  @Transform(email)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email!: string;

  @IsString({ message: 'Enter your password.' })
  @IsNotEmpty({ message: 'Enter your password.' })
  password!: string;
}

/** POST /api/auth/change-password (by email, for other services) */
export class ChangePasswordDto {
  @Transform(email)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Enter your current password.' })
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: 'Choose a new password with at least 8 characters.' })
  @MaxLength(72, { message: 'Choose a new password of at most 72 characters.' })
  newPassword!: string;
}

/** POST /api/auth/setup: the first admin account of a new website */
export class SetupAdminDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Type your name.' })
  @MaxLength(80)
  name!: string;

  @Transform(email)
  @IsEmail({}, { message: 'Type a real email address.' })
  email!: string;

  @IsString()
  @MinLength(10, { message: 'Choose a password with at least 10 characters.' })
  @MaxLength(72)
  password!: string;

  @IsOptional()
  @IsString()
  password2?: string;
}
