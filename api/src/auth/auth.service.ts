import {
  BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { publicUser, User } from '../entities/user.entity';
import { MailService } from '../mail/mail.service';
import { ChangePasswordDto, LoginDto, SetupAdminDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const MAX_FAILS = 8;
const WINDOW_MS = 15 * 60 * 1000;
export const WRONG_LOGIN = "That email and password don't match. Check them and try again.";
export const TAKEN = 'An account with this email already exists. Log in instead.';

@Injectable()
export class AuthService {
  /** Failed log-ins per email and per address, to slow down password guessing. */
  private readonly fails = new Map<string, number[]>();
  /** Compared against when the email is unknown, so a wrong email takes as long as a wrong password. */
  private readonly dummyHash = bcrypt.hashSync('no account has this password', 12);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: email.trim().toLowerCase() } });
  }

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async register(dto: RegisterDto) {
    if (dto.password2 !== undefined && dto.password2 !== dto.password) {
      throw new BadRequestException(["The two passwords don't match."]);
    }
    if (await this.findByEmail(dto.email)) throw new ConflictException(TAKEN);
    let user: User;
    try {
      user = await this.users.save(this.users.create({
        name: dto.name, email: dto.email, passwordHash: await this.hash(dto.password), role: 'parent',
        city: dto.city, country: dto.country, childName: dto.childName || null, childAge: dto.childAge ?? null,
        plan: 'free', isActive: true, lastLogin: new Date(),
      }));
    } catch (err) {
      // two sign-ups with the same email at the same moment: the database's unique index wins
      if (/duplicate|unique/i.test(String((err as Error).message))) throw new ConflictException(TAKEN);
      throw err;
    }
    const emails = await this.mail.sendAccountCreated(user);
    return { ok: true, user: publicUser(user), token: this.token(user), emails };
  }

  /** Checks an email and password. Throws with a friendly message when they don't match. */
  async login(dto: LoginDto, address = 'unknown') {
    const keys = [`email:${dto.email}`, `ip:${address}`];
    if (keys.some((k) => this.tooMany(k))) {
      throw new HttpException('Too many tries. Wait 15 minutes, then try again.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const user = await this.check(dto.email, dto.password);
    if (!user) {
      keys.forEach((k) => this.fail(k));
      throw new UnauthorizedException(WRONG_LOGIN);
    }
    if (!user.isActive) throw new ForbiddenException('This account is turned off. Contact us to turn it back on.');
    user.lastLogin = new Date();
    await this.users.save(user);
    return { ok: true, user: publicUser(user), token: this.token(user) };
  }

  async adminExists(): Promise<boolean> {
    return (await this.users.count({ where: { role: 'admin' } })) > 0;
  }

  /** The first admin of a new website. Works only while there is no admin. */
  async setupAdmin(dto: SetupAdminDto) {
    if (await this.adminExists()) throw new ForbiddenException('The admin account already exists. Log in instead.');
    if (dto.password2 !== undefined && dto.password2 !== dto.password) {
      throw new BadRequestException(['The two passwords are different.']);
    }
    if (await this.findByEmail(dto.email)) {
      throw new ConflictException('A parent account already uses that email. Use a different email for the admin.');
    }
    const user = await this.users.save(this.users.create({
      name: dto.name, email: dto.email, passwordHash: await this.hash(dto.password), role: 'admin',
      city: '', country: '', childName: null, childAge: null, plan: 'free', isActive: true, lastLogin: new Date(),
    }));
    return { ok: true, user: publicUser(user), token: this.token(user) };
  }

  async changePassword(user: User, current: string, next: string) {
    if (!(await bcrypt.compare(current, user.passwordHash))) throw new UnauthorizedException("Your current password isn't right.");
    if (!next || next.length < 8) throw new BadRequestException(['Choose a new password with at least 8 characters.']);
    user.passwordHash = await this.hash(next);
    await this.users.save(user);
    return { ok: true };
  }

  async changePasswordByEmail(dto: ChangePasswordDto) {
    const user = await this.check(dto.email, dto.currentPassword);
    if (!user) throw new UnauthorizedException("Your current password isn't right.");
    return this.changePassword(user, dto.currentPassword, dto.newPassword);
  }

  async deleteAccount(user: User, password: string) {
    if (user.role === 'admin') throw new ForbiddenException("Admin accounts can't be deleted here.");
    if (!(await bcrypt.compare(password || '', user.passwordHash))) {
      throw new UnauthorizedException("Your password isn't right, so the account was not deleted.");
    }
    await this.users.remove(user);
    return { ok: true };
  }

  async check(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user) {
      await bcrypt.compare(password, this.dummyHash);
      return null;
    }
    return (await bcrypt.compare(password, user.passwordHash)) ? user : null;
  }

  token(user: User): string {
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
