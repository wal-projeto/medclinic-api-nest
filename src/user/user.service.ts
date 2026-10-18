import { Injectable } from '@nestjs/common';
import { PasswordService } from '../auth/password.service';
import { AppException } from '../@common/exceptions/app.exception';
import { LoginDto } from './dtos/login.dto';
import { User } from './user.entity';
import { UserRepository } from './user.repository';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordService: PasswordService,
  ) {}

  async login(input: LoginDto): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.findByEmailWithPassword(input.email);

    if (!user) {
      throw new AppException(
        'CREDENCIAIS_INVALIDAS',
        'Email ou senha inválidos.',
      );
    }

    const passwordMatches = await this.passwordService.compare(
      input.password,
      user.password,
    );

    if (!passwordMatches) {
      throw new AppException(
        'CREDENCIAIS_INVALIDAS',
        'Email ou senha inválidos.',
      );
    }

    const { password: _password, ...userWithoutPassword } = user;

    return userWithoutPassword;
  }
}
