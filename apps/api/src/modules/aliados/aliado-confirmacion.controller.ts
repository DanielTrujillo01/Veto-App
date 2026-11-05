import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { guardarConfirmacionSchema } from '@veto/shared';
import { validar } from '../../common/validacion';
import { AuthGuard, type RequestAutenticada } from '../identidad/auth.guard';
import { Roles, RolesGuard } from '../identidad/roles.guard';
import { AliadoConfirmacionService } from './aliado-confirmacion.service';

@ApiTags('aliados')
@Controller('aliados/:aliadoId/confirmacion')
export class AliadoConfirmacionController {
  constructor(private readonly confirmacion: AliadoConfirmacionService) {}

  @Get()
  @ApiOperation({
    summary: 'Cómo confirma sus citas un aliado (público, HU-023)',
    description:
      'Devuelve { modo, estadoInicialCita }: AUTOMATICA → la reserva queda AGENDADA (confirmada); ' +
      'MANUAL → queda PENDIENTE hasta que el aliado la acepte. 404 si el aliado no existe, no está ' +
      'activo o no recibe citas.',
  })
  obtener(@Param('aliadoId', new ParseUUIDPipe()) aliadoId: string) {
    return this.confirmacion.obtenerPublica(aliadoId);
  }

  @Put()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @ApiOperation({
    summary: 'Elegir confirmación automática o manual de las citas (HU-023)',
    description:
      'Envía { modo: "AUTOMATICA" | "MANUAL" }. Solo el administrador de una clínica o de un ' +
      'veterinario independiente activo. Aplica a las reservas nuevas; las citas ya pendientes ' +
      'no se confirman solas al cambiar a automático.',
  })
  guardar(
    @Req() request: RequestAutenticada,
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
    @Body() body: unknown,
  ) {
    return this.confirmacion.guardar(
      request.usuario.id,
      aliadoId,
      validar(guardarConfirmacionSchema, body),
    );
  }
}
