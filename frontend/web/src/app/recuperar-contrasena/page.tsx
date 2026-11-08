'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { AlertBox, VetoButton } from '@/components/ui/veto-components';
import { api } from '@/lib/api';

const pasos = ['Tu correo', 'Código de verificación', 'Nueva contraseña'];
const ESPERA_REENVIO_SEGUNDOS = 60;

export default function RecuperarContrasena() {
  const [paso, setPaso] = useState(0);
  const [correo, setCorreo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [tipoMensaje, setTipoMensaje] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const [segundosReenvio, setSegundosReenvio] = useState(0);
  const [disponibilidad, setDisponibilidad] = useState<'cargando' | 'disponible' | 'no-disponible'>(
    'cargando',
  );
  const [cargando, setCargando] = useState(false);
  const [completado, setCompletado] = useState(false);

  useEffect(() => {
    let vigente = true;
    void api<{ disponible: boolean }>('/identidad/recuperacion/disponible')
      .then(({ disponible }) => {
        if (vigente) setDisponibilidad(disponible ? 'disponible' : 'no-disponible');
      })
      .catch(() => {
        if (vigente) setDisponibilidad('no-disponible');
      });

    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    if (segundosReenvio <= 0) return;
    const temporizador = window.setTimeout(
      () => setSegundosReenvio((actual) => Math.max(0, actual - 1)),
      1000,
    );
    return () => window.clearTimeout(temporizador);
  }, [segundosReenvio]);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensaje('');
    setCargando(true);

    try {
      if (paso === 0) {
        await api('/identidad/recuperacion/solicitar', {
          method: 'POST',
          body: JSON.stringify({ correo: correo.trim() }),
        });
        setPaso(1);
        setSegundosReenvio(ESPERA_REENVIO_SEGUNDOS);
        setTipoMensaje('info');
        setMensaje(
          'Si existe una cuenta con ese correo, recibirás un código. Revisa también la carpeta de correo no deseado.',
        );
      } else if (paso === 1) {
        await api('/identidad/recuperacion/verificar', {
          method: 'POST',
          body: JSON.stringify({ correo: correo.trim(), codigo }),
        });
        setPaso(2);
      } else {
        if (nueva !== confirmacion) {
          setTipoMensaje('error');
          setMensaje('Las contraseñas no coinciden.');
          return;
        }
        await api('/identidad/recuperacion/restablecer', {
          method: 'POST',
          body: JSON.stringify({ contrasena: nueva }),
        });
        setCompletado(true);
        setTipoMensaje('success');
        setMensaje('Tu contraseña fue actualizada. Ya puedes iniciar sesión con ella.');
      }
    } catch (error) {
      setTipoMensaje('error');
      setMensaje(error instanceof Error ? error.message : 'No pudimos completar la solicitud.');
    } finally {
      setCargando(false);
    }
  }

  async function reenviarCodigo() {
    setMensaje('');
    setCargando(true);
    try {
      await api('/identidad/recuperacion/solicitar', {
        method: 'POST',
        body: JSON.stringify({ correo: correo.trim() }),
      });
      setSegundosReenvio(ESPERA_REENVIO_SEGUNDOS);
      setTipoMensaje('info');
      setMensaje(
        'Si existe una cuenta con ese correo, recibirás un nuevo código. Revisa tu correo no deseado.',
      );
    } catch (error) {
      setTipoMensaje('error');
      setMensaje(error instanceof Error ? error.message : 'No pudimos reenviar el código.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="auth-page auth-page--centered auth-page--recovery">
      <section aria-labelledby="recovery-title" className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-card__brandline auth-card__brandline--recovery">
            <span aria-hidden="true" className="auth-card__brand-icon auth-card__brand-icon--sage">
              <svg fill="none" viewBox="0 0 32 32">
                <rect height="21" rx="4" width="18" x="7" y="7" />
                <path d="M11 7V4m10 3V4M7 13h18m-14 5h4m-4 4h8" />
                <path d="m20 20 1.5 1.5L25 18" />
              </svg>
            </span>
            <span>VOLVAMOS A CONECTAR</span>
            <i aria-hidden="true">✳</i>
          </div>
          <p className="eyebrow eyebrow--dark">RECUPERA TU ACCESO</p>
          <h1 id="recovery-title">Restablece tu contraseña</h1>
          <p className="auth-intro">Te guiaremos paso a paso para proteger tu cuenta.</p>
          <ol className="recovery-steps">
            {pasos.map((nombre, index) => (
              <li
                className={index === paso ? 'is-active' : index < paso ? 'is-complete' : ''}
                key={nombre}
              >
                <button
                  aria-current={index === paso ? 'step' : undefined}
                  disabled={index > paso}
                  onClick={() => setPaso(index)}
                  type="button"
                >
                  <span className="recovery-step__mark">
                    <svg aria-hidden="true" viewBox="0 0 64 64">
                      <ellipse cx="19" cy="16" rx="4.6" ry="7" transform="rotate(-27 19 16)" />
                      <ellipse cx="31.5" cy="12.5" rx="4.8" ry="7.5" />
                      <ellipse cx="44" cy="16" rx="4.6" ry="7" transform="rotate(27 44 16)" />
                      <ellipse cx="12.5" cy="28" rx="4.2" ry="6" transform="rotate(-38 12.5 28)" />
                      <path d="M17 39c0-7.5 6.7-12 15-12s15 4.5 15 12c0 6.7-4.8 12-15 12S17 45.7 17 39Z" />
                    </svg>
                    <b>{index < paso ? '✓' : index + 1}</b>
                  </span>
                  <small>{nombre}</small>
                </button>
              </li>
            ))}
          </ol>
          {disponibilidad === 'no-disponible' && !mensaje && (
            <AlertBox tone="warning" title="Recuperación no disponible">
              No pudimos conectar con el servicio o el correo SMTP aún no está configurado.
              Inténtalo más tarde o contacta al equipo de Veto.
            </AlertBox>
          )}
          {mensaje && (
            <AlertBox
              tone={tipoMensaje}
              title={
                tipoMensaje === 'error'
                  ? 'No pudimos completar la solicitud'
                  : tipoMensaje === 'success'
                    ? 'Contraseña actualizada'
                    : 'Revisa tu correo'
              }
            >
              {mensaje}
            </AlertBox>
          )}
          {completado ? (
            <div className="form-stack">
              <Link className="veto-button veto-button--primary auth-submit" href="/ingresar">
                Ir a iniciar sesión
              </Link>
            </div>
          ) : (
            <form className="form-stack" onSubmit={enviar}>
              {paso === 0 ? (
                <label className="field">
                  <span>Correo electrónico</span>
                  <input
                    autoComplete="email"
                    className="control"
                    onChange={(event) => setCorreo(event.target.value)}
                    required
                    type="email"
                    value={correo}
                  />
                </label>
              ) : paso === 1 ? (
                <>
                  <p className="workspace-card__intro">
                    Ingresa el código de seis dígitos enviado a {correo || 'tu correo'}.
                  </p>
                  <label className="field">
                    <span>Código de verificación</span>
                    <input
                      autoComplete="one-time-code"
                      className="control code-input"
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(event) => setCodigo(event.target.value.replace(/\D/g, ''))}
                      required
                      value={codigo}
                    />
                  </label>
                  <button
                    className="text-action"
                    disabled={cargando || segundosReenvio > 0}
                    type="button"
                    onClick={() => void reenviarCodigo()}
                  >
                    {segundosReenvio > 0
                      ? `Reenviar código en ${segundosReenvio}s`
                      : '¿No recibiste el código? Reenviar'}
                  </button>
                </>
              ) : (
                <>
                  <label className="field">
                    <span>Nueva contraseña</span>
                    <input
                      autoComplete="new-password"
                      className="control"
                      minLength={8}
                      onChange={(event) => setNueva(event.target.value)}
                      required
                      type="password"
                      value={nueva}
                    />
                  </label>
                  <label className="field">
                    <span>Confirma tu nueva contraseña</span>
                    <input
                      autoComplete="new-password"
                      className="control"
                      onChange={(event) => setConfirmacion(event.target.value)}
                      required
                      type="password"
                      value={confirmacion}
                    />
                  </label>
                  {nueva && confirmacion && nueva !== confirmacion && (
                    <small className="field-error">Las contraseñas no coinciden.</small>
                  )}
                </>
              )}
              <VetoButton loading={cargando} type="submit">
                {paso === 0
                  ? 'Enviar código'
                  : paso === 1
                    ? 'Verificar código'
                    : 'Guardar contraseña'}
              </VetoButton>
            </form>
          )}
          <p className="auth-footnote">
            <Link href="/ingresar">Volver a iniciar sesión</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
