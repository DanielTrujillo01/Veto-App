import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'google';

type VetoButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
  children: ReactNode;
};

export function VetoButton({
  variant = 'primary',
  loading = false,
  children,
  className = '',
  disabled,
  type = 'button',
  ref,
  ...props
}: VetoButtonProps) {
  return (
    <button
      className={`veto-button veto-button--${variant} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      type={type}
      ref={ref}
      {...props}
    >
      {loading && <span className="veto-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <span className="field-error" id={id} role="alert">
      <svg aria-hidden="true" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" />
        <path d="M10 6v4.5M10 13.5h.01" />
      </svg>
      {children}
    </span>
  );
}

/** Agrupa los 10 dígitos de un celular colombiano como "300 123 4567". */
export function formatearCelular(valor: string) {
  const digitos = valor.replace(/\D/g, '').slice(0, 10);
  if (digitos.length <= 3) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 3)} ${digitos.slice(3)}`;
  return `${digitos.slice(0, 3)} ${digitos.slice(3, 6)} ${digitos.slice(6)}`;
}

type CelularFieldProps = {
  id: string;
  label: string;
  /** Solo dígitos, sin espacios. */
  value: string;
  onChange: (digitos: string) => void;
  error?: string;
  required?: boolean;
};

/** Campo de celular con prefijo +57, formato "300 123 4567" y contador de dígitos. */
export function CelularField({
  id,
  label,
  value,
  onChange,
  error,
  required = false,
}: CelularFieldProps) {
  const pistaId = `${id}-hint`;
  return (
    <label className="field">
      <span>{label}</span>
      <span className={`phone-control${error ? ' phone-control--error' : ''}`}>
        <span className="phone-prefix">+57</span>
        <input
          aria-describedby={pistaId}
          aria-invalid={Boolean(error)}
          autoComplete="tel-national"
          className={`control${error ? ' control--error' : ''}`}
          id={id}
          inputMode="numeric"
          maxLength={12}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="300 123 4567"
          required={required}
          value={formatearCelular(value)}
        />
      </span>
      <small className="field__hint" id={pistaId}>
        Ingresa los 10 dígitos de tu celular ({value.length}/10).
      </small>
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  children: ReactNode;
}) {
  return <span className={`status-badge status-badge--${tone}`}>{children}</span>;
}

export function SpeciesChip({
  selected = false,
  children,
}: {
  selected?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`species-chip${selected ? ' species-chip--selected' : ''}`}>{children}</span>
  );
}

export function AlertBox({
  tone,
  title,
  children,
}: {
  tone: 'success' | 'warning' | 'error' | 'info';
  title: string;
  children: ReactNode;
}) {
  const symbols = { success: '✓', warning: '!', error: '!', info: 'i' };
  return (
    <div className={`alert-box alert-box--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="alert-box__icon" aria-hidden="true">
        {symbols[tone]}
      </span>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}

export function Avatar({ name, image }: { name: string; image?: string }) {
  return (
    <span className="avatar" role="img" aria-label={`Avatar de ${name}`}>
      {image ? (
        <img src={image} alt="" />
      ) : (
        name
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join('')
          .toUpperCase()
      )}
    </span>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}

export function SectionCard({
  id,
  number,
  title,
  description,
  children,
}: {
  id: string;
  number: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="component-section" id={id} aria-labelledby={`${id}-title`}>
      <div className="component-section__heading">
        <span className="component-section__number">{number}</span>
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
