import { useState } from 'react';

export type LayoutKind = 'public' | 'auth' | 'partner';
type Device = 'desktop' | 'mobile';

const layoutOptions: { id: LayoutKind; number: string; title: string; subtitle: string }[] = [
  { id: 'public', number: '01', title: 'Público · Tutor', subtitle: 'Descubre, busca y conecta' },
  { id: 'auth', number: '02', title: 'Autenticación', subtitle: 'Ingresar y crear cuenta' },
  { id: 'partner', number: '03', title: 'Panel · Aliado', subtitle: 'Gestiona tu negocio' },
];

function PreviewLogo({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`preview-logo${inverse ? ' preview-logo--inverse' : ''}`}>
      <b>V</b> veto <i aria-hidden="true">♥</i>
    </span>
  );
}

function PublicPreview({ device, signedIn }: { device: Device; signedIn: boolean }) {
  return (
    <div className={`layout-public-preview${device === 'mobile' ? ' is-mobile' : ''}`}>
      <header>
        <PreviewLogo />
        {device === 'desktop' ? (
          <>
            <div className="preview-search">⌕ &nbsp; Veterinario, servicio o clínica</div>
            <nav>
              <span>Veterinarias</span>
              <span>Veterinarios</span>
              <span>Tienda</span>
              <span>Adopción</span>
            </nav>
            <button type="button">Ingresar</button>
            <button className="preview-primary" type="button">
              Registrarme
            </button>
          </>
        ) : (
          <button className="preview-menu" type="button" aria-label="Abrir navegación">
            ☰
          </button>
        )}
      </header>
      <div className="layout-public-preview__body">
        <div className="preview-kicker">CUIDAMOS LO QUE AMAS</div>
        <h3>Todo para el cuidado de tu mascota.</h3>
        <p>Un espacio cálido para encontrar el cuidado que merece.</p>
        <div className="preview-search preview-search--wide">
          ⌕ &nbsp; ¿Qué necesitas? <span>⌖ &nbsp; Bogotá</span>
          <b>Buscar</b>
        </div>
        <div className="preview-card-row">
          <span>
            ✚<small>Veterinarias</small>
          </span>
          <span>
            ♡<small>Veterinarios</small>
          </span>
          {device === 'desktop' && (
            <>
              <span>
                ✿<small>Tienda</small>
              </span>
              <span>
                ⌂<small>Adopción</small>
              </span>
            </>
          )}
        </div>
      </div>
      {device === 'mobile' && signedIn && (
        <nav className="preview-bottom-nav">
          <span>
            ⌂<small>Inicio</small>
          </span>
          <span>
            ⌕<small>Buscar</small>
          </span>
          <span>
            ♡<small>Mascotas</small>
          </span>
          <span>
            ◷<small>Citas</small>
          </span>
          <span>
            ◉<small>Perfil</small>
          </span>
        </nav>
      )}
    </div>
  );
}

function AuthPreview({ device }: { device: Device }) {
  return (
    <div className={`layout-auth-preview${device === 'mobile' ? ' is-mobile' : ''}`}>
      <aside className="layout-auth-story">
        <PreviewLogo inverse />
        <div className="layout-auth-story__copy">
          <span>CUIDAMOS LO QUE AMAS</span>
          <h3>
            Salud, bienestar
            <br />y más vida juntos.
          </h3>
          <p>Encuentra a quienes cuidan con el corazón.</p>
        </div>
        <div className="layout-auth-blob" aria-hidden="true">
          ♡
        </div>
        <small>Un lugar seguro para toda la familia.</small>
      </aside>
      <section className="layout-auth-form">
        {device === 'mobile' && <PreviewLogo />}
        <div className="layout-auth-form__content">
          <span className="preview-kicker">QUÉ BUENO TENERTE AQUÍ</span>
          <h3>¡Hola de nuevo!</h3>
          <p>Ingresa a tu cuenta para continuar.</p>
          <label>
            Correo electrónico<span>tunombre@correo.com</span>
          </label>
          <label>
            Contraseña
            <span>
              •••••••••••• <i>Mostrar</i>
            </span>
          </label>
          <a href="#recuperar">¿Olvidaste tu contraseña?</a>
          <button className="preview-auth-submit" type="button">
            Ingresar <b>→</b>
          </button>
          <div className="preview-auth-or">
            <span /> o <span />
          </div>
          <button className="preview-google" type="button">
            <b>G</b> Continuar con Google
          </button>
          <small>
            ¿Aún no tienes cuenta? <strong>Regístrate</strong>
          </small>
        </div>
      </section>
    </div>
  );
}

