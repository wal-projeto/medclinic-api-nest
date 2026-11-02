import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { Doctor } from './doctor.entity';
import { DoctorRepository, NewDoctor } from './doctor.repository';

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
}
