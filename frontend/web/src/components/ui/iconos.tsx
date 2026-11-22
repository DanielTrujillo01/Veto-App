/**
 * Íconos de línea con el estilo de la iconografía de la ficha de marca: trazo redondeado de
 * 2 px, sin relleno y en `currentColor` (toman el color del texto que los rodea).
 */

import type { ReactNode } from 'react';

type Direccion = 'derecha' | 'izquierda';

export function IconoFlecha({
  direccion = 'derecha',
  tamano = 18,
}: {
  direccion?: Direccion;
  tamano?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      className="icono-linea"
      fill="none"
      height={tamano}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      style={direccion === 'izquierda' ? { transform: 'scaleX(-1)' } : undefined}
      viewBox="0 0 24 24"
      width={tamano}
    >
      <path d="M5 12h13" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function IconoUbicacion({ tamano = 16 }: { tamano?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="icono-linea"
      fill="none"
      height={tamano}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width={tamano}
    >
      <path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}

/** Roseta de "verificado" (acento sage). */
export function IconoVerificado({ tamano = 18 }: { tamano?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="icono-linea"
      fill="none"
      height={tamano}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width={tamano}
    >
      <path d="M12 3l2.2 1.6 2.7-.1.9 2.6 2.2 1.6-.8 2.6.8 2.6-2.2 1.6-.9 2.6-2.7-.1L12 21l-2.2-1.6-2.7.1-.9-2.6-2.2-1.6.8-2.6-.8-2.6 2.2-1.6.9-2.6 2.7.1Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/** Huella con el número del paso (la misma de "Restablece tu contraseña"). */
export function HuellaPaso({ numero, hecho = false }: { numero: number; hecho?: boolean }) {
  return (
    <span className="recovery-step__mark">
      <svg aria-hidden="true" viewBox="0 0 64 64">
        <ellipse cx="19" cy="16" rx="4.6" ry="7" transform="rotate(-27 19 16)" />
        <ellipse cx="31.5" cy="12.5" rx="4.8" ry="7.5" />
        <ellipse cx="44" cy="16" rx="4.6" ry="7" transform="rotate(27 44 16)" />
        <ellipse cx="12.5" cy="28" rx="4.2" ry="6" transform="rotate(-38 12.5 28)" />
        <path d="M17 39c0-7.5 6.7-12 15-12s15 4.5 15 12c0 6.7-4.8 12-15 12S17 45.7 17 39Z" />
      </svg>
      <b>{hecho ? '✓' : numero}</b>
    </span>
  );
}

type PropsIcono = { tamano?: number };

function Linea({ tamano = 22, children }: PropsIcono & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="icono-linea"
      fill="none"
      height={tamano}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width={tamano}
    >
      {children}
    </svg>
  );
}

export function IconoEstetoscopio(props: PropsIcono) {
  return (
    <Linea {...props}>
      <path d="M6 3v5a5 5 0 0 0 10 0V3" />
      <path d="M11 13v2a5 5 0 0 0 10 0v-1" />
      <circle cx="21" cy="12" r="1.6" />
    </Linea>
  );
}

export function IconoJeringa(props: PropsIcono) {
  return (
    <Linea {...props}>
      <path d="m18 2 4 4" />
      <path d="m17 7 3-3" />
      <path d="M19 9 9.5 18.5a2.1 2.1 0 0 1-3 0l-1-1a2.1 2.1 0 0 1 0-3L15 5" />
      <path d="m9 11 4 4" />
      <path d="m5 19-3 3" />
    </Linea>
  );
}

export function IconoHuella(props: PropsIcono) {
  return (
    <Linea {...props}>
      <circle cx="5.5" cy="10" r="1.8" />
      <circle cx="9" cy="5.5" r="1.8" />
      <circle cx="15" cy="5.5" r="1.8" />
      <circle cx="18.5" cy="10" r="1.8" />
      <path d="M12 12c-3 0-5 3-5 5.3 0 1.6 1.2 2.7 2.8 2.7 1 0 1.5-.5 2.2-.5s1.2.5 2.2.5c1.6 0 2.8-1.1 2.8-2.7C17 15 15 12 12 12Z" />
    </Linea>
  );
}

export function IconoCorazon(props: PropsIcono) {
  return (
    <Linea {...props}>
      <path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6a5 5 0 1 1 7.5 6.6Z" />
    </Linea>
  );
}

export function IconoReloj(props: PropsIcono) {
  return (
    <Linea {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Linea>
  );
}

export function IconoCasa(props: PropsIcono) {
  return (
    <Linea {...props}>
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-5h4v5" />
    </Linea>
  );
}

/** Ícono según el tipo de servicio (consulta, vacunas, baño…); corazón para los demás. */
export function IconoTipoServicio({ tipo, tamano }: { tipo: string } & PropsIcono) {
  const t = tipo.toLowerCase();
  if (t.includes('consulta') || t.includes('control')) return <IconoEstetoscopio tamano={tamano} />;
  if (/vacun|esteril|cirug|despara/.test(t)) return <IconoJeringa tamano={tamano} />;
  if (/baño|bano|pelu|grooming|est[eé]tica/.test(t)) return <IconoHuella tamano={tamano} />;
  return <IconoCorazon tamano={tamano} />;
}

export function IconoCarrito(props: PropsIcono) {
  return (
    <Linea {...props}>
      <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20.5 8H6.2" />
      <circle cx="10" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
    </Linea>
  );
}
