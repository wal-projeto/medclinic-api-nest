import { Body, Controller, Get, Post } from '@nestjs/common';
import { GetAuthUser } from '../auth/decorator/get-auth-user.decorator';
import { RequireRole } from '../auth/decorator/require-role.decorator';
import type { AuthUser } from '../auth/jwt.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  me(@GetAuthUser() authUser: AuthUser) {
    return this.userService.me(authUser.id);
  }

  @Post()
  @RequireRole(['admin'])
  create(@Body() body: CreateUserDto) {
    // Pega o corpo da requisição. O pipe valida e descarta o que não está no DTO
    return this.userService.create(body);
  }
}
