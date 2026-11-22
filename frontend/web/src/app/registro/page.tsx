'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AlertBox, CelularField, VetoButton } from '@/components/ui/veto-components';
import { registroUsuarioSchema, type TipoDocumento } from '@veto/shared';
import { DocumentoFields } from '@/components/DocumentoFields';
import { erroresPorCampo } from '@/lib/errores';
import { api, ApiError } from '@/lib/api';
import { GoogleAuthButton } from '@/components/GoogleAuthButton';

export default function RegistroTutor() {
  const [datos, setDatos] = useState({
    nombre: '',
    tipoDocumento: 'CC' as TipoDocumento,
    numeroDocumento: '',
    celular: '',
    correo: '',
    contrasena: '',
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [acepta, setAcepta] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [registroCompletado, setRegistroCompletado] = useState(false);
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [confirmacion, setConfirmacion] = useState('');
  const contrasenasDistintas = confirmacion.length > 0 && confirmacion !== datos.contrasena;
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
    const erroresConfirmacion: Record<string, string> =
      confirmacion !== datos.contrasena ? { confirmacion: 'Las contraseñas no coinciden.' } : {};
    if (!resultado.success) {
      setErrores({ ...erroresPorCampo(resultado.error), ...erroresConfirmacion });
      return;
    }
    if (erroresConfirmacion.confirmacion) {
      setErrores(erroresConfirmacion);
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
                <DocumentoFields
                  errores={errores}
                  id="registro-documento"
                  numero={datos.numeroDocumento}
                  onChange={(cambio) => setDatos({ ...datos, ...cambio })}
                  required
                  tipo={datos.tipoDocumento}
                />
                <CelularField
                  error={errores.celular}
                  id="registro-celular"
                  label="Celular *"
                  onChange={(celular) => setDatos({ ...datos, celular })}
                  required
                  value={datos.celular}
                />
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
                <label className="field">
                  <span>Confirmar contraseña *</span>
                  <input
                    aria-invalid={contrasenasDistintas || Boolean(errores.confirmacion)}
                    autoComplete="new-password"
                    className={`control${
                      contrasenasDistintas || errores.confirmacion ? ' control--error' : ''
                    }`}
                    onChange={(event) => setConfirmacion(event.target.value)}
                    type={mostrarContrasena ? 'text' : 'password'}
                    value={confirmacion}
                  />
                  {(contrasenasDistintas || errores.confirmacion) && (
                    <small className="field-error">Las contraseñas no coinciden.</small>
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
