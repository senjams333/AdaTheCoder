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
    let payload: { sub: number; purpose?: string };
    try {
      payload = this.jwt.verify(token);
    } catch {
      throw new UnauthorizedException('Your log-in has expired. Please log in again.');
    }
    // password-reset links carry a token too: it only resets a password, it never logs anyone in
    if (payload.purpose) throw new UnauthorizedException('Please log in first.');
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

/** The token a guard accepts besides a normal log-in: "app" (the desktop app's own, long-lived) or "pay"
 *  (a 15-minute link the app opens to pay for a theme). Neither ever opens the website account. */
async function userFrom(jwt: JwtService, users: Repository<User>, req: any, accept: (purpose?: string) => boolean): Promise<User> {
  const [kind, token] = String(req.headers.authorization || '').split(' ');
  if (kind !== 'Bearer' || !token) throw new UnauthorizedException('Please log in first.');
  let payload: { sub: number; purpose?: string };
  try {
    payload = jwt.verify(token);
  } catch {
    throw new UnauthorizedException('Your log-in has expired. Please log in again.');
  }
  if (!accept(payload.purpose)) throw new UnauthorizedException('Please log in first.');
  const user = await users.findOne({ where: { id: payload.sub } });
  if (!user || !user.isActive) throw new UnauthorizedException('This account is turned off or no longer exists.');
  req.user = user;
  req.tokenPurpose = payload.purpose || '';
  req.token = token;
  return user;
}

/** The desktop app, with the token it got when the parent logged in there. */
@Injectable()
export class AppTokenGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, @InjectRepository(User) private readonly users: Repository<User>) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    await userFrom(this.jwt, this.users, ctx.switchToHttp().getRequest(), (p) => p === 'app');
    return true;
  }
}

/** The app's theme list: works without a log-in; with the app's token, the themes the family bought come in full. */
@Injectable()
export class OptionalAppTokenGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, @InjectRepository(User) private readonly users: Repository<User>) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    if (req.headers.authorization) await userFrom(this.jwt, this.users, req, (p) => p === 'app').catch(() => undefined);
    return true;
  }
}

/** Paying for a theme: a website log-in, or the pay link the app opened. */
@Injectable()
export class PayGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, @InjectRepository(User) private readonly users: Repository<User>) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    await userFrom(this.jwt, this.users, ctx.switchToHttp().getRequest(), (p) => !p || p === 'pay');
    return true;
  }
}
