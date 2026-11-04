import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { VeterinariosService } from './veterinarios.service';

@ApiTags('aliados')
@Controller('aliados/clinicas')
export class ClinicasController {
  constructor(private readonly veterinarios: VeterinariosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista clínicas activas para acceder a sus fichas públicas' })
  listar() {
    return this.veterinarios.listarClinicas();
  }
}
