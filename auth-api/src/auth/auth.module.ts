import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { MailModule } from '../mail/mail.module';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtGuard } from './jwt.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    MailModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        let secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          secret = randomBytes(32).toString('hex');
          Logger.warn('JWT_SECRET is not set: using a random one (log-ins end when the API restarts).', 'Auth');
        }
        return { secret, signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d') } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, UsersService, JwtGuard],
})
export class AuthModule {}
