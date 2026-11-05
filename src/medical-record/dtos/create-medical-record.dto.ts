// Responsabilidade: descreve e valida o corpo do POST do prontuário: só o texto. Barra o texto ausente ou vazio antes do service ser chamado.
// Quem escreve (o doctorId) NUNCA vem do corpo: vem do token.

import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateMedicalRecordDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) // "  dor lombar  " → "dor lombar"; "   " → "" (e o IsNotEmpty barra)
  @IsString()
  @IsNotEmpty()
  text!: string;
}

// Campos a mais no corpo (por exemplo doctorId) são descartados pelo AppValidationPipe: o autor é sempre o médico do token.
