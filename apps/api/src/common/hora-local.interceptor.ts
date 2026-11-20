import {
  type CallHandler,
  type ExecutionContext,
  HttpException,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { aHoraLocal } from '@veto/shared';
import { catchError, map, throwError, type Observable } from 'rxjs';

/** Un instante escrito en UTC, como lo deja `Date.toISOString()`: `2026-12-07T13:00:00.000Z`. */
const INSTANTE_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

/**
 * Pasa a hora de Colombia todos los instantes de una respuesta: las fechas (`Date`) y los textos
 * que son exactamente un instante en UTC. Recorre listas y objetos; lo demás se deja igual. Un
 * texto con desfase (`-05:00`) o una fecha sin hora (`2026-12-07`) no se toca.
 */
export function aHoraLocalEnRespuesta(valor: unknown): unknown {
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? valor : aHoraLocal(valor);
  if (typeof valor === 'string') {
    return INSTANTE_UTC.test(valor) && !Number.isNaN(Date.parse(valor)) ? aHoraLocal(valor) : valor;
  }
  if (Array.isArray(valor)) return valor.map(aHoraLocalEnRespuesta);
  if (valor !== null && typeof valor === 'object') {
    const prototipo = Object.getPrototypeOf(valor) as unknown;
    // Solo objetos planos (el JSON de la respuesta): no se tocan Buffer, streams ni otras clases
    if (prototipo === Object.prototype || prototipo === null) {
      return Object.fromEntries(
        Object.entries(valor).map(([clave, v]) => [clave, aHoraLocalEnRespuesta(v)]),
      );
    }
  }
  return valor;
}

/**
 * Todas las respuestas de la API, incluidos los cuerpos de error (por ejemplo, las citas que
 * impiden un bloqueo), entregan las fechas y horas con hora de Colombia en vez de UTC. Se
 * registra una sola vez en `main.ts`: ningún módulo tiene que acordarse de convertir.
 */
@Injectable()
export class HoraLocalInterceptor implements NestInterceptor {
  intercept(_contexto: ExecutionContext, siguiente: CallHandler): Observable<unknown> {
    return siguiente.handle().pipe(
      map(aHoraLocalEnRespuesta),
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof HttpException
            ? new HttpException(
                aHoraLocalEnRespuesta(error.getResponse()) as string | Record<string, unknown>,
                error.getStatus(),
              )
            : error,
        ),
      ),
    );
  }
}
