'use client';

import { useEffect, useState } from 'react';
import { API_URL, api } from '@/lib/api';

export function GoogleAuthButton() {
  const [disponible, setDisponible] = useState(false);
  const [verificado, setVerificado] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    void api<{ disponible: boolean }>('/identidad/google/disponible')
      .then(({ disponible: configurado }) => {
        if (vigente) setDisponible(configurado);
      })
      .catch(() => {
        if (vigente) setDisponible(false);
      })
      .finally(() => {
        if (vigente) setVerificado(true);
      });

    return () => {
      vigente = false;
    };
  }, []);

  function iniciar() {
    if (!verificado || !disponible) {
      setError(
        'El acceso con Google todavía no está habilitado en el servidor. Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env y reinicia la API.',
      );
      return;
    }

    window.location.assign(`${API_URL}/identidad/google`);
  }

  return (
    <div className="google-auth-option">
      <div className="auth-divider">
        <span>o</span>
      </div>
      <button
        className="veto-button veto-button--google auth-submit"
        onClick={iniciar}
        type="button"
      >
        <svg aria-hidden="true" className="google-mark" viewBox="0 0 48 48">
          <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
          />
          <path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.27 5.48-4.77 7.18l7.73 6C44.4 37.93 46.98 31.7 46.98 24.55Z"
          />
          <path
            fill="#FBBC05"
            d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.9 23.9 0 0 0 0 21.56l7.98-6.19Z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.15 1.45-4.9 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
          />
        </svg>
        Continuar con Google
      </button>
      {error && (
        <p className="field__hint google-auth-option__message" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
