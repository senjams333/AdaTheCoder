import { Body, Controller, Get, HttpCode, Ip, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtGuard } from './jwt.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Creates a parent account, then emails a welcome to the parent and a notice to the admin. */
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.auth.login(dto, ip);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  me(@Req() req: { user: { sub: number } }) {
    return this.auth.me(req.user.sub);
  }

  @Post('change-password')
  @HttpCode(200)
  changePassword(@Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(dto);
  }

  @Post('delete-account')
  @HttpCode(200)
  deleteAccount(@Body() dto: LoginDto) {
    return this.auth.deleteAccount(dto);
  }
}
