import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Hace que las respuestas de error de un controlador lleven un `codigo` estable (para que la web
 * decida qué mostrar sin leer el texto) además del `message`. Respeta el `codigo` que ya traiga
 * la excepción; si no trae, usa el que corresponda al estado HTTP según `codigosPorEstado`.
 * Un error inesperado responde 500 con `ERROR_INTERNO` y un mensaje genérico (el detalle solo
 * queda en el registro del servidor, no se le muestra a quien llama).
 *
 * Úsalo con `@UseFilters(new CodigosDeErrorFilter({ 401: 'NO_AUTENTICADO', ... }))`.
 */
@Catch()
export class CodigosDeErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(CodigosDeErrorFilter.name);

  constructor(private readonly codigosPorEstado: Partial<Record<number, string>> = {}) {}

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const respuesta = host.switchToHttp().getResponse<Response>();

    if (excepcion instanceof HttpException) {
      const estado = excepcion.getStatus();
      const cuerpo = excepcion.getResponse();
      const base: Record<string, unknown> =
        typeof cuerpo === 'string' ? { message: cuerpo } : { ...cuerpo };
      const codigo = base.codigo ?? this.codigosPorEstado[estado] ?? `HTTP_${estado}`;
      respuesta.status(estado).json({ ...base, codigo });
      return;
    }

    this.logger.error(
      excepcion instanceof Error ? (excepcion.stack ?? excepcion.message) : String(excepcion),
    );
    respuesta.status(500).json({
      codigo: 'ERROR_INTERNO',
      message: 'Ocurrió un error inesperado. Intenta de nuevo en unos minutos.',
    });
  }
}
