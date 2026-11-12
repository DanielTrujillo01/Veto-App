type LogoPlaceholderProps = {
  inverse?: boolean;
};

function LogoPlaceholder({ inverse = false }: LogoPlaceholderProps) {
  return (
    <div
      className={`logo-placeholder ${inverse ? 'logo-placeholder--inverse' : ''}`}
      aria-label="Logo provisional de Veto"
    >
      <div className="logo-placeholder__mark" aria-hidden="true">
        <span className="logo-placeholder__ear logo-placeholder__ear--left" />
        <span className="logo-placeholder__ear logo-placeholder__ear--right" />
        <span className="logo-placeholder__v">V</span>
      </div>

      <div className="logo-placeholder__name" aria-hidden="true">
        vet
        <span className="logo-placeholder__paw">
          <span className="logo-placeholder__pad" />
          <span className="logo-placeholder__toe logo-placeholder__toe--one" />
          <span className="logo-placeholder__toe logo-placeholder__toe--two" />
          <span className="logo-placeholder__toe logo-placeholder__toe--three" />
        </span>
      </div>
    </div>
  );
}

const colors = [
  {
    name: 'Veto Burgundy',
    hex: '#6A0C18',
    use: 'Principal · Botones primarios, links, títulos importantes e íconos activos.',
    className: 'color-swatch--burgundy',
  },
  {
    name: 'Peach',
    hex: '#FF8A5B',
    use: 'Secundario · Acentos, badges, hover de tarjetas e ilustraciones.',
    note: 'Usar Ink para el texto. Nunca texto pequeño Peach sobre crema.',
    className: 'color-swatch--peach',
  },
  {
    name: 'Sage',
    hex: '#A7C957',
    use: 'Acento · Estados activos, confirmados y aprobados, chips de especie y éxito.',
    note: 'Usar siempre Ink para el texto.',
    className: 'color-swatch--sage',
  },
  {
    name: 'Crema',
    hex: '#FFF6EE',
    use: 'Base · Fondo general de la aplicación.',
    className: 'color-swatch--cream',
  },
  {
    name: 'Ink',
    hex: '#1E1E1E',
    use: 'Contenido · Texto principal y texto sobre Peach, Sage y Amarillo miel.',
    className: 'color-swatch--ink',
  },
  {
    name: 'Rojo oscuro',
    hex: '#4E0A12',
    use: 'Interacción · Hover y estado presionado de Veto Burgundy.',
    className: 'color-swatch--dark-red',
  },
  {
    name: 'Rosa soft',
    hex: '#FAD2CF',
    use: 'Apoyo · Fondos de alertas suaves y avatares.',
    className: 'color-swatch--soft-pink',
  },
  {
    name: 'Amarillo miel',
    hex: '#FFC857',
    use: 'Estado · Pendientes y advertencias.',
    className: 'color-swatch--honey',
  },
  {
    name: 'Verde suave',
    hex: '#DCE9C6',
    use: 'Apoyo · Fondos para mensajes y bloques de éxito.',
    className: 'color-swatch--soft-green',
  },
  {
    name: 'Taupe',
    hex: '#C9C1B6',
    use: 'Estructura · Bordes, divisores y elementos deshabilitados.',
    className: 'color-swatch--taupe',
  },
  {
    name: 'Blanco',
    hex: '#FFFFFF',
    use: 'Superficie · Tarjetas sobre el fondo crema, con borde Taupe al 40%.',
    className: 'color-swatch--white',
  },
  {
    name: 'Error',
    hex: '#B3261E',
    use: 'Sistema · Exclusivo para errores de formulario; nunca reemplaza al Burgundy.',
    className: 'color-swatch--error',
  },
];

type PetIconName =
  'stethoscope' | 'syringe' | 'heart-paw' | 'paw' | 'home' | 'food' | 'calendar-paw';

