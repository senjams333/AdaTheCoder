/** End-to-end tests: the whole API with an in-memory database (sql.js) and emails captured, not sent.
 *  Run: npm run test:e2e */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { validationErrors } from '../src/common/validation';
import { MailService } from '../src/mail/mail.service';
import { ThemePackService } from '../src/packs/theme-pack.service';

describe('Ada The Coder API', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  const sent: string[] = [];
  let admin = '';
  let parent = '';

  beforeAll(async () => {
    // in-memory database unless TEST_DB=mysql (then DB_HOST, DB_NAME... from the environment)
    if (process.env.TEST_DB !== 'mysql') process.env.DB_TYPE = 'sqljs';
    process.env.JWT_SECRET = 'test-secret';
    process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'ada-uploads-'));
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({ async sendAccountCreated(u: { email: string }) { sent.push(u.email, 'admin'); return { user: true, admin: true }; } })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, exceptionFactory: validationErrors }));
    await app.init();
    http = app.getHttpServer();
  });

  afterAll(() => app.close());

  it('starts with the website text and 3 themes of 17 lessons', async () => {
    const site = await request(http).get('/api/site').expect(200);
    expect(site.body.settings.hero_title).toContain('first lines of real code');
    expect(site.body.themes.map((t: { slug: string }) => t.slug)).toEqual(['friends', 'fairies', 'coding_club']);
    expect(site.body.lessons).toHaveLength(17);
    const v3 = await request(http).get('/api/v3/courses').expect(200);
    expect(v3.body.courses).toHaveLength(3);
    expect(v3.body.courses[0].lessons).toHaveLength(17);
    expect(v3.body.courses[0].buy_url).toContain('/account?theme=friends');
    await request(http).get(`/api/v3/courses?since=${v3.body.revision}`).expect(200, { revision: v3.body.revision, unchanged: true });
  });

  it('creates the first admin once', async () => {
    expect((await request(http).get('/api/auth/setup')).body).toEqual({ needed: true });
    const bad = await request(http).post('/api/auth/setup').send({ name: 'Sen', email: 'boss@example.com', password: 'short' }).expect(400);
    expect(bad.body.message.join(' ')).toContain('10 characters');
    const ok = await request(http).post('/api/auth/setup').send({ name: 'Sen', email: 'boss@example.com', password: 'a-long-password' }).expect(201);
    admin = ok.body.token;
    expect(ok.body.user.role).toBe('admin');
    expect((await request(http).get('/api/auth/setup')).body).toEqual({ needed: false });
    await request(http).post('/api/auth/setup').send({ name: 'X', email: 'x@example.com', password: 'a-long-password' }).expect(403);
  });

  it('registers a parent (website) and emails parent and admin', async () => {
    const res = await request(http).post('/api/auth/register').send({
      name: 'Priya Sharma', email: 'Priya@Example.com', password: 'goodpass1', city: 'Imphal', country: 'India', childAge: '8', consent: true,
    }).expect(201);
    parent = res.body.token;
    expect(res.body.user).toMatchObject({ email: 'priya@example.com', role: 'parent', childAge: 8 });
    expect(sent).toEqual(['priya@example.com', 'admin']);
    await request(http).post('/api/auth/register').send({
      name: 'P', email: 'priya@example.com', password: 'goodpass1', city: 'A', country: 'B', consent: true,
    }).expect(409);
    const bad = await request(http).post('/api/auth/register').send({ email: 'nope', password: 'x', consent: false }).expect(400);
    for (const m of ['Enter your name.', 'valid email', '8 characters', 'Enter your city.', 'parent or guardian']) {
      expect(bad.body.message.join(' ')).toContain(m);
    }
  });

  it('keeps parents out of the admin', async () => {
    await request(http).get('/api/admin/dashboard').expect(401);
    await request(http).get('/api/admin/dashboard').set('Authorization', `Bearer ${parent}`).expect(403);
    const d = await request(http).get('/api/admin/dashboard').set('Authorization', `Bearer ${admin}`).expect(200);
    expect(d.body.stats).toMatchObject({ parents: 1, themes: 3, lessons: 51 });
  });

  it('admin: website text', async () => {
    await request(http).put('/api/admin/settings').set('Authorization', `Bearer ${admin}`)
      .send({ hero_title: 'Code is fun', app_message: 'Hello from admin' }).expect(200);
    expect((await request(http).get('/api/site')).body.settings.hero_title).toBe('Code is fun');
    expect((await request(http).get('/api/v1/announcement')).body).toEqual({ message: 'Hello from admin' });
  });

  it('admin: a new theme with its own characters, lessons inside, free lessons', async () => {
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    const missing = await request(http).post('/api/admin/themes').set('Authorization', `Bearer ${admin}`)
      .field('name', 'Learn Coding in Space').field('slug', 'space').field('pack', 'custom').field('premium', 'true')
      .field('price', '$2.99').field('freeLessons', '3').field('position', '4').field('published', 'true').expect(400);
    expect(missing.body.message).toContain('Upload a picture for character 1.');
    const ok = await request(http).post('/api/admin/themes').set('Authorization', `Bearer ${admin}`)
      .field('name', 'Learn Coding in Space').field('slug', 'space').field('pack', 'custom').field('premium', 'true')
      .field('price', '$2.99').field('freeLessons', '3').field('position', '4').field('published', 'true').field('copyFrom', '1')
      .field('charName0', 'Astro').field('charName1', 'Comet').field('charName2', 'Nova')
      .attach('charFile0', png, 'astro.png').attach('charFile1', png, 'comet.png').attach('charFile2', png, 'nova.png').expect(201);
    expect(ok.body.message).toContain('17 lessons copied');
    const theme = await request(http).get(`/api/admin/themes/${ok.body.id}`).set('Authorization', `Bearer ${admin}`).expect(200);
    expect(theme.body.theme.packLabel).toBe('Astro, Comet & Nova');
    expect(theme.body.lessons).toHaveLength(17);
    const space = (await request(http).get('/api/v3/courses')).body.courses.find((c: { id: string }) => c.id === 'space');
    expect(space).toMatchObject({ free_lessons: 3, premium: true });
    expect(space.characters.map((c: { name: string }) => c.name)).toEqual(['Astro', 'Comet', 'Nova']);

    // edit a lesson topic, then move it up
    const second = theme.body.lessons[1];
    const lesson = (await request(http).get(`/api/admin/lessons/${second.id}`).set('Authorization', `Bearer ${admin}`)).body;
    await request(http).put(`/api/admin/lessons/${second.id}`).set('Authorization', `Bearer ${admin}`)
      .field('courseId', String(lesson.courseId)).field('slug', lesson.slug).field('position', String(lesson.position))
      .field('emoji', '🚀').field('name', 'PRINT IN SPACE').field('title', lesson.title).field('subtitle', '')
      .field('defaultCode', '').field('examples', JSON.stringify(lesson.examples)).field('published', 'true').expect(200);
    await request(http).post(`/api/admin/lessons/${second.id}/move`).set('Authorization', `Bearer ${admin}`).send({ direction: 'up' }).expect(200);
    const after = (await request(http).get('/api/v3/courses')).body.courses.find((c: { id: string }) => c.id === 'space');
    expect(after.lessons[0]).toMatchObject({ emoji: '🚀', name: 'PRINT IN SPACE' });
  });

  it('licences reach the app log-in', async () => {
    const parents = (await request(http).get('/api/admin/parents').set('Authorization', `Bearer ${admin}`)).body;
    const priya = parents.parents[0];
    const space = parents.paidThemes.find((t: { slug: string }) => t.slug === 'space');
    await request(http).put(`/api/admin/parents/${priya.id}/plan`).set('Authorization', `Bearer ${admin}`)
      .send({ plan: 'premium', licences: { [space.id]: 'ADA-SPACE-1' } }).expect(200);
    const login = await request(http).post('/api/v3/login').send({ email: 'priya@example.com', password: 'goodpass1' }).expect(200);
    expect(login.body).toMatchObject({ ok: true, name: 'Priya Sharma', licences: ['space'] });
    const wrong = await request(http).post('/api/v3/login').send({ email: 'priya@example.com', password: 'nope' }).expect(401);
    expect(wrong.body.ok).toBe(false);
    const account = await request(http).get('/api/account').set('Authorization', `Bearer ${parent}`).expect(200);
    expect(account.body.themes.find((t: { slug: string }) => t.slug === 'space').licence).toBe('ADA-SPACE-1');
  });

  it('the app can register too', async () => {
    const r = await request(http).post('/api/v3/register').send({
      name: 'Lina', email: 'lina@example.com', password: 'goodpass1', city: 'Goa', country: 'India', consent: true,
    }).expect(201);
    expect(r.body).toEqual({ ok: true, name: 'Lina', email: 'lina@example.com', licences: [] });
    expect((await request(http).post('/api/v3/register').send({ email: 'x' }).expect(400)).body.ok).toBe(false);
  });

  it('parent: details, password, delete', async () => {
    await request(http).patch('/api/account').set('Authorization', `Bearer ${parent}`)
      .send({ name: 'Priya S', city: 'Pune', country: 'India' }).expect(200);
    await request(http).post('/api/account/password').set('Authorization', `Bearer ${parent}`)
      .send({ current: 'goodpass1', new: 'newpass123' }).expect(200);
    await request(http).post('/api/auth/login').send({ email: 'priya@example.com', password: 'newpass123' }).expect(200);
    await request(http).post('/api/account/delete').set('Authorization', `Bearer ${parent}`).send({ password: 'wrong' }).expect(401);
    await request(http).post('/api/account/delete').set('Authorization', `Bearer ${parent}`).send({ password: 'newpass123' }).expect(200);
    await request(http).get('/api/account').set('Authorization', `Bearer ${parent}`).expect(401);
  });

  it('theme packs: import, re-import, export', async () => {
    const packs = app.get(ThemePackService);
    const pack = join(__dirname, '..', '..', 'themes', 'space');
    expect(packs.check(pack).problems).toEqual([]);
    // an earlier test made a "space" theme in the admin, with 17 copied lessons: the pack replaces them
    const first = await packs.importPack(pack, { removeMissing: true });
    expect(first).toMatchObject({ theme: 'space', created: false, lessonsAdded: 3, lessonsRemoved: 17, filesCopied: 3 });
    const again = await packs.importPack(pack);
    expect(again).toMatchObject({ lessonsAdded: 0, lessonsUpdated: 3, filesCopied: 0 }); // nothing changed: nothing copied
    const space = (await request(http).get('/api/v3/courses')).body.courses.find((c: { id: string }) => c.id === 'space');
    expect(space).toMatchObject({ name: 'Learn Coding in Space', premium: true, free_lessons: 1, pack: 'custom' });
    expect(space.characters.map((c: { name: string }) => c.name)).toEqual(['Astro', 'Comet', 'Nova']);
    expect(space.lessons.map((l: { id: string }) => l.id)).toEqual(['space_hello', 'space_countdown', 'space_planets']);
    expect(space.lessons[1].examples[0].code).toContain('range(5, 0, -1)');

    // export a built-in theme, check it, and import it back under a new name
    const out = mkdtempSync(join(tmpdir(), 'ada-pack-'));
    await packs.exportPack('fairies', out);
    const exported = JSON.parse(readFileSync(join(out, 'theme.json'), 'utf8'));
    expect(exported.lessons).toHaveLength(17);
    exported.slug = 'fairies2';
    exported.name = 'Fairies Again';
    writeFileSync(join(out, 'theme.json'), JSON.stringify(exported));
    expect(packs.check(out).problems).toEqual([]);
    expect(await packs.importPack(out)).toMatchObject({ theme: 'fairies2', created: true, lessonsAdded: 17 });

    // problems are listed, not imported
    exported.lessons[0].examples = [];
    exported.slug = 'bad slug';
    writeFileSync(join(out, 'theme.json'), JSON.stringify(exported));
    const { problems } = packs.check(out);
    expect(problems.join(' ')).toContain('"slug" must use only letters');
    expect(problems.join(' ')).toContain('add at least one example');
    await expect(packs.importPack(out)).rejects.toThrow('has problems');
  });

  it('app update check', async () => {
    await request(http).get('/api/v1/app/latest?platform=windows&version=1.0.0').expect(200, { update_available: false, required: false });
    await request(http).get('/api/v1/app/latest?platform=linux').expect(400);
  });
});
