import { Body, Controller, Post } from '@nestjs/common';
import { RequireRole } from '../auth/decorator/require-role.decorator';
import { CreateDoctorDto } from './dtos/create-doctor.dto';
import { DoctorService } from './doctor.service';

@Controller('doctors') // api/v1/doctors
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  @Post() // POST /api/v1/doctors : só admin; secretary e doctor → 403. O Nest responde 201 por padrão no POST
  @RequireRole(['admin'])
  create(@Body() body: CreateDoctorDto) {
    return this.doctorService.create(body);
  }
}