function PetIcon({ name, size }: { name: PetIconName; size: 24 | 32 }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.5,
  };

  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 32 32" width={size} {...common}>
      {name === 'stethoscope' && (
        <>
          <path d="M7 4v7a6 6 0 0 0 12 0V4" />
          <path d="M4.5 4h5M16.5 4h5M13 17v2.5a6.5 6.5 0 0 0 13 0v-1" />
          <circle cx="26" cy="15.5" r="2.5" />
        </>
      )}
      {name === 'syringe' && (
        <>
          <path d="m11 21 10-10M9 17l6 6M18 8l6 6M21 5l6 6M8 24l-3 3M5 27l-1 1" />
          <path d="m12 25-5-5L21 6l5 5Z" />
        </>
      )}
      {name === 'heart-paw' && (
        <>
          <path d="M16 27S5 21 5 12.5A6 6 0 0 1 16 9a6 6 0 0 1 11 3.5C27 21 16 27 16 27Z" />
          <ellipse cx="16" cy="17.5" rx="3.2" ry="2.7" />
          <circle cx="11.8" cy="14" r="1.2" />
          <circle cx="16" cy="12.7" r="1.2" />
          <circle cx="20.2" cy="14" r="1.2" />
        </>
      )}
      {name === 'paw' && (
        <>
          <path d="M10.5 25c-2.4-1.7-1.6-5.5.8-7.5l1.6-1.3a4.8 4.8 0 0 1 6.2 0l1.6 1.3c2.4 2 3.2 5.8.8 7.5-2 1.4-3.6-.1-5.5-.1s-3.5 1.5-5.5.1Z" />
          <ellipse cx="8" cy="13" rx="2.5" ry="3" />
          <ellipse cx="14" cy="8.5" rx="2.5" ry="3" />
          <ellipse cx="20" cy="8.5" rx="2.5" ry="3" />
          <ellipse cx="26" cy="13" rx="2.5" ry="3" />
        </>
      )}
      {name === 'home' && (
        <>
          <path d="m4 14 12-10 12 10" />
          <path d="M7 12.5V28h18V12.5M13 28v-8h6v8" />
        </>
      )}
      {name === 'food' && (
        <>
          <path d="M5 17h22l-2.5 10h-17Z" />
          <path d="M8 17c.8-4.2 3.4-6 8-6s7.2 1.8 8 6" />
          <circle cx="12" cy="8" r="1.5" />
          <circle cx="17" cy="5" r="1.5" />
          <circle cx="22" cy="8" r="1.5" />
        </>
      )}
      {name === 'calendar-paw' && (
        <>
          <rect height="23" rx="3" width="24" x="4" y="6" />
          <path d="M4 12h24M10 3v6M22 3v6" />
          <path d="M12.5 24c-1.3-.9-.8-3 .4-4l.8-.7a3.6 3.6 0 0 1 4.6 0l.8.7c1.2 1 1.7 3.1.4 4-1 .7-2-.1-3.5-.1s-2.5.8-3.5.1Z" />
          <circle cx="13" cy="17" r=".8" />
          <circle cx="16" cy="16" r=".8" />
          <circle cx="19" cy="17" r=".8" />
        </>
      )}
    </svg>
  );
}

const iconSet: { name: PetIconName; label: string }[] = [
  { name: 'stethoscope', label: 'Estetoscopio' },
  { name: 'syringe', label: 'Jeringa' },
  { name: 'heart-paw', label: 'Corazón con pata' },
  { name: 'paw', label: 'Pata' },
  { name: 'home', label: 'Casa' },
  { name: 'food', label: 'Plato de comida' },
  { name: 'calendar-paw', label: 'Calendario con pata' },
];

