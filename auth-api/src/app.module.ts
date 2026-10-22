import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';
import { User } from './users/user.entity';

/** MySQL (database admin_db) normally. Tests set DB_TYPE=sqljs to run with an in-memory database. */
export function databaseOptions(config: ConfigService): TypeOrmModuleOptions {
  const sync = (config.get<string>('DB_SYNC') ?? 'true') === 'true';
  if (config.get<string>('DB_TYPE') === 'sqljs') {
    return { type: 'sqljs', entities: [User], synchronize: true, autoSave: false };
  }
  return {
    type: 'mysql',
    host: config.get<string>('DB_HOST', '127.0.0.1'),
    port: Number(config.get<string>('DB_PORT', '3306')),
    username: config.get<string>('DB_USER', 'Admin'),
    password: config.get<string>('DB_PASSWORD', ''),
    database: config.get<string>('DB_NAME', 'admin_db'),
    entities: [User],
    synchronize: sync, // creates/updates the users table; set DB_SYNC=false once you use migrations
    charset: 'utf8mb4',
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: databaseOptions }),
    AuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
