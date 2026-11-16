'use client';

import { useEffect, useState } from 'react';
import { prepararVistasPrevias, separarEnlaces, type FotoPreview } from '@/lib/fotos';

type Props = {
  /** Texto del campo: una URL por línea (o separadas por comas). */
  valor: string;
  onChange: (valor: string) => void;
  maximo: number;
  /** Descripción de cada vista previa para lectores de pantalla. */
  descripcionImagen: string;
  error?: string;
  /** Errores de un enlace concreto, por posición (por ejemplo { 0: 'URL inválida' }). */
  erroresPorFoto?: Record<number, string>;
  /** Marca la primera foto como portada (productos, adopción). */
  marcarPortada?: boolean;
  id?: string;
  /** Avisa qué enlaces (por posición) no cargan, para no guardar fotos rotas. */
  onFallidas?: (posiciones: number[]) => void;
};

/**
 * Campo de fotos por enlace con vista previa (§2.7): se pegan enlaces, los de Postimg y Drive se
 * convierten solos y un enlace que no carga se marca sin afectar a los demás.
 * Usa las clases `pet-photo-*` del sistema de diseño (las mismas de "Mis mascotas").
 */
export function FotosEditor({
  valor,
  onChange,
  maximo,
  descripcionImagen,
  error,
  erroresPorFoto = {},
  marcarPortada = false,
  id = 'fotos',
  onFallidas,
}: Props) {
  const [previews, setPreviews] = useState<FotoPreview[]>([]);

  useEffect(() => {
    onFallidas?.(previews.flatMap((foto, posicion) => (foto.estado === 'error' ? [posicion] : [])));
  }, [previews, onFallidas]);

  useEffect(() => {
    let vigente = true;
    const enlaces = separarEnlaces(valor, maximo);
    setPreviews(enlaces.map((original) => ({ original, url: '', estado: 'cargando' as const })));
    void prepararVistasPrevias(enlaces).then((listas) => {
      if (vigente) setPreviews(listas);
    });
    return () => {
      vigente = false;
    };
  }, [valor, maximo]);

  const marcarFallida = (original: string) =>
    setPreviews((actuales) =>
      actuales.map((item) =>
        item.original === original
          ? {
              ...item,
              estado: 'error',
              mensaje:
                'No se pudo cargar la imagen. Verifica que el enlace sea público y apunte a una imagen.',
            }
          : item,
      ),
    );

  const pista = `${id}-pista`;

  return (
    <label className="field">
      <span>Fotos (opcional)</span>
      <textarea
        aria-describedby={pista}
        aria-invalid={Boolean(error) || undefined}
        className="control textarea"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`Pega una URL por línea (máximo ${maximo})`}
        rows={3}
        value={valor}
      />
      <small className="field__hint" id={pista}>
        Pega el enlace de la imagen o el enlace compartido de Postimg/Drive. En Drive, habilita el
        acceso para cualquier persona con el enlace.
        {marcarPortada && ' La primera foto será la portada.'}
      </small>
      {error && <small className="field-error">{error}</small>}
      {previews.length > 0 && (
        <div aria-live="polite" className="pet-photo-previews">
          {previews.map((foto, posicion) => {
            const errorDelEnlace = erroresPorFoto[posicion];
            return (
              <div className="pet-photo-preview" key={foto.original}>
                {foto.estado === 'cargando' ? (
                  <span aria-label="Cargando vista previa" className="skeleton" />
                ) : foto.estado === 'error' ? (
                  <span aria-hidden="true" className="pet-photo-preview__fallback">
                    ♡
                  </span>
                ) : (
                  <img
                    alt={`Vista previa: ${descripcionImagen} ${posicion + 1}`}
                    onError={() => marcarFallida(foto.original)}
                    src={foto.url}
                  />
                )}
                <span>
                  {errorDelEnlace ? (
                    <small className="field-error">{errorDelEnlace}</small>
                  ) : foto.estado === 'error' ? (
                    (foto.mensaje ?? 'No se pudo cargar la imagen; conservamos el enlace.')
                  ) : foto.estado === 'cargando' ? (
                    'Preparando vista previa…'
                  ) : marcarPortada && posicion === 0 ? (
                    'Portada'
                  ) : (
                    'Vista previa'
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </label>
  );
}
