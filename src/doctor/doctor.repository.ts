import { Injectable } from '@nestjs/common';
import { User } from '../user/user.entity';
import { Doctor } from './doctor.entity';

// NewDoctor = o CRM e os dados do usuário de acesso (o Pick recorta de User só os 4 campos que se grava)
export type NewDoctor = {
  crm: string;
  user: Pick<User, 'name' | 'email' | 'password' | 'roles'>;
};

// PORTAS
@Injectable()
export abstract class DoctorRepository {
  abstract existsByCrm(crm: string): Promise<boolean>; // "este CRM já existe?"
  abstract createWithUser(data: NewDoctor): Promise<Doctor>; // "grave o usuário e o médico juntos, ou nenhum dos dois"
}
