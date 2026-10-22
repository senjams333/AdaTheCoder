/**
 * Theme packs from the command line (uses the database settings in .env).
 *
 *   npm run theme -- check  ../themes/space              check a pack, change nothing
 *   npm run theme -- import ../themes/space              add or update the theme and its lessons
 *   npm run theme -- import ../themes/space --remove-missing   also delete lessons the pack no longer lists
 *   npm run theme -- import-all ../themes                every pack in that folder
 *   npm run theme -- export friends ../themes/friends    write an existing theme out as a pack
 *
 * On a server without the dev tools: npm run build, then  node dist/cli/theme-pack.js import ../themes/space
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { AppModule } from '../app.module';
import { describe, PackError, ThemePackService } from '../packs/theme-pack.service';

const USAGE = `Usage:
  npm run theme -- check  <pack folder>
  npm run theme -- import <pack folder> [--remove-missing]
  npm run theme -- import-all <folder of packs> [--remove-missing]
  npm run theme -- export <theme slug> <new pack folder>`;

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const removeMissing = args.includes('--remove-missing');
  const [command, a, b] = args.filter((x) => !x.startsWith('--'));
  if (!command || !a || (command === 'export' && !b)) {
    console.log(USAGE);
    return 1;
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const packs = app.get(ThemePackService);
  try {
    if (command === 'check') {
      const { pack, problems } = packs.check(a);
      if (problems.length) {
        console.log(`✗ ${a} has ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);
        return 1;
      }
      console.log(`✓ ${pack.slug}: "${pack.name}" with ${pack.lessons.length} lessons looks good.`);
    } else if (command === 'import') {
      console.log(`✓ ${describe(await packs.importPack(a, { removeMissing }))}`);
      console.log('Installed apps get it the next time they check (within 3 minutes).');
    } else if (command === 'import-all') {
      const dirs = readdirSync(resolve(a), { withFileTypes: true })
        .filter((d) => d.isDirectory() && existsSync(join(resolve(a), d.name, 'theme.json')))
        .map((d) => join(resolve(a), d.name));
      if (!dirs.length) console.log(`No packs (folders with theme.json) in ${a}`);
      for (const d of dirs) console.log(`✓ ${describe(await packs.importPack(d, { removeMissing }))}`);
    } else if (command === 'export') {
      console.log(`✓ Wrote "${a}" to ${await packs.exportPack(a, b)}`);
    } else {
      console.log(USAGE);
      return 1;
    }
    return 0;
  } catch (err) {
    console.error(err instanceof PackError ? `✗ ${err.message}` : err);
    return 1;
  } finally {
    await app.close();
  }
}

main().then((code) => process.exit(code));
