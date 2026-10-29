import { Injectable } from '@nestjs/common';
import { Patient } from './patient.entity';

//NewPatient = só os campos que nós mandarmos gravar. O Pick recorta de Patient só name e cpf
export type NewPatient = Pick<Patient, 'name' | 'cpf'>;

@Injectable()
export abstract class PatientRepository {
  abstract existsByCpf(cpf: string): Promise<boolean>; // Promessa: "me diga se esse CPF existe"
  abstract create(data: NewPatient): Promise<Patient>; // Promessa: "grave e me devolva o paciente completo"
}
