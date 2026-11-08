export type UsuarioSesion = { id: string; nombre: string; rol: string };

const EVENTO_SESION = 'veto:session-change';

export function notificarCambioSesion(usuario: UsuarioSesion | null) {
  window.dispatchEvent(new CustomEvent<UsuarioSesion | null>(EVENTO_SESION, { detail: usuario }));
}

export function escucharCambioSesion(
  callback: (usuario: UsuarioSesion | null) => void,
): () => void {
  const listener = (event: Event) => {
    if (event instanceof CustomEvent) {
      callback(event.detail as UsuarioSesion | null);
    }
  };
  window.addEventListener(EVENTO_SESION, listener);
  return () => window.removeEventListener(EVENTO_SESION, listener);
}
