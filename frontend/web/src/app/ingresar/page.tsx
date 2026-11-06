'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AlertBox, VetoButton } from '@/components/ui/veto-components';
import { api, ApiError } from '@/lib/api';
import { notificarCambioSesion } from '@/lib/session';

type Usuario = { id: string; nombre: string; rol: string };
type RespuestaLogin =
  { usuario: Usuario } | { requiere2fa: true; desafio: string; expiraEn: string };

export default function Ingresar() {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [desafio2fa, setDesafio2fa] = useState('');
  const [codigo2fa, setCodigo2fa] = useState('');

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

  return (
    <div className="auth-page auth-page--centered auth-page--login">
      <section aria-labelledby="login-title" className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-card__brandline">
            <span aria-hidden="true" className="auth-card__brand-icon">
              <svg fill="none" viewBox="0 0 32 32">
                <path d="M10 15.5c1.5 0 2.6-1.8 2.6-3.7S11.5 8.4 10 8.4 7.4 10 7.4 11.8s1.1 3.7 2.6 3.7Zm12 0c1.5 0 2.6-1.8 2.6-3.7S23.5 8.4 22 8.4s-2.6 1.6-2.6 3.4 1.1 3.7 2.6 3.7ZM5.4 20.2c0-2.1 1.3-3.5 3-3.5 1.2 0 2.1.8 2.8 1.7.9-1 2.2-1.8 3.6-1.8s2.7.8 3.6 1.8c.7-.9 1.6-1.7 2.8-1.7 1.7 0 3 1.4 3 3.5 0 3-3.8 5.8-9.4 5.8s-9.4-2.8-9.4-5.8Z" />
              </svg>
            </span>
            <span>UN LUGAR PARA CUIDARLOS MEJOR</span>
            <i aria-hidden="true">✳</i>
          </div>
          <p className="eyebrow eyebrow--dark">QUÉ BUENO TENERTE DE VUELTA</p>
          <h1 id="login-title">Inicia sesión</h1>
          <p className="auth-intro">Ingresa para continuar cuidando de tu mascota.</p>

          {usuario ? (
            <>
              <AlertBox tone="success" title={`¡Hola, ${usuario.nombre}!`}>
                Iniciaste sesión correctamente. Tu sesión segura ya está activa.
              </AlertBox>
              <Link
                className="veto-button veto-button--primary auth-submit"
                href={
                  usuario.rol === 'VETERINARIO'
                    ? '/panel/veterinario'
                    : usuario.rol === 'ALIADO'
                      ? '/panel/aliado'
                      : '/mascotas'
                }
              >
                Continuar
              </Link>
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

              <div className="auth-divider">
                <span>o</span>
              </div>
              <button
                className="veto-button veto-button--google auth-submit"
                onClick={() =>
                  setError('El acceso con Google es opcional y aún no está configurado.')
                }
                type="button"
              >
                <span aria-hidden="true">G</span>
                Continuar con Google
              </button>
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
