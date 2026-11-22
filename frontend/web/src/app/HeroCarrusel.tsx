'use client';

/**
 * Carrusel del inicio: varias diapositivas con el mismo diseño de marca (crema, formas
 * orgánicas, foto y nota) y un mensaje distinto en cada una, para que la portada se sienta viva.
 *
 * Fotos: Unsplash (licencia gratuita de Unsplash, uso comercial sin atribución obligatoria).
 *
 * Cada diapositiva acomoda el collage de forma distinta (home-slide--d1…d4), para que no se
 * sienta como la misma forma cambiando de imagen.
 *
 * El botón "Explorar servicios" es fijo; solo cambian el texto y la foto, de forma automática.
 *
 * Accesibilidad: avanza solo cada 9 s y se pausa con el botón o al navegar con el teclado,
 * tiene botón de pausa (WCAG 2.2.2) y puntos para saltar a una diapositiva; con "reducir movimiento" no
 * avanza solo. Las diapositivas ocultas quedan fuera del lector de pantalla y del tabulador.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const INTERVALO_MS = 9000;

type Diapositiva = {
  eyebrow: string;
  titulo: string;
  acento: string;
  texto: string;
  foto: Foto;
  nota: { titulo: string; texto: string };
  /** Dos fotos medianas debajo de la principal (collage). */
  extras: [Foto, Foto];
};

/** `encuadre` es el object-position: deja a la vista la cara del animal en vez de cortarla. */
type Foto = { src: string; alt: string; encuadre?: string };

const DIAPOSITIVAS: Diapositiva[] = [
  {
    eyebrow: 'BIENESTAR PARA QUIENES MÁS QUIERES',
    titulo: 'Todo para el cuidado',
    acento: 'de tu mascota.',
    texto: 'Profesionales de confianza, servicios y mucho cariño. Todo en un solo lugar.',
    foto: {
      src: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?auto=format&fit=crop&w=1100&q=85',
      alt: 'Perro feliz disfrutando tiempo al aire libre',
    },
    nota: { titulo: 'Se merece lo mejor', texto: 'Te ayudamos a encontrarlo.' },
    extras: [
      {
        src: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80',
        alt: 'Gato tranquilo disfrutando de una caricia',
      },
      {
        src: 'https://images.unsplash.com/photo-1632498301446-5f78baad40d0?auto=format&fit=crop&w=600&q=80',
        alt: 'Mujer besando a su perro golden',
      },
    ],
  },
  {
    eyebrow: 'CLÍNICAS ALIADAS',
    titulo: 'Equipos que cuidan',
    acento: 'como tú lo harías.',
    texto: 'Conoce clínicas verificadas, sus veterinarios y sedes, y agenda la cita en minutos.',
    foto: {
      src: 'https://images.unsplash.com/photo-1770836037793-95bdbf190f71?auto=format&fit=crop&w=1100&q=80',
      alt: 'Veterinario revisando a un perro salchicha en consulta',
    },
    nota: { titulo: 'Aliados verificados', texto: 'Revisados por el equipo de Veto.' },
    extras: [
      {
        src: 'https://images.unsplash.com/photo-1529778873920-4da4926a72c2?auto=format&fit=crop&w=600&q=80',
        alt: 'Gatito atigrado sentado',
      },
      {
        src: 'https://images.unsplash.com/photo-1586671267731-da2cf3ceeb80?auto=format&fit=crop&w=600&q=80',
        alt: 'Cachorro labrador mirando hacia arriba',
      },
    ],
  },
  {
    eyebrow: 'LA TIENDA DE VETO',
    titulo: 'Lo que necesita,',
    acento: 'sin salir de casa.',
    texto: 'Alimento, accesorios e higiene de tiendas aliadas, con precios claros.',
    foto: {
      src: 'https://images.unsplash.com/photo-1591946614720-90a587da4a36?auto=format&fit=crop&w=1100&q=80',
      alt: 'Perro feliz con un juguete de peluche en la boca',
    },
    nota: { titulo: 'Pequeños detalles', texto: 'Grandes colas felices.' },
    extras: [
      {
        src: 'https://images.unsplash.com/photo-1767023024653-3d6f74909ccf?auto=format&fit=crop&w=600&q=80',
        alt: 'Bulldog francés comiendo de su plato',
      },
      {
        src: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=600&q=80',
        alt: 'Gato naranja y blanco',
      },
    ],
  },
  {
    eyebrow: 'ADOPTAR CAMBIA DOS VIDAS',
    titulo: 'Un hogar lleno de amor',
    acento: 'los está esperando.',
    texto: 'Mascotas de fundaciones aliadas que buscan familia. Conoce su historia.',
    foto: {
      src: 'https://images.unsplash.com/photo-1594004844563-536a03a6e532?auto=format&fit=crop&w=1100&q=80',
      alt: 'Mano acariciando a un cachorro que busca hogar',
    },
    nota: { titulo: 'Amor a primera patita', texto: 'Adopta con acompañamiento.' },
    extras: [
      {
        src: 'https://images.unsplash.com/photo-1577175826207-5052ccbf89e8?auto=format&fit=crop&w=600&q=80',
        alt: 'Mujer abrazando a un cachorro',
      },
      {
        src: 'https://images.unsplash.com/photo-1560114928-40f1f1eb26a0?auto=format&fit=crop&w=600&q=80',
        alt: 'Gatito naranja entre la hierba',
      },
    ],
  },
];

