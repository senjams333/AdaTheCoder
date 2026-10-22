import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { MailService } from '../mail/mail.service';
import { publicUser, User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto, LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const MAX_FAILS = 8;
const WINDOW_MS = 15 * 60 * 1000;
const WRONG = "That email and password don't match. Check them and try again.";

@Injectable()
export class AuthService {
  /** Failed log-ins per email and per address, to slow down password guessing. */
  private readonly fails = new Map<string, number[]>();
  /** Compared against when the email is unknown, so a wrong email takes as long as a wrong password. */
  private readonly dummyHash = bcrypt.hashSync('no account has this password', 12);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto) {
    if (dto.password2 !== undefined && dto.password2 !== dto.password) {
      throw new BadRequestException(["The two passwords don't match."]);
    }
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException('An account with this email already exists. Log in instead.');
    }
    let user: User;
    try {
      user = await this.users.create({
        name: dto.name,
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, 12),
        city: dto.city,
        country: dto.country,
        childName: dto.childName || null,
        childAge: dto.childAge ?? null,
        role: 'parent',
      });
    } catch (err) {
      // two sign-ups with the same email at the same moment: the database's unique index wins
      if (/duplicate|unique/i.test(String((err as Error).message))) {
        throw new ConflictException('An account with this email already exists. Log in instead.');
      }
      throw err;
    }
    const emails = await this.mail.sendAccountCreated(user);
    return { ok: true, user: publicUser(user), token: this.token(user), emails };
  }

  async login(dto: LoginDto, address = 'unknown') {
    const keys = [`email:${dto.email}`, `ip:${address}`];
    if (keys.some((k) => this.tooMany(k))) {
      throw new HttpException('Too many tries. Wait 15 minutes, then try again.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const user = await this.check(dto.email, dto.password);
    if (!user) {
      keys.forEach((k) => this.fail(k));
      throw new UnauthorizedException(WRONG);
    }
    return { ok: true, user: publicUser(user), token: this.token(user) };
  }

  async me(userId: number) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('This account no longer exists.');
    return { ok: true, user: publicUser(user) };
  }

  async changePassword(dto: ChangePasswordDto) {
    const user = await this.check(dto.email, dto.currentPassword);
    if (!user) throw new UnauthorizedException('Your current password is wrong.');
    user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.users.save(user);
    return { ok: true };
  }

  async deleteAccount(dto: LoginDto) {
    const user = await this.check(dto.email, dto.password);
    if (!user) throw new UnauthorizedException(WRONG);
    await this.users.remove(user);
    return { ok: true };
  }

  private async check(email: string, password: string): Promise<User | null> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      await bcrypt.compare(password, this.dummyHash);
      return null;
    }
    return (await bcrypt.compare(password, user.passwordHash)) ? user : null;
  }

  private token(user: User): string {
    return this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
  }

  private tooMany(key: string): boolean {
    const now = Date.now();
    const recent = (this.fails.get(key) || []).filter((t) => now - t < WINDOW_MS);
    this.fails.set(key, recent);
    return recent.length >= MAX_FAILS;
  }

  private fail(key: string) {
    this.fails.set(key, [...(this.fails.get(key) || []), Date.now()]);
  }
}
