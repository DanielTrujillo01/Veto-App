'use client';

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  AlertBox,
  Avatar,
  FieldError,
  SectionCard,
  Skeleton,
  SpeciesChip,
  StatusBadge,
  VetoButton,
} from '@/components/ui/veto-components';

const sections = [
  ['botones', 'Botones'],
  ['formularios', 'Formularios'],
  ['seleccion', 'Selección'],
  ['feedback', 'Feedback'],
  ['navegacion', 'Navegación'],
  ['datos', 'Datos y carga'],
] as const;

const species = ['Perro', 'Gato', 'Ave', 'Conejo', 'Roedor', 'Reptil'];
const pets = [
  { name: 'Luna', detail: 'Gato · 3 años', status: 'Al día', tone: 'success' as const },
  { name: 'Bruno', detail: 'Perro · 6 años', status: 'Pendiente', tone: 'warning' as const },
  { name: 'Kiwi', detail: 'Ave · 1 año', status: 'En revisión', tone: 'info' as const },
];

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="google-mark">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.72-.06-1.42-.18-2.09H12v3.96h5.38a4.6 4.6 0 0 1-2 3.02v2.47h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.62-2.41l-3.24-2.47c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.75-5.59-4.1H3.06v2.55A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.41 13.98a6 6 0 0 1 0-3.96V7.47H3.06a10 10 0 0 0 0 9.06l3.35-2.55Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.92c1.47 0 2.79.5 3.82 1.5l2.86-2.86C16.96 2.96 14.7 2 12 2a10 10 0 0 0-8.94 5.47l3.35 2.55C7.2 7.67 9.4 5.92 12 5.92Z"
      />
    </svg>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="specimen-label">{children}</p>;
}

