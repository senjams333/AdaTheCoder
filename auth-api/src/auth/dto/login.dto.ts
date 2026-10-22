import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

const email = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

/** POST /api/auth/login */
export class LoginDto {
  @Transform(email)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email!: string;

  @IsString({ message: 'Enter your password.' })
  @IsNotEmpty({ message: 'Enter your password.' })
  password!: string;
}

/** POST /api/auth/change-password */
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
