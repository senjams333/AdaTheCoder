import { Body, Controller, Get, HttpCode, Ip, Post, UseGuards } from '@nestjs/common';
import { publicUser, User } from '../entities/user.entity';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, SetupAdminDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthGuard, CurrentUser } from './guards';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Creates a parent account, then emails a welcome to the parent and a notice to the admin. */
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
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

  /** For other services that only know the email (the logged-in website uses /account/password). */
  @Post('change-password')
  @HttpCode(200)
  changePassword(@Body() dto: ChangePasswordDto) {
    return this.auth.changePasswordByEmail(dto);
  }
}
