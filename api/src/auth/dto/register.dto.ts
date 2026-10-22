import { Transform, Type } from 'class-transformer';
import { Equals, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** POST /api/auth/register */
export class RegisterDto {
  @Transform(trim)
  @IsString({ message: 'Enter your name.' })
  @IsNotEmpty({ message: 'Enter your name.' })
  @MaxLength(80, { message: 'Your name can be at most 80 characters.' })
  name!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(190, { message: 'That email address is too long.' })
  email!: string;

  @IsString({ message: 'Choose a password with at least 8 characters.' })
  @MinLength(8, { message: 'Choose a password with at least 8 characters.' })
  @MaxLength(72, { message: 'Choose a password of at most 72 characters.' })
  password!: string;

  @IsOptional()
  @IsString()
  password2?: string;

  @Transform(trim)
  @IsString({ message: 'Enter your city.' })
  @IsNotEmpty({ message: 'Enter your city.' })
  @MaxLength(80)
  city!: string;

  @Transform(trim)
  @IsString({ message: 'Enter your country.' })
  @IsNotEmpty({ message: 'Enter your country.' })
  @MaxLength(80)
  country!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  childName?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @Type(() => Number)
  @IsInt({ message: "Choose your child's age from the list." })
  @Min(4, { message: "Choose your child's age from the list." })
  @Max(14, { message: "Choose your child's age from the list." })
  childAge?: number;

  @Transform(({ value }) => value === true || value === 'true' || value === '1' || value === 1 || value === 'on')
  @Equals(true, { message: 'Tick the box to confirm you are the parent or guardian.' })
  consent!: boolean;
}
