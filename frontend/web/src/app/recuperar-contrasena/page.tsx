'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AlertBox, VetoButton } from '@/components/ui/veto-components';

const pasos = ['Tu correo', 'Código de verificación', 'Nueva contraseña'];

export default function RecuperarContrasena() {
  const [paso, setPaso] = useState(0);
  const [correo, setCorreo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [mensaje, setMensaje] = useState('');

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensaje(
      'El backend aún no expone el flujo para enviar o verificar códigos de recuperación. No se envió ningún correo ni se cambió la contraseña.',
    );
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
                  onClick={() => setPaso(index)}
                  type="button"
                >
                  <span>{index < paso ? '✓' : index + 1}</span>
                  <small>{nombre}</small>
                </button>
              </li>
            ))}
          </ol>
          {mensaje && (
            <AlertBox tone="warning" title="Flujo pendiente de conexión">
              {mensaje}
            </AlertBox>
          )}
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
                  type="button"
                  onClick={() =>
                    setMensaje(
                      'El reenvío del código aún no está disponible porque la API no expone el flujo de recuperación.',
                    )
                  }
                >
                  ¿No recibiste el código? Reenviar
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
            <VetoButton type="submit">
              {paso === 0
                ? 'Enviar código'
                : paso === 1
                  ? 'Verificar código'
                  : 'Guardar contraseña'}
            </VetoButton>
          </form>
          <p className="auth-footnote">
            <Link href="/ingresar">Volver a iniciar sesión</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
