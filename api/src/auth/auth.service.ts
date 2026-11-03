import {
  BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt } from 'crypto';
import { Repository } from 'typeorm';
import { PendingSignup } from '../entities/pending-signup.entity';
import { publicUser, User } from '../entities/user.entity';
import { MailService } from '../mail/mail.service';
import { ChangePasswordDto, LoginDto, ResetPasswordDto, SetupAdminDto, VerifyEmailDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const MAX_FAILS = 8;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_RESET_EMAILS = 5;
const MAX_CODE_TRIES = 5;
const SIGNUP_MINUTES = 30;
export const SIGNUP_EXPIRED = 'This sign-up link has expired or was already used. Sign up again to get a new email.';
export const WRONG_CODE = "That code isn't right. Check the 6-digit code in the email and try again.";
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
export const RESET_EXPIRED = 'This link has expired or was already used. Ask for a new one on the "Forgot your password?" page.';
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
    @InjectRepository(PendingSignup) private readonly pending: Repository<PendingSignup>,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: email.trim().toLowerCase() } });
  }

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  /** Makes the account straight away (the older desktop app's sign-up, /api/v3/register). */
  async register(dto: RegisterDto) {
    if (dto.password2 !== undefined && dto.password2 !== dto.password) {
      throw new BadRequestException(["The two passwords don't match."]);
    }
    if (await this.findByEmail(dto.email)) throw new ConflictException(TAKEN);
    return this.createParent({
      name: dto.name, email: dto.email, passwordHash: await this.hash(dto.password), city: dto.city,
      country: dto.country, childName: dto.childName || null, childAge: dto.childAge ?? null,
    });
  }

  private async createParent(d: {
    name: string; email: string; passwordHash: string; city: string; country: string; childName: string | null; childAge: number | null;
  }) {
    let user: User;
    try {
      user = await this.users.save(this.users.create({
        ...d, role: 'parent', plan: 'free', isActive: true, lastLogin: new Date(),
      }));
    } catch (err) {
      // two sign-ups with the same email at the same moment: the database's unique index wins
      if (/duplicate|unique/i.test(String((err as Error).message))) throw new ConflictException(TAKEN);
      throw err;
    }
    const emails = await this.mail.sendAccountCreated(user);
    return { ok: true, user: publicUser(user), token: this.token(user), emails };
  }

  /** Website sign-up, step 1: emails a link and a 6-digit code. Nothing is made until the code is typed. */
  async startSignup(dto: RegisterDto, address = 'unknown') {
    if (dto.password2 !== undefined && dto.password2 !== dto.password) {
      throw new BadRequestException(["The two passwords don't match."]);
    }
    const keys = [`signup:${dto.email}`, `signup-ip:${address}`];
    if (keys.some((k) => this.tooMany(k, MAX_RESET_EMAILS))) {
      throw new HttpException('Too many tries. Wait 15 minutes, then try again.', HttpStatus.TOO_MANY_REQUESTS);
    }
    keys.forEach((k) => this.fail(k));
    if (await this.findByEmail(dto.email)) throw new ConflictException(TAKEN);
    const link = randomBytes(24).toString('base64url');
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    await this.pending.delete({ email: dto.email });
    await this.pending.save(this.pending.create({
      email: dto.email, linkHash: sha(link), codeHash: sha(`${code}:${link}`), attempts: 0,
      expiresAt: new Date(Date.now() + SIGNUP_MINUTES * 60 * 1000),
      data: JSON.stringify({
        name: dto.name, passwordHash: await this.hash(dto.password), city: dto.city, country: dto.country,
        childName: dto.childName || null, childAge: dto.childAge ?? null,
      }),
    }));
    const emailed = await this.mail.sendSignupCode({ name: dto.name, email: dto.email }, link, code);
    // DEV_SHOW_CODES=true (tests, or trying it without email): the answer also carries the link's token and code
    const dev = process.env.DEV_SHOW_CODES === 'true' ? { dev: { token: link, code } } : {};
    return { ok: true, pending: true, email: dto.email, emailed, ...dev };
  }

  /** Website sign-up, step 2: the link's token and the code from the email make the account. */
  async finishSignup(dto: VerifyEmailDto) {
    const p = await this.pending.findOne({ where: { linkHash: sha(dto.token) } });
    if (!p || new Date(p.expiresAt).getTime() < Date.now()) throw new BadRequestException([SIGNUP_EXPIRED]);
    if (sha(`${dto.code}:${dto.token}`) !== p.codeHash) {
      p.attempts += 1;
      if (p.attempts >= MAX_CODE_TRIES) {
        await this.pending.remove(p);
        throw new BadRequestException(['Too many wrong codes. Sign up again to get a new email.']);
      }
      await this.pending.save(p);
      throw new BadRequestException([WRONG_CODE]);
    }
    const d = JSON.parse(p.data);
    await this.pending.remove(p);
    if (await this.findByEmail(p.email)) throw new ConflictException(TAKEN);
    return this.createParent({ ...d, email: p.email });
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

  /** Emails a link to choose a new password (valid for 1 hour, once). Answers the same for unknown emails. */
  async forgotPassword(email: string, address = 'unknown') {
    const keys = [`reset:${email}`, `reset-ip:${address}`];
    if (keys.some((k) => this.tooMany(k, MAX_RESET_EMAILS))) {
      throw new HttpException('Too many tries. Wait 15 minutes, then try again.', HttpStatus.TOO_MANY_REQUESTS);
    }
    keys.forEach((k) => this.fail(k));
    const user = await this.findByEmail(email);
    if (user && user.isActive) {
      const code = String(randomInt(0, 1000000)).padStart(6, '0');
      const token = this.jwt.sign({ sub: user.id, purpose: 'reset', ph: this.hashMark(user), ch: sha(`${code}:${user.id}:${this.hashMark(user)}`) },
        { expiresIn: '1h' });
      await this.mail.sendPasswordReset(user, token, code);
    }
    return { ok: true };
  }

  /** Sets the new password from the emailed link. The link stops working once the password changes. */
  async resetPassword(dto: ResetPasswordDto) {
    let payload: { sub?: number; purpose?: string; ph?: string; ch?: string };
    try {
      payload = this.jwt.verify(dto.token);
    } catch {
      throw new BadRequestException([RESET_EXPIRED]);
    }
    if (payload.purpose !== 'reset' || !payload.sub) throw new BadRequestException([RESET_EXPIRED]);
    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user || !user.isActive || payload.ph !== this.hashMark(user)) throw new BadRequestException([RESET_EXPIRED]);
    const tries = `reset-code:${dto.token.slice(-24)}`;
    if (this.tooMany(tries, MAX_CODE_TRIES)) throw new BadRequestException(['Too many wrong codes. Ask for a new email.']);
    if (sha(`${dto.code}:${user.id}:${this.hashMark(user)}`) !== (payload as { ch?: string }).ch) {
      this.fail(tries);
      throw new BadRequestException([WRONG_CODE]);
    }
    if (dto.password2 !== undefined && dto.password2 !== dto.password) {
      throw new BadRequestException(["The two passwords don't match."]);
    }
    user.passwordHash = await this.hash(dto.password);
    await this.users.save(user);
    this.fails.delete(`email:${user.email}`);
    return { ok: true, email: user.email };
  }

  /** A short fingerprint of the current password hash: a reset link is only good until the password changes. */
  private hashMark(user: User): string {
    return createHash('sha256').update(user.passwordHash).digest('hex').slice(0, 16);
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

  /** The desktop app's own token: it only reads the family's licences and opens pay links. */
  appToken(user: { id: number }): string {
    return this.jwt.sign({ sub: user.id, purpose: 'app' }, { expiresIn: '365d' });
  }

  /** A 15-minute link for paying for one theme on the website, opened from the app's Upgrade card. */
  payToken(user: { id: number }): string {
    return this.jwt.sign({ sub: user.id, purpose: 'pay' }, { expiresIn: '15m' });
  }

  private tooMany(key: string, max = MAX_FAILS): boolean {
    const now = Date.now();
    const recent = (this.fails.get(key) || []).filter((t) => now - t < WINDOW_MS);
    this.fails.set(key, recent);
    return recent.length >= max;
  }

  private fail(key: string) {
    this.fails.set(key, [...(this.fails.get(key) || []), Date.now()]);
  }
}