export default function ComponentesPage() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [petName, setPetName] = useState('M');
  const [description, setDescription] = useState('Es muy juguetón y le encanta salir a caminar.');
  const [selectedSpecies, setSelectedSpecies] = useState('Perro');
  const [selectedTab, setSelectedTab] = useState('Perfil');
  const [checked, setChecked] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [photo, setPhoto] = useState<string>();
  const [photoError, setPhotoError] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [activeSection, setActiveSection] = useState('botones');
  const modalRef = useRef<HTMLElement>(null);
  const modalCloseRef = useRef<HTMLButtonElement>(null);
  const modalTriggerRef = useRef<HTMLButtonElement>(null);
  const petNameError = petName.trim().length < 2;

  useEffect(() => {
    if (!toastVisible) return;
    const timer = window.setTimeout(() => setToastVisible(false), 3500);
    return () => window.clearTimeout(timer);
  }, [toastVisible]);

  useEffect(() => {
    if (!photo) return;
    return () => URL.revokeObjectURL(photo);
  }, [photo]);

  useEffect(() => {
    if (!modalVisible) return;
    modalCloseRef.current?.focus();
    const handleModalKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModalVisible(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleModalKeys);
    return () => {
      window.removeEventListener('keydown', handleModalKeys);
      modalTriggerRef.current?.focus();
    };
  }, [modalVisible]);

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setPhotoError('Elige una imagen JPG o PNG de máximo 5 MB.');
      event.target.value = '';
      return;
    }
    setPhotoError('');
    setPhoto(URL.createObjectURL(file));
  };

  return (
    <div className="components-page">
      <div className="components-hero">
        <div className="components-hero__copy">
          <span className="eyebrow">
            <span className="eyebrow__dot" /> Sistema de diseño · Veto
          </span>
          <h1>
            Componentes <em>con cariño.</em>
          </h1>
          <p>
            Una biblioteca reutilizable para crear experiencias claras, cálidas y consistentes en
            todo Veto.
          </p>
        </div>
        <div className="components-hero__mark" aria-hidden="true">
          <span>V</span>
          <i>♥</i>
        </div>
        <div className="components-hero__meta">
          <span>01 — 06</span>
          <span>Accesibles · Responsivos · Listos para usar</span>
        </div>
      </div>

      <div className="components-layout">
        <aside className="components-sidebar" aria-label="Secciones de componentes">
          <p className="sidebar-caption">En esta página</p>
          <nav>
            {sections.map(([id, label], index) => (
              <a
                key={id}
                href={`#${id}`}
                className={activeSection === id ? 'is-active' : ''}
                onClick={() => setActiveSection(id)}
              >
                <span>0{index + 1}</span>
                {label}
              </a>
            ))}
          </nav>
          <div className="sidebar-note">
            <span aria-hidden="true">✳</span>
            <p>Diseñado para cuidar cada detalle, como cuidamos de ellos.</p>
          </div>
        </aside>

        <div className="components-content">
          <SectionCard
            id="botones"
            number="01"
            title="Botones"
            description="Acciones claras para cada momento."
          >
            <div className="specimen-grid specimen-grid--buttons">
              <article className="specimen">
                <SectionLabel>Primario</SectionLabel>
                <VetoButton>Guardar cambios</VetoButton>
                <span className="specimen-hint">Default · Hover · Focus</span>
              </article>
              <article className="specimen">
                <SectionLabel>Secundario</SectionLabel>
                <VetoButton variant="secondary">Ver detalles</VetoButton>
                <span className="specimen-hint">Fondo transparente</span>
              </article>
              <article className="specimen">
                <SectionLabel>Terciario</SectionLabel>
                <VetoButton variant="tertiary">Cancelar</VetoButton>
                <span className="specimen-hint">Acción de bajo énfasis</span>
              </article>
              <article className="specimen">
                <SectionLabel>Peligro</SectionLabel>
                <VetoButton variant="danger">Eliminar perfil</VetoButton>
                <span className="specimen-hint">Acción irreversible</span>
              </article>
              <article className="specimen">
                <SectionLabel>Autenticación</SectionLabel>
                <VetoButton variant="google">
                  <GoogleMark /> Continuar con Google
                </VetoButton>
                <span className="specimen-hint">Proveedor externo</span>
              </article>
              <article className="specimen">
                <SectionLabel>Estados</SectionLabel>
                <div className="state-button-row">
                  <VetoButton>Default</VetoButton>
                  <VetoButton disabled>Disabled</VetoButton>
                  <VetoButton loading>Cargando</VetoButton>
                </div>
                <span className="specimen-hint">El focus se muestra al usar Tab</span>
              </article>
            </div>
          </SectionCard>

          <SectionCard
            id="formularios"
            number="02"
            title="Campos de formulario"
            description="Etiquetas visibles, ayudas claras y errores que no borran lo escrito."
          >
            <div className="form-specimen-grid">
              <label className="field">
                <span className="field__label">
                  Nombre de la mascota <span>*</span>
                </span>
                <input
                  className="control"
                  value={petName}
                  onChange={(event) => setPetName(event.target.value)}
                  aria-invalid={petNameError}
                  aria-describedby={petNameError ? 'pet-name-error' : undefined}
                />
                {petNameError && (
                  <FieldError id="pet-name-error">
                    El nombre debe tener al menos 2 caracteres.
                  </FieldError>
                )}
              </label>
              <label className="field">
                <span className="field__label">Correo electrónico</span>
                <input
                  className="control control--hover"
                  type="email"
                  placeholder="tunombre@correo.com"
                />
                <span className="field__hint">Estado hover al pasar el cursor</span>
              </label>
              <label className="field">
                <span className="field__label">Contraseña</span>
                <span className="control-wrap">
                  <input
                    className="control"
                    type={passwordVisible ? 'text' : 'password'}
                    defaultValue="Veto2026!"
                  />
                  <button
                    className="control-action"
                    type="button"
                    onClick={() => setPasswordVisible(!passwordVisible)}
                    aria-label={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {passwordVisible ? 'Ocultar' : 'Mostrar'}
                  </button>
                </span>
                <span className="field__hint">Mínimo 8 caracteres</span>
              </label>
              <label className="field">
                <span className="field__label">Teléfono</span>
                <span className="control-wrap phone-control">
                  <span className="phone-prefix">🇨🇴 +57</span>
                  <input className="control" type="tel" placeholder="300 123 4567" />
                </span>
              </label>
              <label className="field">
                <span className="field__label">Tipo de mascota</span>
                <select className="control" defaultValue="perro">
                  <option value="perro">Perro</option>
                  <option value="gato">Gato</option>
                  <option value="ave">Ave</option>
                </select>
              </label>
              <label className="field">
                <span className="field__label">Campo deshabilitado</span>
                <input className="control" disabled value="No editable" readOnly />
              </label>
              <label className="field">
                <span className="field__label">Fecha de nacimiento</span>
                <input className="control" type="date" defaultValue="2022-05-14" />
              </label>
              <label className="field">
                <span className="field__label">Hora preferida</span>
                <input className="control" type="time" defaultValue="09:30" />
              </label>
              <label className="field field--wide">
                <span className="field__label">Sobre tu mascota</span>
                <textarea
                  className="control textarea"
                  maxLength={180}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
                <span className="character-count">{description.length}/180 caracteres</span>
              </label>
              <div className="field">
                <span className="field__label">Estado de carga</span>
                <span className="control-wrap">
                  <input className="control" value="Validando información..." readOnly disabled />
                  <span className="input-spinner" aria-label="Cargando" />
                </span>
              </div>
            </div>
            <p className="component-footnote">
              El foco usa un contorno visible. Los mensajes de error están asociados al campo y
              conservan el valor ingresado.
            </p>
          </SectionCard>

          <SectionCard
            id="seleccion"
            number="03"
            title="Selección y preferencias"
            description="Opciones accesibles y controles fáciles de identificar."
          >
            <div className="selection-grid">
              <div className="selection-block">
                <SectionLabel>Radio cards · Especie favorita</SectionLabel>
                <div className="radio-cards" role="radiogroup" aria-label="Especie favorita">
                  {['Perro', 'Gato', 'Conejo'].map((animal) => (
                    <label
                      className={`radio-card${selectedSpecies === animal ? ' is-selected' : ''}`}
                      key={animal}
                    >
                      <input
                        type="radio"
                        name="favorite-species"
                        value={animal}
                        checked={selectedSpecies === animal}
                        onChange={() => setSelectedSpecies(animal)}
                      />
                      <span className="radio-card__icon">
                        {animal === 'Perro' ? '🐕' : animal === 'Gato' ? '🐈' : '🐇'}
                      </span>
                      <span>{animal}</span>
                      <span className="radio-card__check" aria-hidden="true">
                        {selectedSpecies === animal ? '✓' : ''}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="selection-block selection-block--controls">
                <SectionLabel>Controles</SectionLabel>
                <label className="check-control">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => setChecked(event.target.checked)}
                  />
                  <span className="custom-check" aria-hidden="true">
                    {checked ? '✓' : ''}
                  </span>
                  <span>Recibir recordatorios de citas</span>
                </label>
                <label className="switch-control">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => setEnabled(event.target.checked)}
                    role="switch"
                  />
                  <span className="switch-track" aria-hidden="true">
                    <span />
                  </span>
                  <span>Perfil visible para clínicas</span>
                </label>
                <label className="check-control check-control--disabled">
                  <input type="checkbox" disabled />
                  <span className="custom-check" aria-hidden="true" />
                  <span>Opción no disponible</span>
                </label>
              </div>
              <div className="selection-block selection-block--wide">
                <SectionLabel>Chips de especie</SectionLabel>
                <div className="chip-row">
                  {species.map((animal, index) => (
                    <SpeciesChip selected={index === 0} key={animal}>
                      {animal}
                    </SpeciesChip>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="feedback"
            number="04"
            title="Estados y feedback"
            description="Respuestas útiles para acompañar cada acción."
          >
            <div className="feedback-grid">
              <div className="feedback-block">
                <SectionLabel>Badges de estado</SectionLabel>
                <div className="chip-row">
                  <StatusBadge tone="success">Confirmada</StatusBadge>
                  <StatusBadge tone="warning">Pendiente</StatusBadge>
                  <StatusBadge tone="error">Cancelada</StatusBadge>
                  <StatusBadge tone="info">En proceso</StatusBadge>
                  <StatusBadge tone="neutral">Borrador</StatusBadge>
                </div>
              </div>
              <div className="feedback-block">
                <SectionLabel>Alertas</SectionLabel>
                <div className="alert-stack">
                  <AlertBox tone="success" title="¡Cambios guardados!">
                    La información de Luna está actualizada.
                  </AlertBox>
                  <AlertBox tone="warning" title="Tienes una cita pendiente">
                    Confirma antes del jueves 12 de junio.
                  </AlertBox>
                  <AlertBox tone="error" title="No se pudo completar">
                    Inténtalo de nuevo. Tus datos siguen guardados.
                  </AlertBox>
                  <AlertBox tone="info" title="Un dato para ti">
                    Puedes cambiar esta preferencia cuando quieras.
                  </AlertBox>
                </div>
              </div>
              <div className="feedback-block feedback-block--actions">
                <SectionLabel>Toast y confirmación</SectionLabel>
                <div className="action-row">
                  <VetoButton onClick={() => setToastVisible(true)}>Mostrar toast</VetoButton>
                  <VetoButton
                    variant="secondary"
                    onClick={() => {
                      setConfirmed(false);
                      setModalVisible(true);
                    }}
                    ref={modalTriggerRef}
                  >
                    Abrir confirmación
                  </VetoButton>
                </div>
                {confirmed && (
                  <p className="success-caption">La acción se confirmó correctamente.</p>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="navegacion"
            number="05"
            title="Navegación"
            description="Orientación y acciones organizadas sin ruido."
          >
            <SectionLabel>Tabs</SectionLabel>
            <div className="tabs" role="tablist" aria-label="Secciones de la mascota">
              {['Perfil', 'Salud', 'Citas'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={selectedTab === tab}
                  className={selectedTab === tab ? 'is-active' : ''}
                  onClick={() => setSelectedTab(tab)}
                >
                  {tab}
                  {tab === 'Citas' && <span className="tab-count">2</span>}
                </button>
              ))}
            </div>
            <div className="tab-panel" role="tabpanel">
              <span className="tab-panel__icon" aria-hidden="true">
                ✿
              </span>
              <div>
                <strong>{selectedTab} de Luna</strong>
                <p>El contenido cambia según la pestaña seleccionada.</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="datos"
            number="06"
            title="Datos, carga y vacíos"
            description="Presentación adaptable para contenido y estados de espera."
          >
            <div className="data-showcase">
              <div className="data-block data-block--wide">
                <SectionLabel>Tabla responsive</SectionLabel>
                <div
                  className="table-scroll"
                  role="region"
                  aria-label="Mascotas registradas"
                  tabIndex={0}
                >
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Mascota</th>
                        <th>Perfil</th>
                        <th>Estado</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pets.map((pet) => (
                        <tr key={pet.name}>
                          <td>
                            <div className="pet-cell">
                              <Avatar name={pet.name} />
                              <span>{pet.name}</span>
                            </div>
                          </td>
                          <td>{pet.detail}</td>
                          <td>
                            <StatusBadge tone={pet.tone}>{pet.status}</StatusBadge>
                          </td>
                          <td>
                            <button className="table-action" type="button">
                              Ver perfil
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="data-block">
                <SectionLabel>Estado vacío</SectionLabel>
                <div className="empty-state">
                  <span className="empty-state__art" aria-hidden="true">
                    <span>🐾</span>
                  </span>
                  <strong>Aún no hay citas</strong>
                  <p>Cuando agendes una, la encontrarás aquí.</p>
                  <button type="button" className="empty-state__link">
                    Buscar veterinario
                  </button>
                </div>
              </div>
              <div className="data-block">
                <SectionLabel>Skeletons de carga</SectionLabel>
                <div className="skeleton-card">
                  <Skeleton className="skeleton-avatar" />
                  <div className="skeleton-lines">
                    <Skeleton />
                    <Skeleton className="skeleton-short" />
                    <Skeleton className="skeleton-pill" />
                  </div>
                </div>
                <div className="skeleton-card skeleton-card--compact">
                  <Skeleton className="skeleton-avatar" />
                  <div className="skeleton-lines">
                    <Skeleton />
                    <Skeleton className="skeleton-short" />
                  </div>
                </div>
                <span className="sr-only" role="status">
                  Cargando contenido de ejemplo
                </span>
              </div>
              <div className="data-block data-block--upload">
                <SectionLabel>Foto de perfil · Vista previa</SectionLabel>
                <label className="photo-upload">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhoto}
                    aria-invalid={Boolean(photoError)}
                    aria-describedby={photoError ? 'photo-error' : undefined}
                  />
                  {photo ? (
                    <img src={photo} alt="Vista previa de la foto seleccionada" />
                  ) : (
                    <span className="photo-upload__placeholder" aria-hidden="true">
                      +
                    </span>
                  )}
                  <span>
                    <strong>{photo ? 'Cambiar foto' : 'Subir una foto'}</strong>
                    <small>JPG o PNG · Máximo 5 MB</small>
                  </span>
                </label>
                {photoError && <FieldError id="photo-error">{photoError}</FieldError>}
              </div>
            </div>
          </SectionCard>

          <footer className="components-footer">
            <span className="footer-paw" aria-hidden="true">
              ✳
            </span>
            <p>
              Hecho para cuidar <strong>cada detalle.</strong>
            </p>
            <span>VETO · SISTEMA DE DISEÑO</span>
          </footer>
        </div>
      </div>

      {toastVisible && (
        <div className="toast" role="status">
          <span className="toast__check" aria-hidden="true">
            ✓
          </span>
          <span>
            <strong>¡Listo!</strong>
            <small>Tu acción se completó correctamente.</small>
          </span>
          <button
            type="button"
            onClick={() => setToastVisible(false)}
            aria-label="Cerrar notificación"
          >
            ×
          </button>
        </div>
      )}

      {modalVisible && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModalVisible(false);
          }}
        >
          <section
            className="confirm-modal"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            aria-describedby="modal-description"
          >
            <button
              type="button"
              className="modal-close"
              ref={modalCloseRef}
              aria-label="Cerrar"
              onClick={() => setModalVisible(false)}
            >
              ×
            </button>
            <span className="modal-icon" aria-hidden="true">
              ?
            </span>
            <h2 id="modal-title">¿Eliminar a Luna?</h2>
            <p id="modal-description">
              Esta acción no se puede deshacer. Los datos asociados también se eliminarán.
            </p>
            <div className="modal-actions">
              <VetoButton variant="secondary" onClick={() => setModalVisible(false)}>
                Conservar perfil
              </VetoButton>
              <VetoButton
                variant="danger"
                onClick={() => {
                  setConfirmed(true);
                  setModalVisible(false);
                }}
              >
                Sí, eliminar
              </VetoButton>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
