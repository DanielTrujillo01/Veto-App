/** Cliente mínimo de la API de Veto. Toda llamada al backend pasa por aquí. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
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
    throw new ApiError(respuesta.status, await respuesta.text());
  }
  return (await respuesta.json()) as T;
}
