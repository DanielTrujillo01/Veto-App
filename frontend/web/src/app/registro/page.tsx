'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AlertBox, VetoButton } from '@/components/ui/veto-components';
import { registroUsuarioSchema } from '@veto/shared';
import { erroresPorCampo } from '@/lib/errores';
import { api, ApiError } from '@/lib/api';
import { GoogleAuthButton } from '@/components/GoogleAuthButton';

export default function RegistroTutor() {
  const [datos, setDatos] = useState({ nombre: '', celular: '', correo: '', contrasena: '' });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [acepta, setAcepta] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [registroCompletado, setRegistroCompletado] = useState(false);
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const fortaleza = [
    datos.contrasena.length >= 8,
    /[A-Z]/.test(datos.contrasena),
    /\d/.test(datos.contrasena),
    /[^A-Za-z0-9]/.test(datos.contrasena),
  ].filter(Boolean).length;

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const resultado = registroUsuarioSchema.safeParse(datos);
    if (!resultado.success) {
      setErrores(erroresPorCampo(resultado.error));
      return;
    }
    if (!acepta) {
      setErrores({ terminos: 'Debes aceptar los términos y la política de privacidad.' });
      return;
    }
    setErrores({});
    setCargando(true);
    try {
      await api('/usuarios', {
        method: 'POST',
        body: JSON.stringify(resultado.data),
      });
      setRegistroCompletado(true);
    } catch (causa) {
      setError(
        causa instanceof ApiError
          ? causa.status === 404
            ? 'La API conectada todavía no expone el registro de tutores (HU-001). Actualiza el backend a develop e inténtalo de nuevo.'
            : causa.message
          : 'No pudimos crear tu cuenta. Revisa que la API esté disponible e inténtalo de nuevo.',
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="auth-page auth-page--centered">
      <section aria-labelledby="register-title" className="auth-form-panel">
        <div className="auth-card auth-card--wide">
          <div className="auth-card__brandline">
            <span aria-hidden="true" className="auth-card__brand-icon auth-card__brand-icon--peach">
              <svg fill="none" viewBox="0 0 32 32">
                <path d="M16 27s-11-6.7-11-15a6.1 6.1 0 0 1 11-3.7A6.1 6.1 0 0 1 27 12c0 8.3-11 15-11 15Z" />
                <path d="M10 16h4l2-4 3 8 2-4h2" />
              </svg>
            </span>
            <span>EMPECEMOS CON SU BIENESTAR</span>
            <i aria-hidden="true">✿</i>
          </div>
          <p className="eyebrow eyebrow--dark">PARA TUTORES</p>
          <h1 id="register-title">Crea tu cuenta</h1>
          <p className="auth-intro">Un solo lugar para organizar todo lo que necesita.</p>
          {registroCompletado ? (
            <>
              <AlertBox tone="success" title="Tu cuenta está lista">
                Ya puedes iniciar sesión con el correo que registraste.
              </AlertBox>
              <Link className="veto-button veto-button--primary auth-submit" href="/ingresar">
                Iniciar sesión
              </Link>
            </>
          ) : (
            <>
              {error && (
                <div className="auth-error" role="alert">
                  <strong>No pudimos crear tu cuenta</strong>
                  <span>{error}</span>
                </div>
              )}
              <form className="form-stack" onSubmit={enviar} noValidate>
                <label className="field">
                  <span>Nombre completo *</span>
                  <input
                    autoComplete="name"
                    className={`control${errores.nombre ? ' control--error' : ''}`}
                    onChange={(event) => setDatos({ ...datos, nombre: event.target.value })}
                    value={datos.nombre}
                  />
                  {errores.nombre && <small className="field-error">{errores.nombre}</small>}
                </label>
                <label className="field">
                  <span>Celular *</span>
                  <span className="phone-control">
                    <span className="phone-prefix">+57</span>
                    <input
                      autoComplete="tel-national"
                      className={`control${errores.celular ? ' control--error' : ''}`}
                      inputMode="numeric"
                      maxLength={10}
                      onChange={(event) =>
                        setDatos({ ...datos, celular: event.target.value.replace(/\D/g, '') })
                      }
                      placeholder="300 123 4567"
                      value={datos.celular}
                    />
                  </span>
                  {errores.celular && <small className="field-error">{errores.celular}</small>}
                </label>
                <label className="field">
                  <span>Correo electrónico *</span>
                  <input
                    autoComplete="email"
                    className={`control${errores.correo ? ' control--error' : ''}`}
                    onChange={(event) => setDatos({ ...datos, correo: event.target.value })}
                    type="email"
                    value={datos.correo}
                  />
                  {errores.correo && <small className="field-error">{errores.correo}</small>}
                </label>
                <label className="field">
                  <span>Contraseña *</span>
                  <span className="password-control">
                    <input
                      autoComplete="new-password"
                      className={`control${errores.contrasena ? ' control--error' : ''}`}
                      minLength={8}
                      onChange={(event) => setDatos({ ...datos, contrasena: event.target.value })}
                      type={mostrarContrasena ? 'text' : 'password'}
                      value={datos.contrasena}
                    />
                    <button
                      aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="password-toggle"
                      onClick={() => setMostrarContrasena(!mostrarContrasena)}
                      type="button"
                    >
                      {mostrarContrasena ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </span>
                  <small className="field__hint">Usa al menos 8 caracteres.</small>
                  <span className="password-strength" aria-live="polite">
                    <span
                      className={`password-strength__meter password-strength__meter--${fortaleza}`}
                    />
                    Fortaleza: {fortaleza < 2 ? 'débil' : fortaleza < 4 ? 'media' : 'fuerte'}
                  </span>
                  {errores.contrasena && (
                    <small className="field-error">{errores.contrasena}</small>
                  )}
                </label>
                <label className="auth-check">
                  <input
                    checked={acepta}
                    onChange={(event) => setAcepta(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    Acepto los términos y la política de privacidad conforme a la Ley 1581 de 2012.
                  </span>
                </label>
                {errores.terminos && <small className="field-error">{errores.terminos}</small>}
                <VetoButton className="auth-submit" loading={cargando} type="submit">
                  Crear cuenta
                </VetoButton>
              </form>
              <GoogleAuthButton />
            </>
          )}
          <p className="auth-footnote">
            ¿Ya tienes cuenta? <Link href="/ingresar">Ingresa</Link>
          </p>
          <p className="auth-footnote">
            ¿Eres veterinaria, tienda o fundación?{' '}
            <Link href="/registro/aliado">Regístrate como aliado</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
