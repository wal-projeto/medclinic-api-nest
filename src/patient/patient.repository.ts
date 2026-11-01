import { Injectable } from '@nestjs/common';
import { Patient } from './patient.entity';

//NewPatient = só os campos que nós mandarmos gravar. O Pick recorta de Patient só name e cpf
export type NewPatient = Pick<Patient, 'name' | 'cpf'>;
// O pedido que o service faz ao repositório: o nome (opcional), quanto pular e quanto pegar: { name: "mari", skip: 0, take: 20 }
export type PatientFilter = { name?: string; skip: number; take: number };
export type PatientPage = { patients: Patient[]; total: number }; // A resposta: a fatia e o total : { patients: [...], total: 2 }

// PORTAS
@Injectable()
export abstract class PatientRepository {
  abstract existsByCpf(cpf: string): Promise<boolean>; // Promessa: "me diga se esse CPF existe"
  abstract create(data: NewPatient): Promise<Patient>; // Promessa: "grave e me devolva o paciente completo"
  abstract findPage(filter: PatientFilter): Promise<PatientPage>; // 	A promessa nova da porta: "me dê esta página"
  abstract findById(id: number): Promise<Patient | null>; // "me dê o paciente deste número, ou null se não houver"
  abstract save(patient: Patient): Promise<Patient>; // "grave e me devolva o paciente completo"
  abstract softDelete(id: number): Promise<void>; // "delete logicamente este paciente"
}
