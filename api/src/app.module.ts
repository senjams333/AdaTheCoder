import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AccountController } from './account/account.controller';
import { AdminController } from './admin/admin.controller';
import { AdminLessonsController } from './admin/lessons.controller';
import { AdminParentsController } from './admin/parents.controller';
import { AdminReleasesController } from './admin/releases.controller';
import { AdminThemesController } from './admin/themes.controller';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { SettingsService } from './common/settings.service';
import { AppApiController } from './compat/app-api.controller';
import { ENTITIES } from './entities';
import { HealthController } from './health.controller';
import { SiteController } from './site/site.controller';

/** MySQL (database admin_db) normally. Tests set DB_TYPE=sqljs to run with an in-memory database. */
export function databaseOptions(config: ConfigService): TypeOrmModuleOptions {
  if (config.get<string>('DB_TYPE') === 'sqljs') {
    return { type: 'sqljs', entities: ENTITIES, synchronize: true, autoSave: false };
  }
  return {
    type: 'mysql',
    host: config.get<string>('DB_HOST', '127.0.0.1'),
    port: Number(config.get<string>('DB_PORT', '3306')),
    username: config.get<string>('DB_USER', 'Admin'),
    password: config.get<string>('DB_PASSWORD', ''),
    database: config.get<string>('DB_NAME', 'admin_db'),
    entities: ENTITIES,
    // creates and updates the tables to match the code; set DB_SYNC=false once you use migrations
    synchronize: (config.get<string>('DB_SYNC') ?? 'true') === 'true',
    charset: 'utf8mb4',
  };
}

@Global()
@Module({ providers: [SettingsService], exports: [SettingsService] })
class SettingsModule {}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: databaseOptions }),
    CatalogModule,
    SettingsModule,
    AuthModule,
  ],
  controllers: [
    HealthController, SiteController, AccountController, AppApiController,
    AdminController, AdminThemesController, AdminLessonsController, AdminReleasesController, AdminParentsController,
  ],
})
export class AppModule {}
