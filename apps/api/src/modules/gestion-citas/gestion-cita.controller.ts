import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { finalizarCitaSchema, noAsistioCitaSchema } from '@veto/shared';
import { CodigosDeErrorFilter } from '../../common/codigos-de-error.filter';
import { validar } from '../../common/validacion';
import { AuthGuard, type RequestAutenticada } from '../identidad/auth.guard';
import { Roles, RolesGuard } from '../identidad/roles.guard';
import { GestionCitaService } from './gestion-cita.service';

/** Códigos de las respuestas de error de estos endpoints (campo `codigo`). */
const CODIGOS = {
  400: 'DATOS_INVALIDOS',
  401: 'NO_AUTENTICADO',
  403: 'SIN_PERMISOS_CITA',
  404: 'CITA_NO_ENCONTRADA',
} as const;

const ERRORES =
  'Errores (todos con `codigo` y `message`): 400 DATOS_INVALIDOS, 401 NO_AUTENTICADO, ' +
  '403 SIN_PERMISOS_CITA, 404 CITA_NO_ENCONTRADA, 409 ESTADO_CITA_INVALIDO (la cita no está ' +
  'AGENDADA), 422 CITA_NO_FINALIZABLE (su hora todavía no llega), 500 ERROR_INTERNO.';

/**
 * El aliado cierra una cita (HU-032, HU-033). Puede hacerlo el administrador del aliado o uno de
 * sus veterinarios activos, y solo sobre las citas de ese aliado.
 */
@ApiTags('gestion-citas')
@Controller('citas/:citaId')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ALIADO', 'VETERINARIO')
@UseFilters(new CodigosDeErrorFilter(CODIGOS))
export class GestionCitaController {
  constructor(private readonly gestion: GestionCitaService) {}

  @Patch('finalizar')
  @ApiOperation({
    summary: 'Marca una cita agendada como finalizada y deja recomendaciones (HU-032, HU-033)',
    description:
      'Cuerpo opcional: { recomendaciones? }. Las recomendaciones (máx. 2000 caracteres) las ve ' +
      'el tutor en el detalle de su cita; vacío o null las omite. Finalizar no lleva observación ' +
      '(si se envía, se ignora). Solo se puede si la cita está AGENDADA y su fecha y hora de ' +
      'inicio ya llegaron (se compara con el reloj de la base de datos). Si todo sale bien, el ' +
      'tutor recibe una notificación interna. Si algo falla no se guarda nada: ni el estado, ' +
      'ni el historial, ni las recomendaciones. ' +
      ERRORES,
  })
  @ApiResponse({
    status: 200,
    description:
      'La cita actualizada (como GET /citas/:citaId) con `actualizadoEn` y `actualizadoPor`.',
  })
  finalizar(
    @Req() request: RequestAutenticada,
    @Param('citaId', new ParseUUIDPipe()) citaId: string,
    @Body() body: unknown,
  ) {
    return this.gestion.finalizar(
      request.usuario.id,
      citaId,
      validar(finalizarCitaSchema, body ?? {}),
    );
  }

  @Patch('no-asistio')
  @ApiOperation({
    summary: 'Marca una cita agendada como no asistió (HU-032)',
    description:
      'Cuerpo opcional: { observacion? }. La observación (máx. 500 caracteres) es una nota ' +
      'interna: queda en el historial de estados y solo la ve el aliado. Mismas condiciones que finalizar. NO_ASISTIO es un estado final: la cita ya no ' +
      'se puede modificar. El tutor recibe una notificación interna. ' +
      ERRORES,
  })
  @ApiResponse({
    status: 200,
    description:
      'La cita actualizada (como GET /citas/:citaId) con `actualizadoEn` y `actualizadoPor`.',
  })
  noAsistio(
    @Req() request: RequestAutenticada,
    @Param('citaId', new ParseUUIDPipe()) citaId: string,
    @Body() body: unknown,
  ) {
    return this.gestion.marcarNoAsistio(
      request.usuario.id,
      citaId,
      validar(noAsistioCitaSchema, body ?? {}),
    );
  }
}

/** Los cambios de estado de una cita: los ven su tutor y quienes la gestionan. */
@ApiTags('gestion-citas')
@Controller('citas/:citaId/historial')
@UseGuards(AuthGuard, RolesGuard)
@Roles('TUTOR', 'ALIADO', 'VETERINARIO')
@UseFilters(new CodigosDeErrorFilter(CODIGOS))
export class HistorialCitaController {
  constructor(private readonly gestion: GestionCitaService) {}

  @Get()
  @ApiOperation({
    summary: 'Historial de cambios de estado de una cita (HU-032)',
    description:
      'Del más antiguo al más reciente: estado anterior, estado nuevo, cuándo, quién y la ' +
      'observación. La observación solo la ve el aliado; para el tutor es null. Una persona ' +
      'ajena a la cita recibe 404.',
  })
  listar(@Req() request: RequestAutenticada, @Param('citaId', new ParseUUIDPipe()) citaId: string) {
    return this.gestion.historial(request.usuario.id, citaId);
  }
}
