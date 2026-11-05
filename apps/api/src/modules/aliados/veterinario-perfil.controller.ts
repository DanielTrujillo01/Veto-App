import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PerfilVeterinario } from '@veto/shared';
import { AuthGuard } from '../identidad/auth.guard';
import { VeterinarioGuard, type RequestVeterinario } from './veterinario.guard';

@ApiTags('aliados')
@Controller('veterinarios/me')
@UseGuards(AuthGuard, VeterinarioGuard)
export class VeterinarioPerfilController {
  @Get()
  @ApiOperation({
    summary: 'Perfil del veterinario autenticado (HU-014)',
    description:
      'Devuelve el perfil de la cuenta con la que se inició sesión. 403 si la cuenta no tiene ' +
      'perfil de veterinario, si está desactivado o si su clínica no está activa.',
  })
  obtener(@Req() request: RequestVeterinario): PerfilVeterinario {
    const { usuario, veterinario } = request;
    return {
      id: veterinario.id,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        celular: usuario.celular,
      },
      aliado: {
        id: veterinario.aliadoId,
        nombre: veterinario.aliadoNombre,
        tipo: veterinario.aliadoTipo,
      },
      fotoUrl: veterinario.fotoUrl,
      descripcion: veterinario.descripcion,
    };
  }
}
