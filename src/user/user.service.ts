import { Injectable } from '@nestjs/common';
import { PasswordService } from '../auth/password.service';
import { AppException } from '../@common/exceptions/app.exception';
import { LoginDto } from './dtos/login.dto';
import { CreateUserDto } from './dtos/create-user.dto';
import { User } from './user.entity';
import { UserRepository } from './user.repository';

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$dmEBa6j4J+TrGw1bXCMXDg$7KfNGA8bvDW09y9Exe2ckdqWS07o8/sXdiJAE/YSqDA';
@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordService: PasswordService,
  ) {}

  // LOGIN
  async login(input: LoginDto): Promise<Omit<User, 'password'>> {
    // Busca no repositorio um Usuário com o e-mail recebido dentro do LoginDto
    const user = await this.userRepository.findByEmailWithPassword(input.email);

    const passwordMatches = await this.passwordService.compare(
      input.password,
      user?.password ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordMatches) {
      throw new AppException(
        'CREDENCIAIS_INVALIDAS',
        'Email ou senha inválidos.',
      );
    }

    const { password: _password, ...userWithoutPassword } = user;

    return userWithoutPassword;
  }

  // OBTER USUÁRIO me
  async me(id: number) {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new AppException('NAO_AUTENTICADO', 'Token inválido ou expirado.');
    }
    return this.toResponse(user); // um único lugar que decide o que sai. O me e o create usam o mesmo
  }

  // CRIAR USUÁRIO
  async create(input: CreateUserDto) {
    if (await this.userRepository.existsByEmail(input.email)) {
      throw new AppException('EMAIL_JA_CADASTRADO', 'E-mail já cadastrado.');
    }

    const user = await this.userRepository.create({
      // grava só os 4 campos permitidos
      name: input.name,
      email: input.email,
      password: await this.passwordService.hash(input.password),
      roles: input.roles,
    });

    return this.toResponse(user); // devolve só os 4 campos públicos
  }

  private toResponse(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles,
    };
  }
}
