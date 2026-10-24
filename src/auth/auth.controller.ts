import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { LoginDto } from '../user/dtos/login.dto';
import { UserService } from '../user/user.service';
import { PublicRoute } from './decorator/public-route.decorator';
import { JwtService } from './jwt.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  @PublicRoute()
  @Post()
  @HttpCode(200)
  async login(@Body() body: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.userService.login(body);

    return {
      accessToken: this.jwtService.sign({ id: user.id, roles: user.roles }),
    };
  }
}
