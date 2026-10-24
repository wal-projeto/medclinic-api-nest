import { Global, Module } from '@nestjs/common';
import { PasswordService } from './password.service';
import { JwtService } from './jwt.service';

@Global()
@Module({
  providers: [PasswordService, JwtService],
  exports: [PasswordService, JwtService],
})
export class AuthModule {}
