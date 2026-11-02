import { Inject, Injectable } from '@nestjs/common';
import { ILike, Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { MAX_INTEGER } from '../@common/database/postgres-limits';
import { Doctor } from './doctor.entity';
import {
  DoctorFilter,
  DoctorPage,
  DoctorRepository,
  NewDoctor,
} from './doctor.repository';

// etiqueta que injeta o repositório do TypeORM
export const TYPEORM_DOCTOR_REPOSITORY = 'TYPEORM_DOCTOR_REPOSITORY' as const;

@Injectable()
export class DoctorTypeormRepository implements DoctorRepository {
  constructor(
    @Inject(TYPEORM_DOCTOR_REPOSITORY)
    private readonly repository: Repository<Doctor>,
  ) {}

  // pergunta ao banco se existe médico com esse CRM
  existsByCrm(crm: string): Promise<boolean> {
    return this.repository.existsBy({ crm });
  }

  // Grava o usuário e o médico NA MESMA TRANSAÇÃO: o banco faz BEGIN, os dois INSERT e COMMIT.
  // Se qualquer um falhar, o banco faz ROLLBACK e desfaz o outro.
  createWithUser(data: NewDoctor): Promise<Doctor> {
    return this.repository.manager.transaction(async (manager) => {
      // faz START TRANSACTION, roda a função, e faz COMMIT se ela terminar ou ROLLBACK se ela lançar erro
      const user = await manager.save(manager.create(User, data.user)); // INSERT do usuário (ainda não vale: falta o COMMIT)
      return manager.save(manager.create(Doctor, { crm: data.crm, user })); // INSERT do médico, apontando para o usuário; o save faz o INSERT com o user_id do usuário recém-criado; se falhar, o ROLLBACK desfaz o INSERT do usuário
    });
  }

  // Recebe o filtro já "desmontado" em três variáveis (desestruturação)	name="hel", skip=0, take=2
  async findPage({ name, skip, take }: DoctorFilter): Promise<DoctorPage> {
    const [doctors, total] = await this.repository.findAndCount({
      // faz as consultas e devolve o par [a fatia, o total] : Ex: 	[[Helena, Carlos], 2]
      relations: { user: true }, // traz o usuário junto (JOIN): o nome e o e-mail do médico estão na tabela user
      where: name ? { user: { name: ILike(`%${name}%`) } } : {}, // Se veio nome: user.name ILIKE '%HEL%', filtra; Se não veio: {}, sem filtro
      order: { id: 'ASC' }, // Ordem fixa, do menor id para o maior
      skip, // Pula skip e pega take	OFFSET 0 LIMIT 2
      take,
    });
    return { doctors, total }; // Devolve no formato da porta	{ doctors: [...], total: 2 }
  }

  // BUSCA UM MÉDICO PELO id (com o usuário junto) - recebe o id já como número
  findById(id: number): Promise<Doctor | null> {
    if (id < 1 || id > MAX_INTEGER) {
      return Promise.resolve(null); // 0, -1, 99999999999 -> null sem consultar o banco - 404
    }
    return this.repository.findOne({
      where: { id },
      relations: { user: true }, // traz o usuário junto (JOIN): o nome e o e-mail do médico estão na tabela user
    });
  }
}