export function HeroCarrusel() {
  const [actual, setActual] = useState(0);
  const [pausado, setPausado] = useState(false);
  /** Se navega con el teclado dentro del carrusel (no al hacer clic): se detiene. */
  const [conTeclado, setConTeclado] = useState(false);
  const [sinMovimiento, setSinMovimiento] = useState(false);
  const total = DIAPOSITIVAS.length;
  /** Avance de la diapositiva actual, de 0 a 1. Se conserva al pausar y continúa al reanudar. */
  const progreso = useRef(0);
  const barra = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const consulta = window.matchMedia('(prefers-reduced-motion: reduce)');
    const actualizar = () => setSinMovimiento(consulta.matches);
    actualizar();
    consulta.addEventListener('change', actualizar);
    return () => consulta.removeEventListener('change', actualizar);
  }, []);

  const ir = useCallback(
    (indice: number) => {
      progreso.current = 0;
      setActual((indice + total) % total);
    },
    [total],
  );

  const avanzando = !pausado && !conTeclado && !sinMovimiento;

  // Un solo reloj para el avance y la barra, así nunca se desincronizan: la barra muestra
  // exactamente el tiempo transcurrido y la diapositiva cambia cuando llega al final.
  useEffect(() => {
    let anterior = performance.now();
    const paso = () => {
      const ahora = performance.now();
      if (avanzando) {
        progreso.current += (ahora - anterior) / INTERVALO_MS;
        if (progreso.current >= 1) {
          progreso.current = 0;
          setActual((indice) => (indice + 1) % total);
        }
      }
      anterior = ahora;
      if (barra.current) {
        const avance = sinMovimiento ? 1 : Math.min(progreso.current, 1);
        barra.current.style.width = `${avance * 100}%`;
      }
    };
    paso();
    const reloj = window.setInterval(paso, 100);
    return () => window.clearInterval(reloj);
  }, [avanzando, sinMovimiento, total]);

  return (
    <section
      aria-label="Destacados de Veto"
      aria-roledescription="carrusel"
      className="home-hero home-hero--carrusel"
      onBlur={(evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget)) setConTeclado(false);
      }}
      onFocus={(evento) => setConTeclado(evento.target.matches(':focus-visible'))}
    >
      <div aria-hidden="true" className="home-hero__decoration">
        <span className="home-hero__ring home-hero__ring--one" />
        <span className="home-hero__ring home-hero__ring--two" />
        {/* Formas orgánicas de la ficha. Esta pasa detrás del título: va transparente. */}
        <span className="home-blob home-blob--texto" />
        <span className="home-hero__spark">✳</span>
      </div>

      <div className="home-slides" aria-live={avanzando ? 'off' : 'polite'}>
        {DIAPOSITIVAS.map((diapositiva, indice) => {
          const activa = indice === actual;
          const Titulo = indice === 0 ? 'h1' : 'h2';
          return (
            <div
              aria-hidden={!activa}
              aria-label={`${indice + 1} de ${total}`}
              aria-roledescription="diapositiva"
              className={`home-slide home-slide--d${(indice % 4) + 1}${activa ? ' is-active' : ''}`}
              inert={!activa}
              key={diapositiva.titulo}
              role="group"
            >
              <div className="home-hero__copy">
                <span className="eyebrow eyebrow--dark">
                  <i /> {diapositiva.eyebrow}
                </span>
                <Titulo className="home-slide__title" id={indice === 0 ? 'home-title' : undefined}>
                  {diapositiva.titulo} <em>{diapositiva.acento}</em>
                </Titulo>
                <p>{diapositiva.texto}</p>
              </div>
              <div className="home-hero__visual">
                {/* Detrás de la foto no hay texto: colores sólidos, como en la ficha. */}
                <span aria-hidden="true" className="home-blob home-blob--peach" />
                <span aria-hidden="true" className="home-blob home-blob--miel" />
                <div className="home-hero__photo">
                  <img
                    alt={diapositiva.foto.alt}
                    src={diapositiva.foto.src}
                    style={{ objectPosition: diapositiva.foto.encuadre ?? 'center 30%' }}
                  />
                </div>
                {diapositiva.extras.map((extra, posicion) => (
                  <div
                    className={`home-hero__extra home-hero__extra--${posicion + 1}`}
                    key={extra.src}
                  >
                    <img
                      alt={extra.alt}
                      src={extra.src}
                      style={{ objectPosition: extra.encuadre ?? 'center 30%' }}
                    />
                  </div>
                ))}
                <div className="home-photo-note">
                  <span aria-hidden="true">♡</span>
                  <div>
                    <strong>{diapositiva.nota.titulo}</strong>
                    <small>{diapositiva.nota.texto}</small>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="home-carousel__controls">
        <a
          className="veto-button veto-button--primary"
          href="#por-donde-empezamos"
          onClick={(evento) => {
            const destino = document.getElementById('por-donde-empezamos');
            if (!destino) return;
            evento.preventDefault();
            destino.scrollIntoView({ behavior: sinMovimiento ? 'auto' : 'smooth', block: 'start' });
          }}
        >
          Explorar servicios
        </a>
        <div aria-label="Elegir destacado" className="home-carousel__dots" role="group">
          {DIAPOSITIVAS.map((diapositiva, indice) => (
            <button
              aria-current={indice === actual ? 'true' : undefined}
              aria-label={`Ir al destacado ${indice + 1}: ${diapositiva.eyebrow.toLowerCase()}`}
              className={`home-carousel__dot${indice === actual ? ' is-active' : ''}`}
              key={diapositiva.titulo}
              onClick={() => ir(indice)}
              type="button"
            >
              {/* Solo la barra del activo avanza; la mueve el reloj del carrusel. */}
              <span
                ref={indice === actual ? barra : undefined}
                style={indice === actual ? undefined : { width: 0 }}
              />
            </button>
          ))}
        </div>
        {!sinMovimiento && (
          <button
            aria-label={pausado ? 'Reanudar el carrusel' : 'Pausar el carrusel'}
            aria-pressed={pausado}
            className="home-carousel__pause"
            onClick={() => setPausado((valor) => !valor)}
            type="button"
          >
            {pausado ? (
              <svg aria-hidden="true" height="14" viewBox="0 0 24 24" width="14">
                <path d="M7 5v14l12-7Z" fill="currentColor" />
              </svg>
            ) : (
              <svg aria-hidden="true" height="14" viewBox="0 0 24 24" width="14">
                <path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" />
              </svg>
            )}
          </button>
        )}
      </div>
    </section>
  );
}
