import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/** Lets a request through only with "Authorization: Bearer <token from login or register>". */
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const [kind, token] = String(req.headers.authorization || '').split(' ');
    if (kind !== 'Bearer' || !token) throw new UnauthorizedException('Log in first.');
    try {
      req.user = this.jwt.verify(token);
      return true;
    } catch {
      throw new UnauthorizedException('Your log-in has expired. Log in again.');
    }
  }
}
