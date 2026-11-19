'use client';

import Link from 'next/link';
import { iniciales } from '@/components/PortadaCapas';
import { useEffect, useState, type FormEvent } from 'react';
import type { PendienteGoogle } from '@veto/shared';
import { AlertBox, CelularField, VetoButton } from '@/components/ui/veto-components';
import { GoogleAuthButton } from '@/components/GoogleAuthButton';
import { api, ApiError } from '@/lib/api';
import { notificarCambioSesion } from '@/lib/session';

type Usuario = { id: string; nombre: string; rol: string };
type RespuestaLogin =
  { usuario: Usuario } | { requiere2fa: true; desafio: string; expiraEn: string };

const erroresGoogle: Record<string, string> = {
  cancelado: 'Cancelaste el inicio de sesión con Google.',
  proveedor: 'Google no pudo completar el inicio de sesión. Inténtalo de nuevo.',
  correo_no_verificado: 'Tu cuenta de Google necesita tener el correo verificado.',
  estado: 'La solicitud de Google venció. Inicia el proceso de nuevo.',
  cuenta_inactiva: 'Esta cuenta de Veto no está activa.',
  cuenta_vinculada: 'Esta cuenta ya está vinculada a otra cuenta de Google.',
  cuenta_distinta: 'Se inició sesión con una cuenta de Google diferente.',
  no_disponible: 'El inicio de sesión con Google no está configurado en este servidor.',
};

/** Solo rutas de esta misma web ("/reservar/…"), nunca otro sitio ("//x.com", "https://…"). */
function rutaInternaSegura(ruta: string | null) {
  return ruta && ruta.startsWith('/') && !ruta.startsWith('//') && !ruta.includes('\\') ? ruta : '';
}

