'use client';

/**
 * Paso "Confirma tu contraseña" después de ingresar (pedido del cliente), antes de mostrar
 * "Sesión iniciada". Vale para cualquier forma de ingresar, también con Google:
 * - Si la cuenta tiene contraseña de Veto, se pide escribirla y la API la comprueba
 *   (POST /identidad/contrasena/confirmar).
 * - Si la cuenta se creó con Google y no tiene contraseña, se pide crearla, escrita dos veces
 *   (PUT /identidad/contrasena).
 */

import { useEffect, useState, type FormEvent } from 'react';
import { crearContrasenaSchema } from '@veto/shared';
import { AlertBox, VetoButton } from '@/components/ui/veto-components';
import { api, ApiError } from '@/lib/api';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'confirmar' }
  | { tipo: 'crear' }
  | { tipo: 'error'; mensaje: string };

export function PasoContrasena({ nombre, onListo }: { nombre: string; onListo: () => void }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [contrasena, setContrasena] = useState('');
  const [repetida, setRepetida] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    api<{ tieneContrasena: boolean }>('/identidad/contrasena')
      .then(({ tieneContrasena }) => {
        if (vigente) setEstado({ tipo: tieneContrasena ? 'confirmar' : 'crear' });
      })
      .catch((causa: unknown) => {
        if (vigente) {
          setEstado({
            tipo: 'error',
            mensaje: causa instanceof ApiError ? causa.message : 'No pudimos revisar tu cuenta.',
          });
        }
      });
    return () => {
      vigente = false;
    };
  }, []);

  const crear = estado.tipo === 'crear';
  const distintas = crear && repetida.length > 0 && repetida !== contrasena;

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError('');
    if (crear) {
      const valida = crearContrasenaSchema.safeParse({ contrasena });
      if (!valida.success) {
        setError(valida.error.issues[0]?.message ?? 'Revisa la contraseña.');
        return;
      }
      if (repetida !== contrasena) {
        setError('Las contraseñas no coinciden.');
        return;
      }
    }
    setEnviando(true);
    try {
      await api(crear ? '/identidad/contrasena' : '/identidad/contrasena/confirmar', {
        method: crear ? 'PUT' : 'POST',
        body: JSON.stringify({ contrasena }),
      });
      onListo();
    } catch (causa) {
      setError(
        causa instanceof ApiError && causa.status === 401
          ? 'La contraseña no es correcta. Inténtalo de nuevo.'
          : causa instanceof ApiError
            ? causa.message
            : 'No pudimos comprobar tu contraseña. Inténtalo de nuevo.',
      );
      setContrasena('');
    } finally {
      setEnviando(false);
    }
  }

  if (estado.tipo === 'cargando') {
    return (
      <div className="auth-welcome" aria-live="polite">
        <span className="skeleton pet-skeleton-line" />
        <span className="skeleton pet-skeleton-line pet-skeleton-line--short" />
      </div>
    );
  }

  if (estado.tipo === 'error') {
    return (
      <AlertBox tone="error" title="Algo salió mal">
        {estado.mensaje}
      </AlertBox>
    );
  }

  return (
    <form className="auth-welcome auth-confirm" noValidate onSubmit={(e) => void enviar(e)}>
      <span aria-hidden="true" className="auth-welcome__mono auth-confirm__icon">
        <svg viewBox="0 0 24 24">
          <rect height="10" rx="2.5" width="14" x="5" y="10.5" />
          <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
          <circle cx="12" cy="15.5" r="1.2" />
        </svg>
      </span>
      <p className="eyebrow eyebrow--dark">{crear ? 'UN ÚLTIMO PASO' : 'VERIFICACIÓN'}</p>
      <h1 id="login-title">{crear ? 'Crea tu contraseña' : 'Confirma tu contraseña'}</h1>
      <p className="auth-intro">
        {crear
          ? `${nombre}, entraste con Google. Crea una contraseña de Veto para proteger tu cuenta.`
          : `${nombre}, por tu seguridad escribe de nuevo tu contraseña para continuar.`}
      </p>

      {error && (
        <p className="field-error auth-confirm__error" role="alert">
          {error}
        </p>
      )}

      <label className="field auth-confirm__field">
        <span>{crear ? 'Nueva contraseña' : 'Contraseña'}</span>
        <span className="password-control">
          <input
            autoComplete={crear ? 'new-password' : 'current-password'}
            autoFocus
            className={`control${error ? ' control--error' : ''}`}
            name="contrasena"
            onChange={(e) => setContrasena(e.target.value)}
            required
            type={mostrar ? 'text' : 'password'}
            value={contrasena}
          />
          <button
            aria-label={mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="password-toggle"
            onClick={() => setMostrar(!mostrar)}
            type="button"
          >
            {mostrar ? 'Ocultar' : 'Mostrar'}
          </button>
        </span>
        {crear && <small className="field-hint">Mínimo 8 caracteres.</small>}
      </label>

      {crear && (
        <label className="field auth-confirm__field">
          <span>Repite la contraseña</span>
          <input
            aria-invalid={distintas}
            autoComplete="new-password"
            className={`control${distintas ? ' control--error' : ''}`}
            name="repetida"
            onChange={(e) => setRepetida(e.target.value)}
            required
            type={mostrar ? 'text' : 'password'}
            value={repetida}
          />
          {distintas && <small className="field-error">Las contraseñas no coinciden.</small>}
        </label>
      )}

      <VetoButton className="auth-submit" loading={enviando} type="submit">
        {crear ? 'Crear contraseña y continuar' : 'Confirmar y continuar'}
      </VetoButton>
    </form>
  );
}
