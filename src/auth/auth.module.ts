import { Global, Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { JwtService } from './jwt.service';
import { PasswordService } from './password.service';

@Global()
@Module({
  imports: [UserModule],
  controllers: [AuthController],
  providers: [PasswordService, JwtService],
  exports: [PasswordService, JwtService],
})
export class AuthModule {}
