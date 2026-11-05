/** Cliente mínimo de la API de Veto. Toda llamada al backend pasa por aquí. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const respuesta = await fetch(`${API_URL}${ruta}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (!respuesta.ok) {
    const texto = await respuesta.text();
    let mensaje = texto || `La solicitud falló (${respuesta.status})`;
    let errores: Record<string, string> = {};

    try {
      const cuerpo: unknown = JSON.parse(texto);
      if (typeof cuerpo === 'object' && cuerpo !== null) {
        const respuestaApi = cuerpo as {
          message?: string | string[];
          errores?: Record<string, string>;
          errors?: Record<string, string[]>;
        };
        if (typeof respuestaApi.message === 'string') mensaje = respuestaApi.message;
        if (Array.isArray(respuestaApi.message)) mensaje = respuestaApi.message.join('. ');
        errores = respuestaApi.errores ?? {};
        for (const [campo, mensajes] of Object.entries(respuestaApi.errors ?? {})) {
          if (mensajes[0] && !errores[campo]) errores[campo] = mensajes[0];
        }
      }
    } catch {
      // Algunas respuestas de infraestructura no son JSON; se conserva el texto recibido.
    }

    throw new ApiError(respuesta.status, mensaje, errores);
  }
  if (respuesta.status === 204) return undefined as T;
  return (await respuesta.json()) as T;
}
