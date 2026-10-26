import { Controller, Get } from '@nestjs/common';
import { GetAuthUser } from '../auth/decorator/get-auth-user.decorator';
import type { AuthUser } from '../auth/jwt.service';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  me(@GetAuthUser() authUser: AuthUser) {
    return this.userService.me(authUser.id);
  }
}
