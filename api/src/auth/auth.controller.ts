import { Body, Controller, Get, HttpCode, Ip, Post, UseGuards } from '@nestjs/common';
import { publicUser, User } from '../entities/user.entity';
import { AuthService } from './auth.service';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, ResetPasswordDto, SetupAdminDto, VerifyEmailDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthGuard, CurrentUser } from './guards';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Sign-up step 1: emails the parent a link and a 6-digit code. The account isn't made yet. */
  @Post('register')
  register(@Body() dto: RegisterDto, @Ip() ip: string) {
    return this.auth.startSignup(dto, ip);
  }

  /** Sign-up step 2 (the page the emailed link opens): the code makes the account, logs the parent in,
   *  and emails a welcome to the parent and a notice to the admin. */
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.finishSignup(dto);
  }

  /** Parents and admins. The answer's user.role says which. */
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.auth.login(dto, ip);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: User) {
    return { ok: true, user: publicUser(user) };
  }

  /** Does this new website still need its first admin account? */
  @Get('setup')
  async setupNeeded() {
    return { needed: !(await this.auth.adminExists()) };
  }

  @Post('setup')
  setup(@Body() dto: SetupAdminDto) {
    return this.auth.setupAdmin(dto);
  }

  /** "Forgot your password?": emails a link to choose a new one. The same answer whether or not the
   *  email has an account, so nobody can use it to find out who has one. */
  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto, @Ip() ip: string) {
    return this.auth.forgotPassword(dto.email, ip);
  }

  /** The new password, from the page the emailed link opens. Works for the website and the app. */
  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  /** For other services that only know the email (the logged-in website uses /account/password). */
  @Post('change-password')
  @HttpCode(200)
  changePassword(@Body() dto: ChangePasswordDto) {
    return this.auth.changePasswordByEmail(dto);
  }
}
