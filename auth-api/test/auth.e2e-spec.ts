/** End-to-end tests: the real API with an in-memory database (sql.js) and emails captured, not sent.
 *  Run: npm run test:e2e */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { validationErrors } from '../src/common/validation';
import { MailService } from '../src/mail/mail.service';

describe('Auth API', () => {
  let app: INestApplication;
  const sent: { to: string; subject: string }[] = [];

  beforeAll(async () => {
    process.env.DB_TYPE = 'sqljs';
    process.env.JWT_SECRET = 'test-secret';
    process.env.ADMIN_NOTIFY_EMAIL = 'admin@example.com';
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({
        async sendAccountCreated(u: { email: string; name: string }) {
          sent.push({ to: u.email, subject: 'welcome' }, { to: 'admin@example.com', subject: 'new account' });
          return { user: true, admin: true };
        },
      })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, exceptionFactory: validationErrors }));
    await app.init();
  });

  afterAll(() => app.close());

  const parent = {
    name: 'Priya Sharma', email: 'Priya@Example.com', password: 'goodpass1',
    city: 'Imphal', country: 'India', childName: 'Mira', childAge: '8', consent: true,
  };

  it('registers a parent and emails the parent and the admin', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/register').send(parent).expect(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.user).toMatchObject({ email: 'priya@example.com', name: 'Priya Sharma', childAge: 8, role: 'parent' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(typeof res.body.token).toBe('string');
    expect(sent.map((s) => s.to)).toEqual(['priya@example.com', 'admin@example.com']);
  });

  it('refuses the same email twice', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/register').send(parent).expect(409);
    expect(res.body.message).toMatch(/already exists/);
  });

  it('explains every mistake', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: ' ', email: 'nope', password: 'short', city: '', country: '', childAge: 30, consent: false })
      .expect(400);
    for (const m of ['Enter your name.', 'Enter a valid email address.', 'at least 8 characters', 'Enter your city.',
      'Enter your country.', "child's age", 'parent or guardian']) {
      expect(res.body.message.join(' ')).toContain(m);
    }
  });

  it('logs in, and the token opens /me', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/login')
      .send({ email: 'priya@example.com', password: 'goodpass1' }).expect(200);
    const me = await request(app.getHttpServer()).get('/api/auth/me')
      .set('Authorization', `Bearer ${res.body.token}`).expect(200);
    expect(me.body.user.email).toBe('priya@example.com');
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('refuses a wrong password', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/login')
      .send({ email: 'priya@example.com', password: 'wrong-pass' }).expect(401);
    expect(res.body.message).toMatch(/don't match/);
  });

  it('changes the password and deletes the account', async () => {
    await request(app.getHttpServer()).post('/api/auth/change-password')
      .send({ email: 'priya@example.com', currentPassword: 'goodpass1', newPassword: 'newpass123' }).expect(200);
    await request(app.getHttpServer()).post('/api/auth/login')
      .send({ email: 'priya@example.com', password: 'newpass123' }).expect(200);
    await request(app.getHttpServer()).post('/api/auth/delete-account')
      .send({ email: 'priya@example.com', password: 'newpass123' }).expect(200);
    await request(app.getHttpServer()).post('/api/auth/login')
      .send({ email: 'priya@example.com', password: 'newpass123' }).expect(401);
  });

  it('reports health', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body).toEqual({ ok: true, database: 'up' });
  });
});
