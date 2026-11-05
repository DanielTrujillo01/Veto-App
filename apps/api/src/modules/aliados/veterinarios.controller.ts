import {
  Body,
  Controller,
  HttpCode,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { actualizarPerfilVeterinarioSchema, crearVeterinarioSchema } from '@veto/shared';
import { validar } from '../../common/validacion';
import { AuthGuard, type RequestAutenticada } from '../identidad/auth.guard';
import { Roles, RolesGuard } from '../identidad/roles.guard';
import { VeterinariosService } from './veterinarios.service';

@ApiTags('aliados')
@Controller('aliados/:clinicaId/veterinarios')
export class VeterinariosController {
  constructor(private readonly veterinarios: VeterinariosService) {}

  @Get()
  @ApiOperation({
    summary: 'Ficha pública de la clínica con la foto y descripción de sus veterinarios (HU-013)',
  })
  listar(@Param('clinicaId', new ParseUUIDPipe()) clinicaId: string) {
    return this.veterinarios.listarPublicos(clinicaId);
  }

  @Post()
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crea el perfil y la cuenta de un veterinario de una clínica' })
  crear(
    @Param('clinicaId', new ParseUUIDPipe()) clinicaId: string,
    @Req() request: RequestAutenticada,
    @Body() body: unknown,
  ) {
    return this.veterinarios.crear(
      request.usuario.id,
      clinicaId,
      validar(crearVeterinarioSchema, body),
    );
  }

  @Put(':veterinarioId/perfil')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @ApiOperation({
    summary: 'Actualiza la foto o descripción del veterinario (HU-013)',
    description:
      'Solo el administrador de la clínica. Envía fotoUrl (http/https) y/o descripcion; ' +
      'null o "" las quita. El cambio se ve de inmediato en la ficha pública.',
  })
  actualizarPerfil(
    @Param('clinicaId', new ParseUUIDPipe()) clinicaId: string,
    @Param('veterinarioId', new ParseUUIDPipe()) veterinarioId: string,
    @Req() request: RequestAutenticada,
    @Body() body: unknown,
  ) {
    return this.veterinarios.actualizarPerfil(
      request.usuario.id,
      clinicaId,
      veterinarioId,
      validar(actualizarPerfilVeterinarioSchema, body),
    );
  }
}
