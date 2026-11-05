import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { type CrearVeterinario } from '@veto/shared';
import { VeterinariosService } from './veterinarios.service';

@ApiTags('aliados')
@Controller('aliados/:clinicaId/veterinarios')
export class VeterinariosController {
  constructor(private readonly veterinarios: VeterinariosService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crea el perfil y la cuenta de un veterinario de una clínica' })
  crear(
    @Param('clinicaId', new ParseUUIDPipe()) clinicaId: string,
    @Headers('x-user-id') administradorClinicaId: string | undefined,
    @Body() entrada: CrearVeterinario,
  ) {
    if (!administradorClinicaId) {
      throw new UnauthorizedException('Se requiere el usuario autenticado');
    }
    return this.veterinarios.crear(administradorClinicaId, clinicaId, entrada);
  }
}