export default function DesignSystem() {
  return (
    <main className="identity-page">
      <section className="identity-hero">
        <div className="identity-hero__glow" aria-hidden="true" />

        <header className="identity-header">
          <LogoPlaceholder />
          <span className="identity-header__label">Identidad de marca</span>
        </header>

        <div className="identity-hero__content">
          <p className="identity-kicker">Veto · Bogotá, Colombia</p>
          <h1>
            Cuidamos
            <br />
            lo que amas
          </h1>
          <p className="identity-message">
            Salud, bienestar
            <br />y más vida juntos.
          </p>
        </div>

        <p className="identity-intro">
          Una marca cercana y confiable que conecta a quienes aman a sus mascotas con quienes saben
          cuidarlas.
        </p>
      </section>

      <section className="logo-showcase" aria-labelledby="logo-showcase-title">
        <div className="logo-showcase__heading">
          <p className="identity-kicker">Logo principal</p>
          <h2 id="logo-showcase-title">Dos versiones, una misma esencia.</h2>
          <p>
            Aplicaciones temporales del stateholder de marca mientras se incorpora el archivo
            original del logo.
          </p>
        </div>

        <div className="logo-grid">
          <article className="logo-card logo-card--light">
            <span className="logo-card__caption">Sobre fondo claro</span>
            <div className="logo-card__center">
              <LogoPlaceholder />
              <p>CUIDAMOS LO QUE AMAS</p>
            </div>
            <span className="logo-card__variant">Burgundy / crema</span>
          </article>

          <article className="logo-card logo-card--dark">
            <span className="logo-card__caption">Sobre fondo oscuro</span>
            <div className="logo-card__center">
              <LogoPlaceholder inverse />
              <p>CUIDAMOS LO QUE AMAS</p>
            </div>
            <span className="logo-card__variant">Blanco / burgundy</span>
          </article>
        </div>
      </section>

      <section className="colors-section" aria-labelledby="colors-title">
        <div className="colors-heading">
          <div>
            <p className="identity-kicker">02 · Sistema visual</p>
            <h2 id="colors-title">Colores</h2>
          </div>
          <p>
            Una paleta cálida que equilibra confianza, cercanía y claridad. Cada combinación de
            texto está definida para cumplir contraste AA como mínimo.
          </p>
        </div>

        <div className="usage-panel">
          <div className="usage-panel__heading">
            <div>
              <span className="section-eyebrow">Proporción recomendada</span>
              <h3>El crema da aire. Los acentos guían.</h3>
            </div>
            <span className="contrast-badge">Contraste AA mínimo</span>
          </div>

          <div
            className="usage-bar"
            aria-label="Proporción de uso: 50% crema, 25% burgundy, 15% peach, 7% sage y 3% amarillo miel"
          >
            <span className="usage-bar__cream" />
            <span className="usage-bar__burgundy" />
            <span className="usage-bar__peach" />
            <span className="usage-bar__sage" />
            <span className="usage-bar__honey" />
          </div>

          <div className="usage-legend">
            <span>
              <i className="legend-dot legend-dot--cream" /> Crema <strong>50%</strong>
            </span>
            <span>
              <i className="legend-dot legend-dot--burgundy" /> Burgundy <strong>25%</strong>
            </span>
            <span>
              <i className="legend-dot legend-dot--peach" /> Peach <strong>15%</strong>
            </span>
            <span>
              <i className="legend-dot legend-dot--sage" /> Sage <strong>7%</strong>
            </span>
            <span>
              <i className="legend-dot legend-dot--honey" /> Miel <strong>3%</strong>
            </span>
          </div>
        </div>

        <div className="color-grid">
          {colors.map((color) => (
            <article className="color-card" key={color.hex}>
              <div className={`color-swatch ${color.className}`} aria-hidden="true">
                <span>{color.hex}</span>
              </div>
              <div className="color-card__content">
                <div className="color-card__title">
                  <h3>{color.name}</h3>
                  <span>{color.hex}</span>
                </div>
                <p>{color.use}</p>
                {color.note && <p className="color-card__note">{color.note}</p>}
              </div>
            </article>
          ))}
        </div>

        <div className="surface-rule">
          <span className="surface-rule__sample" aria-hidden="true" />
          <div>
            <span className="section-eyebrow">Regla de superficies</span>
            <p>
              Las tarjetas son blancas sobre el fondo crema y usan un borde de 1 px en Taupe al 40%.
            </p>
          </div>
        </div>
      </section>

      <section className="type-section guide-section" aria-labelledby="type-title">
        <div className="guide-heading">
          <p className="identity-kicker">03 · Voz visual</p>
          <div>
            <h2 id="type-title">Tipografía</h2>
            <p>
              Sora aporta carácter y confianza. DM Sans mantiene la lectura clara y cercana en cada
              interacción.
            </p>
          </div>
        </div>

        <div className="font-families">
          <article className="font-card font-card--display">
            <span className="font-card__meta">Títulos y logo · 600–700</span>
            <strong>Sora</strong>
            <p>Salud, bienestar y más vida juntos.</p>
            <span className="font-card__alphabet">ABCDEFGHIJKLMNÑOPQRSTUVWXYZ · 0123456789</span>
          </article>
          <article className="font-card font-card--body">
            <span className="font-card__meta">Textos, formularios y UI · 400 / 500 / 600</span>
            <strong>DM Sans</strong>
            <p>Tu mascota merece cuidado experto y cercano.</p>
            <span className="font-card__alphabet">ABCDEFGHIJKLMNÑOPQRSTUVWXYZ · 0123456789</span>
          </article>
        </div>

        <div className="type-scale" aria-label="Escala tipográfica">
          <div className="type-row">
            <span>H1</span>
            <p className="type-h1">Cuidamos lo que amas</p>
            <code>40 / 48 · 700</code>
          </div>
          <div className="type-row">
            <span>H2</span>
            <p className="type-h2">Todo para su bienestar</p>
            <code>28 / 36 · 700</code>
          </div>
          <div className="type-row">
            <span>H3</span>
            <p className="type-h3">Próxima cita</p>
            <code>20 / 28 · 600</code>
          </div>
          <div className="type-row">
            <span>Cuerpo</span>
            <p className="type-body">Encuentra profesionales de confianza cerca de ti.</p>
            <code>16 / 24 · 400</code>
          </div>
          <div className="type-row">
            <span>Small</span>
            <p className="type-small">Disponible hoy en Chapinero</p>
            <code>14 / 20 · 500</code>
          </div>
        </div>

        <p className="accessibility-note">
          <strong>Legibilidad primero:</strong> ningún texto funcional usa un tamaño menor a 14 px y
          todo el contenido mantiene contraste AA.
        </p>
      </section>

      <section className="shape-section guide-section" aria-labelledby="shape-title">
        <div className="guide-heading">
          <p className="identity-kicker">04 · Lenguaje de interfaz</p>
          <div>
            <h2 id="shape-title">Forma y estilo</h2>
            <p>
              Contenedores amables, profundidad sutil y gestos orgánicos que acompañan sin competir
              con el contenido.
            </p>
          </div>
        </div>

        <div className="shape-layout">
          <div className="shape-specs">
            <article className="radius-card radius-card--button">
              <span>Botones</span>
              <strong>12 px</strong>
              <button type="button">Agendar cita</button>
            </article>
            <article className="radius-card radius-card--card">
              <span>Tarjetas</span>
              <strong>16 px</strong>
              <div className="mini-card">Cuidado cercano</div>
            </article>
            <article className="radius-card radius-card--input">
              <span>Inputs</span>
              <strong>12 px</strong>
              <div className="mini-input">Nombre de tu mascota</div>
            </article>
          </div>

          <article className="blob-showcase">
            <div className="blob blob--burgundy" />
            <div className="blob blob--peach" />
            <div className="blob blob--sage" />
            <div className="blob-showcase__content">
              <span>Decoración orgánica</span>
              <h3>Cálida, sutil y con movimiento.</h3>
              <p>
                Usa blobs en héroes y autenticación, siempre detrás del contenido y con suficiente
                aire.
              </p>
            </div>
          </article>
        </div>

        <article className="photo-direction">
          <div className="photo-direction__image">
            <img
              alt="Mujer abrazando con cariño a un perro beagle"
              src="https://images.unsplash.com/photo-1752387632359-4ba46c4f55d3?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1200"
            />
            <span>Foto: Max Bvp · Unsplash</span>
          </div>
          <div className="photo-direction__content">
            <span className="section-eyebrow">Dirección fotográfica</span>
            <h3>Historias reales, afecto real.</h3>
            <p>
              Fotografía natural y cálida de perros y gatos con personas. Prioriza luz suave,
              momentos cotidianos y vínculos genuinos; evita poses rígidas o imágenes excesivamente
              producidas.
            </p>
          </div>
        </article>
      </section>

      <section className="icons-section guide-section" aria-labelledby="icons-title">
        <div className="guide-heading">
          <p className="identity-kicker">05 · Sistema gráfico</p>
          <div>
            <h2 id="icons-title">Íconos</h2>
            <p>
              Línea simple, terminales redondeadas y un trazo consistente de 1.5 px en Veto
              Burgundy.
            </p>
          </div>
        </div>

        <div className="icon-size-key" aria-label="Tamaños de iconografía">
          <span>
            <i className="size-box size-box--24" /> 24 px · UI y navegación
          </span>
          <span>
            <i className="size-box size-box--32" /> 32 px · Tarjetas y destacados
          </span>
        </div>

        <div className="icon-grid">
          {iconSet.map((icon) => (
            <article className="icon-card" key={icon.name}>
              <div className="icon-card__samples">
                <span>
                  <PetIcon name={icon.name} size={24} />
                  <small>24</small>
                </span>
                <span>
                  <PetIcon name={icon.name} size={32} />
                  <small>32</small>
                </span>
              </div>
              <h3>{icon.label}</h3>
            </article>
          ))}
        </div>
      </section>

      <footer className="identity-footer">
        <LogoPlaceholder inverse />
        <div>
          <p>CUIDAMOS LO QUE AMAS</p>
          <span>Salud, bienestar y más vida juntos.</span>
        </div>
      </footer>
    </main>
  );
}
