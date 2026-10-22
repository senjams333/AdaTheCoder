import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminGuard, AuthGuard } from './guards';

@Global()
@Module({
  imports: [
    MailModule,
    JwtModule.registerAsync({
      global: true,
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
  providers: [AuthService, AuthGuard, AdminGuard],
  exports: [AuthService, AuthGuard, AdminGuard, JwtModule],
})
export class AuthModule {}
