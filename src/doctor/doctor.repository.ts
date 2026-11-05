import { Injectable } from '@nestjs/common';
import { User } from '../user/user.entity';
import { Doctor } from './doctor.entity';

// NewDoctor = o CRM e os dados do usuário de acesso (o Pick recorta de User só os 4 campos que se grava)
export type NewDoctor = {
  crm: string;
  user: Pick<User, 'name' | 'email' | 'password' | 'roles'>;
};

// O pedido que o service faz ao repositório: o nome (opcional), quanto pular e quanto pegar: { name: "hel", skip: 0, take: 20 }
export type DoctorFilter = { name?: string; skip: number; take: number };
// A resposta: a fatia e o total : { doctors: [...], total: 2 }
export type DoctorPage = { doctors: Doctor[]; total: number };

// PORTAS
@Injectable()
export abstract class DoctorRepository {
  abstract existsByCrm(crm: string): Promise<boolean>; // "este CRM já existe?"
  abstract createWithUser(data: NewDoctor): Promise<Doctor>; // "grave o usuário e o médico juntos, ou nenhum dos dois"
  abstract findPage(filter: DoctorFilter): Promise<DoctorPage>; // "liste os médicos, com paginação e filtro por nome"
  abstract findById(id: number): Promise<Doctor | null>; // "me dê o médico deste número, ou null se não houver"
  abstract findByUserId(userId: number): Promise<Doctor | null>; // "me dê o médico deste usuário de acesso, ou null se o usuário não tem registro de médico"
}