export default function Ingresar() {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [desafio2fa, setDesafio2fa] = useState('');
  const [codigo2fa, setCodigo2fa] = useState('');
  const [googlePendiente, setGooglePendiente] = useState<PendienteGoogle | null>(null);
  const [celularGoogle, setCelularGoogle] = useState('');
  const [contrasenaGoogle, setContrasenaGoogle] = useState('');
  const [codigoGoogle, setCodigoGoogle] = useState('');
  /** A dónde volver después de ingresar (ej. la reserva que el tutor estaba haciendo). */
  const [volverA, setVolverA] = useState('');

  useEffect(() => {
    let vigente = true;
    const parametros = new URLSearchParams(window.location.search);
    setVolverA(rutaInternaSegura(parametros.get('returnTo')));
    const resultado = parametros.get('google');
    if (resultado === 'ok') {
      setCargando(true);
      void api<{ usuario: Usuario }>('/identidad/me')
        .then(({ usuario: perfil }) => {
          if (!vigente) return;
          setUsuario(perfil);
          notificarCambioSesion(perfil);
        })
        .catch(() => {
          if (vigente) setError('Google inició sesión, pero no pudimos cargar tu perfil.');
        })
        .finally(() => {
          if (vigente) setCargando(false);
        });
    } else if (resultado === '2fa') {
      const desafio = new URLSearchParams(window.location.hash.slice(1)).get('desafio');
      if (desafio) {
        setDesafio2fa(desafio);
      } else {
        setError('No recibimos el desafío de verificación. Inicia sesión con Google de nuevo.');
      }
    } else if (resultado === 'registro' || resultado === 'vincular') {
      setCargando(true);
      void api<{ pendiente: PendienteGoogle | null }>('/identidad/google/pendiente')
        .then(({ pendiente }) => {
          if (!vigente) return;
          if (!pendiente) throw new Error('No encontramos una solicitud pendiente de Google.');
          setGooglePendiente(pendiente);
        })
        .catch((causa: unknown) => {
          if (vigente) {
            setError(
              causa instanceof ApiError
                ? causa.message
                : causa instanceof Error
                  ? causa.message
                  : 'No pudimos continuar el registro con Google.',
            );
          }
        })
        .finally(() => {
          if (vigente) setCargando(false);
        });
    } else if (resultado === 'error') {
      const motivo = parametros.get('motivo') ?? '';
      setError(erroresGoogle[motivo] ?? 'No pudimos iniciar sesión con Google.');
    } else if (resultado === 'reauth') {
      setError('La verificación de Google se completó. Vuelve a la acción que estabas realizando.');
    }

    return () => {
      vigente = false;
    };
  }, []);

  async function iniciarSesion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setCargando(true);
    try {
      const resultado = await api<RespuestaLogin>('/identidad/login', {
        method: 'POST',
        body: JSON.stringify({ correo, contrasena }),
      });
      if ('usuario' in resultado) {
        setUsuario(resultado.usuario);
        notificarCambioSesion(resultado.usuario);
      } else {
        setDesafio2fa(resultado.desafio);
      }
    } catch (causa) {
      setError(
        causa instanceof ApiError
          ? causa.message
          : 'No pudimos conectarnos. Revisa que la API esté disponible e inténtalo de nuevo.',
      );
    } finally {
      setCargando(false);
    }
  }

  async function completarLogin2fa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setCargando(true);
    try {
      const resultado = await api<{ usuario: Usuario }>('/identidad/login/2fa', {
        method: 'POST',
        body: JSON.stringify({ desafio: desafio2fa, codigo: codigo2fa }),
      });
      setUsuario(resultado.usuario);
      notificarCambioSesion(resultado.usuario);
      setDesafio2fa('');
    } catch (causa) {
      setError(
        causa instanceof ApiError
          ? causa.message
          : 'No pudimos verificar el código. Inténtalo de nuevo.',
      );
    } finally {
      setCargando(false);
    }
  }

  async function completarRegistroGoogle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setCargando(true);
    try {
      const resultado = await api<{ usuario: Usuario }>('/identidad/google/completar', {
        method: 'POST',
        body: JSON.stringify({ celular: celularGoogle }),
      });
      setUsuario(resultado.usuario);
      setGooglePendiente(null);
      notificarCambioSesion(resultado.usuario);
    } catch (causa) {
      setError(
        causa instanceof ApiError ? causa.message : 'No pudimos completar tu registro con Google.',
      );
    } finally {
      setCargando(false);
    }
  }

  async function vincularGoogle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setCargando(true);
    try {
      const resultado = await api<{ usuario: Usuario }>('/identidad/google/vincular', {
        method: 'POST',
        body: JSON.stringify({
          contrasena: contrasenaGoogle,
          ...(codigoGoogle ? { codigo: codigoGoogle } : {}),
        }),
      });
      setUsuario(resultado.usuario);
      setGooglePendiente(null);
      notificarCambioSesion(resultado.usuario);
    } catch (causa) {
      setError(causa instanceof ApiError ? causa.message : 'No pudimos vincular tu cuenta.');
    } finally {
      setCargando(false);
    }
  }

  async function cancelarGoogle() {
    setError('');
    setCargando(true);
    try {
      await api('/identidad/google/pendiente', { method: 'DELETE' });
      setGooglePendiente(null);
      window.history.replaceState({}, '', window.location.pathname);
    } catch (causa) {
      setError(causa instanceof ApiError ? causa.message : 'No pudimos cancelar la solicitud.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="auth-page auth-page--centered auth-page--login">
      <section aria-labelledby="login-title" className="auth-form-panel">
        <div className="auth-card">
          {usuario ? (
            // Sesión iniciada: bienvenida sencilla con la ficha (monograma peach, saludo en Sora
            // con acento burgundy) en lugar de una alerta verde.
            <div className="auth-welcome">
              <span aria-hidden="true" className="auth-welcome__mono">
                {iniciales(usuario.nombre) || 'V'}
              </span>
              <p className="eyebrow eyebrow--dark">SESIÓN INICIADA</p>
              <h1 id="login-title">
                Hola, <em>{usuario.nombre}.</em>
              </h1>
              <p className="auth-intro">
                {usuario.rol === 'TUTOR'
                  ? 'Qué bueno verte de nuevo. Tus mascotas te esperan.'
                  : 'Qué bueno verte de nuevo. Tu panel está listo.'}
              </p>
              <Link
                className="veto-button veto-button--primary auth-submit"
                href={
                  volverA ||
                  (usuario.rol === 'VETERINARIO'
                    ? '/panel/veterinario'
                    : usuario.rol === 'ALIADO'
                      ? '/panel/aliado'
                      : '/mascotas')
                }
              >
                {volverA
                  ? 'Continuar'
                  : usuario.rol === 'TUTOR'
                    ? 'Ver mis mascotas'
                    : 'Ir a mi panel'}
              </Link>
              <Link className="auth-welcome__home" href="/">
                Ir al inicio
              </Link>
            </div>
          ) : (
            <>
              <p className="eyebrow eyebrow--dark">QUÉ BUENO TENERTE DE VUELTA</p>
              <h1 id="login-title">Inicia sesión</h1>
              <p className="auth-intro">Ingresa para continuar cuidando de tu mascota.</p>
            </>
          )}

          {usuario ? null : googlePendiente ? (
            <>
              <AlertBox
                tone="info"
                title={
                  googlePendiente.tipo === 'REGISTRO'
                    ? `Hola, ${googlePendiente.nombre}`
                    : 'Vincula tu cuenta de Veto'
                }
              >
                {googlePendiente.tipo === 'REGISTRO'
                  ? `Confirma tu número para crear una cuenta con ${googlePendiente.correo}.`
                  : `Ya existe una cuenta con ${googlePendiente.correo}. Ingresa su contraseña para demostrar que es tuya.`}
              </AlertBox>
              {error && (
                <div className="auth-error" role="alert">
                  <strong>No pudimos continuar con Google</strong>
                  <span>{error}</span>
                </div>
              )}
              {googlePendiente.tipo === 'REGISTRO' ? (
                <form className="form-stack" onSubmit={completarRegistroGoogle}>
                  <CelularField
                    id="google-celular"
                    label="Celular de contacto *"
                    onChange={setCelularGoogle}
                    required
                    value={celularGoogle}
                  />
                  <VetoButton
                    className="auth-submit"
                    disabled={celularGoogle.length !== 10}
                    loading={cargando}
                    type="submit"
                  >
                    Crear cuenta
                  </VetoButton>
                </form>
              ) : (
                <form className="form-stack" onSubmit={vincularGoogle}>
                  <label className="field">
                    <span>Contraseña de tu cuenta de Veto *</span>
                    <input
                      autoComplete="current-password"
                      className="control"
                      onChange={(event) => setContrasenaGoogle(event.target.value)}
                      required
                      type="password"
                      value={contrasenaGoogle}
                    />
                  </label>
                  {googlePendiente.requiereCodigo && (
                    <label className="field">
                      <span>Código de verificación *</span>
                      <input
                        autoComplete="one-time-code"
                        className="control code-input"
                        inputMode="numeric"
                        maxLength={6}
                        onChange={(event) =>
                          setCodigoGoogle(event.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        required
                        value={codigoGoogle}
                      />
                    </label>
                  )}
                  <VetoButton
                    className="auth-submit"
                    disabled={googlePendiente.requiereCodigo && codigoGoogle.length !== 6}
                    loading={cargando}
                    type="submit"
                  >
                    Vincular e ingresar
                  </VetoButton>
                </form>
              )}
              <button className="text-action" onClick={() => void cancelarGoogle()} type="button">
                Cancelar y volver
              </button>
            </>
          ) : desafio2fa ? (
            <>
              <p className="workspace-card__intro">
                Ingresa el código de seis dígitos de tu aplicación autenticadora para completar el
                inicio de sesión.
              </p>
              {error && (
                <div className="auth-error" role="alert">
                  <strong>No pudimos verificar tu código</strong>
                  <span>{error}</span>
                </div>
              )}
              <form className="form-stack" onSubmit={completarLogin2fa}>
                <label className="field">
                  <span>Código de verificación</span>
                  <input
                    autoComplete="one-time-code"
                    className="control code-input"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) =>
                      setCodigo2fa(event.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    pattern="[0-9]{6}"
                    required
                    value={codigo2fa}
                  />
                </label>
                <VetoButton
                  className="auth-submit"
                  disabled={codigo2fa.length !== 6}
                  loading={cargando}
                  type="submit"
                >
                  Verificar e ingresar
                </VetoButton>
              </form>
              <button
                className="text-action"
                onClick={() => {
                  setDesafio2fa('');
                  setCodigo2fa('');
                  setError('');
                }}
                type="button"
              >
                Volver al inicio de sesión
              </button>
            </>
          ) : (
            <>
              {error && (
                <div className="auth-error" role="alert">
                  <strong>No pudimos iniciar sesión</strong>
                  <span>{error}</span>
                </div>
              )}
              <form className="form-stack" onSubmit={iniciarSesion}>
                <label className="field">
                  <span>Correo electrónico</span>
                  <input
                    autoComplete="email"
                    className="control"
                    name="correo"
                    onChange={(event) => setCorreo(event.target.value)}
                    required
                    type="email"
                    value={correo}
                  />
                </label>
                <label className="field">
                  <span>Contraseña</span>
                  <span className="password-control">
                    <input
                      autoComplete="current-password"
                      className="control"
                      name="contrasena"
                      onChange={(event) => setContrasena(event.target.value)}
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
                </label>
                <div className="auth-form-meta">
                  <Link href="/recuperar-contrasena">¿Olvidaste tu contraseña?</Link>
                </div>
                <VetoButton className="auth-submit" loading={cargando} type="submit">
                  Ingresar
                </VetoButton>
              </form>

              <GoogleAuthButton />
              <p className="auth-footnote">
                ¿Todavía no tienes cuenta? <Link href="/registro">Crea una cuenta</Link>
              </p>
              <p className="auth-footnote">
                ¿Eres aliado? <Link href="/registro/aliado">Regístrate como aliado</Link>
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
