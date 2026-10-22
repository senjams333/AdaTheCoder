import { CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities';

/** Lets a request through only with "Authorization: Bearer <token>" of an active account. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, @InjectRepository(User) private readonly users: Repository<User>) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const [kind, token] = String(req.headers.authorization || '').split(' ');
    if (kind !== 'Bearer' || !token) throw new UnauthorizedException('Please log in first.');
    let payload: { sub: number };
    try {
      payload = this.jwt.verify(token);
    } catch {
      throw new UnauthorizedException('Your log-in has expired. Please log in again.');
    }
    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException('This account is turned off or no longer exists.');
    req.user = user;
    return this.allowed(user);
  }

  protected allowed(_user: User): boolean {
    return true;
  }
}

/** Only admins. */
@Injectable()
export class AdminGuard extends AuthGuard {
  protected allowed(user: User): boolean {
    if (user.role !== 'admin') throw new ForbiddenException("That account isn't an admin account.");
    return true;
  }
}

/** The logged-in account, in a controller: someMethod(@CurrentUser() user: User) */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): User => ctx.switchToHttp().getRequest().user);
