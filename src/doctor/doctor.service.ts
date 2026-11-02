import { Injectable } from '@nestjs/common';
import { AppException } from '../@common/exceptions/app.exception';
import { paginate } from '../@common/pagination/paginated';
import { PasswordService } from '../auth/password.service';
import { UserRepository } from '../user/user.repository';
import { CreateDoctorDto } from './dtos/create-doctor.dto';
import { ListDoctorsQueryDto } from './dtos/list-doctors-query.dto';
import { Doctor } from './doctor.entity';
import { DoctorRepository } from './doctor.repository';

@Injectable()
export class DoctorService {
  constructor(
    private readonly doctorRepository: DoctorRepository,
    private readonly userRepository: UserRepository, // para conferir se o e-mail já existe
    private readonly passwordService: PasswordService, // para guardar o hash da senha, nunca a senha
  ) {}

  // CADASTRA O MÉDICO (usuário de acesso + registro profissional)
  async create(input: CreateDoctorDto) {
    if (await this.userRepository.existsByEmail(input.email)) {
      throw new AppException('EMAIL_JA_CADASTRADO', 'E-mail já cadastrado.');
    }

    if (await this.doctorRepository.existsByCrm(input.crm)) {
      throw new AppException('CRM_JA_CADASTRADO', 'CRM já cadastrado.');
    }

    const doctor = await this.doctorRepository.createWithUser({
      crm: input.crm,
      user: {
        name: input.name,
        email: input.email,
        password: await this.passwordService.hash(input.password),
        roles: ['doctor'], // todo médico é usuário com o perfil doctor; quem manda é o service, e não o corpo
      },
    });

    return this.toResponse(doctor);
  }

  // LISTA OS MÉDICOS COM PAGINAÇÃO
  // Recebe a query já validada e convertida em números : ?page=3&pageSize=10&name=hel =>  { page: 3, pageSize: 10, name: "hel" }
  // transforma page e pageSize em skip e take e montar a resposta do contrato
  async list(query: ListDoctorsQueryDto) {
    const { doctors, total } = await this.doctorRepository.findPage({
      // Pede a página à porta e desmonta a resposta
      name: query.name, // repassa o nome
      skip: (query.page - 1) * query.pageSize, // A conta da paginação: páginas anteriores × tamanho : (3 − 1) × 10 = 20 → pula 20
      take: query.pageSize, // Pega o tamanho da página	10
    });

    return paginate(
      // chama a função de paginated.ts e monta  { data, meta }
      doctors.map((doctor) => this.toResponse(doctor)),
      total,
      query.page,
      query.pageSize,
    );
  }

  // Monta a resposta do contrato: { id, crm, user: { id, name, email, roles } }. A senha (hash) e as datas ficam de fora
  private toResponse(doctor: Doctor) {
    return {
      id: doctor.id,
      crm: doctor.crm,
      user: {
        id: doctor.user.id,
        name: doctor.user.name,
        email: doctor.user.email,
        roles: doctor.user.roles,
      },
    };
  }
}
