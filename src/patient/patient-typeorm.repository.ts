import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Patient } from './patient.entity';
import { NewPatient, PatientRepository } from './patient.repository';

//etiqueta que injecta o repositório do TypeOrm
export const TYPEORM_PATIENT_REPOSITORY = 'TYPEORM_PATIENT_REPOSITORY' as const;

@Injectable()
export class PatientTypeormRepository implements PatientRepository {
  constructor(
    @Inject(TYPEORM_PATIENT_REPOSITORY)
    private readonly repository: Repository<Patient>, // o Nest entrega o Repository<Patient>
  ) {}

  existsByCpf(cpf: string): Promise<boolean> {
    // pergunta ao banco se existe linha com esse CPF, incluindo as removidas
    return this.repository.exists({ where: { cpf }, withDeleted: true });
  }

  create(data: NewPatient): Promise<Patient> {
    return this.repository.save(this.repository.create(data)); // create monta o objeto Patient, e o save faz o INSERT e devolve com id e datas preenchicas pelo banco
  }
}
// withDeleted: true? Normalmente o TypeORM esconde as linhas com deletedAt, então
// sem o withDeleted: o service acha que o CPF estava livre, tenta gravar, o banco barra e a resposta é 500 ERRO_INTERNO;
// com o withDeleted: a resposta é 409 CPF_JA_CADASTRADO, a resposta certa.