function PartnerPreview({ device }: { device: Device }) {
  return (
    <div className={`layout-partner-preview${device === 'mobile' ? ' is-mobile' : ''}`}>
      <aside className="partner-sidebar">
        <PreviewLogo inverse />
        {device === 'desktop' && (
          <>
            <span className="partner-workspace">CLÍNICA VETERINARIA</span>
            <nav>
              <b>◫ &nbsp; Resumen</b>
              <span>♙ &nbsp; Veterinarios</span>
              <span>⌂ &nbsp; Sedes</span>
              <span>✚ &nbsp; Servicios</span>
              <span>◷ &nbsp; Disponibilidad</span>
              <span>⚙ &nbsp; Configuración</span>
            </nav>
            <div className="partner-help">
              ¿Necesitas ayuda?
              <br />
              <strong>Habla con Veto →</strong>
            </div>
          </>
        )}
      </aside>
      <section className="partner-main">
        <header>
          <span>
            {device === 'mobile' ? '☰' : 'Resumen'}
            <small>Bienvenida, Laura</small>
          </span>
          <span className="partner-actions">
            ♧ &nbsp; <b>LV</b>
          </span>
        </header>
        <div className="partner-content">
          <span className="preview-kicker">MARTES, 5 DE NOVIEMBRE</span>
          <h3>Buenos días, Laura 👋</h3>
          <p>Así va tu clínica esta semana.</p>
          <div className="partner-metrics">
            <article>
              <small>Citas hoy</small>
              <b>08</b>
              <i>+2 esta semana</i>
            </article>
            <article>
              <small>Veterinarios</small>
              <b>06</b>
              <i>Todos activos</i>
            </article>
            {device === 'desktop' && (
              <article>
                <small>Servicios activos</small>
                <b>12</b>
                <i>En 2 sedes</i>
              </article>
            )}
          </div>
          <article className="partner-appointments">
            <span>
              Próximas citas <b>Ver agenda →</b>
            </span>
            <p>
              <i>09:30</i>
              <b>Consulta general</b>
              <small>Camila R. · Luna</small>
            </p>
            <p>
              <i>10:15</i>
              <b>Vacunación</b>
              <small>Andrés M. · Bruno</small>
            </p>
          </article>
        </div>
        {device === 'mobile' && (
          <nav className="partner-mobile-nav">
            <span>
              ◫<small>Resumen</small>
            </span>
            <span>
              ♙<small>Equipo</small>
            </span>
            <span>
              ◷<small>Agenda</small>
            </span>
            <span>
              ☰<small>Menú</small>
            </span>
          </nav>
        )}
      </section>
    </div>
  );
}

function LayoutPreview({
  layout,
  device,
  signedIn,
}: {
  layout: LayoutKind;
  device: Device;
  signedIn: boolean;
}) {
  if (layout === 'auth') return <AuthPreview device={device} />;
  if (layout === 'partner') return <PartnerPreview device={device} />;
  return <PublicPreview device={device} signedIn={signedIn} />;
}

export function Layouts({
  initialLayout = 'public',
  onLayoutChange,
}: {
  initialLayout?: LayoutKind;
  onLayoutChange?: (layout: LayoutKind) => void;
}) {
  const [layout, setLayout] = useState<LayoutKind>(initialLayout);
  const [device, setDevice] = useState<Device>('desktop');
  const [signedIn, setSignedIn] = useState(false);

  const chooseLayout = (nextLayout: LayoutKind) => {
    setLayout(nextLayout);
    onLayoutChange?.(nextLayout);
  };

  return (
    <main className="layouts-page">
      <header className="layouts-heading">
        <span className="veto-section-kicker">PROMPT 0 · ESTRUCTURA DE LA EXPERIENCIA</span>
        <h1>
          Un mismo cuidado.
          <br />
          <em>Tres formas de vivir Veto.</em>
        </h1>
        <p>
          Una base clara y consistente para cada momento: encontrar cuidado, entrar a tu cuenta y
          gestionar tu clínica.
        </p>
      </header>
      <div className="layouts-workbench">
        <aside className="layouts-selector">
          <span className="layouts-selector__label">ELIGE UN LAYOUT</span>
          {layoutOptions.map((option) => (
            <button
              type="button"
              key={option.id}
              className={layout === option.id ? 'is-selected' : ''}
              onClick={() => chooseLayout(option.id)}
            >
              <span>{option.number}</span>
              <b>
                {option.title}
                <small>{option.subtitle}</small>
              </b>
              <i aria-hidden="true">↗</i>
            </button>
          ))}
          <div className="layouts-guideline">
            <span>✳</span>
            <p>El mismo lenguaje visual. Experiencias pensadas para cada persona.</p>
          </div>
        </aside>
        <section className="layout-preview-area" aria-label="Vista previa del layout">
          <div className="layout-preview-toolbar">
            <div>
              <i /> <i /> <i />
              <span>Veto / {layoutOptions.find((option) => option.id === layout)?.title}</span>
            </div>
            {layout === 'public' && device === 'mobile' && (
              <button
                className={`layout-session-toggle${signedIn ? ' is-active' : ''}`}
                type="button"
                role="switch"
                aria-checked={signedIn}
                onClick={() => setSignedIn(!signedIn)}
              >
                {signedIn ? 'Con sesión' : 'Sin sesión'}
              </button>
            )}
            <div role="group" aria-label="Tamaño de la vista previa" className="device-toggle">
              <button
                type="button"
                className={device === 'desktop' ? 'is-active' : ''}
                onClick={() => setDevice('desktop')}
                aria-label="Vista de escritorio"
              >
                ▣<span>1440</span>
              </button>
              <button
                type="button"
                className={device === 'mobile' ? 'is-active' : ''}
                onClick={() => setDevice('mobile')}
                aria-label="Vista móvil"
              >
                ▯<span>390</span>
              </button>
            </div>
          </div>
          <div className={`layout-stage layout-stage--${device}`}>
            <LayoutPreview layout={layout} device={device} signedIn={signedIn} />
          </div>
          <p className="layout-caption">
            <span>↗</span>{' '}
            {device === 'desktop' ? 'Versión desktop · 1440 px' : 'Versión móvil · 390 px'}{' '}
            <i>Responsive por diseño</i>
          </p>
        </section>
      </div>
      <section className="layout-principles">
        <div>
          <span>01</span>
          <b>Claro primero</b>
          <small>Menos fricción, más confianza.</small>
        </div>
        <div>
          <span>02</span>
          <b>Cercano siempre</b>
          <small>Un lenguaje visual cálido y humano.</small>
        </div>
        <div>
          <span>03</span>
          <b>Listo para crecer</b>
          <small>Patrones consistentes en todo Veto.</small>
        </div>
      </section>
    </main>
  );
}
