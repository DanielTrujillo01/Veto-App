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
