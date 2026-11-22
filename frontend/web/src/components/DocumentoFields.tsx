import { NOMBRES_TIPO_DOCUMENTO, TIPOS_DOCUMENTO, type TipoDocumento } from '@veto/shared';

type DocumentoFieldsProps = {
  id: string;
  tipo: TipoDocumento;
  numero: string;
  onChange: (cambio: { tipoDocumento?: TipoDocumento; numeroDocumento?: string }) => void;
  errores?: Record<string, string | undefined>;
  required?: boolean;
};

/** Tipo y número de documento de identidad, uno al lado del otro. */
export function DocumentoFields({
  id,
  tipo,
  numero,
  onChange,
  errores = {},
  required = false,
}: DocumentoFieldsProps) {
  const marca = required ? ' *' : '';
  const soloNumeros = tipo === 'CC' || tipo === 'TI';
  return (
    <div className="document-control">
      <label className="field">
        <span>Tipo de documento{marca}</span>
        <select
          aria-invalid={Boolean(errores.tipoDocumento)}
          className={`control${errores.tipoDocumento ? ' control--error' : ''}`}
          id={`${id}-tipo`}
          onChange={(event) => onChange({ tipoDocumento: event.target.value as TipoDocumento })}
          required={required}
          value={tipo}
        >
          {TIPOS_DOCUMENTO.map((opcion) => (
            <option key={opcion} value={opcion}>
              {NOMBRES_TIPO_DOCUMENTO[opcion]}
            </option>
          ))}
        </select>
        {errores.tipoDocumento && <small className="field-error">{errores.tipoDocumento}</small>}
      </label>
      <label className="field">
        <span>Número de documento{marca}</span>
        <input
          aria-invalid={Boolean(errores.numeroDocumento)}
          autoComplete="off"
          className={`control${errores.numeroDocumento ? ' control--error' : ''}`}
          id={`${id}-numero`}
          inputMode={soloNumeros ? 'numeric' : 'text'}
          maxLength={15}
          onChange={(event) =>
            onChange({
              numeroDocumento: event.target.value
                .toUpperCase()
                .replace(soloNumeros ? /\D/g : /[^A-Z0-9]/g, ''),
            })
          }
          placeholder={soloNumeros ? '1234567890' : 'AB123456'}
          required={required}
          value={numero}
        />
        {errores.numeroDocumento ? (
          <small className="field-error">{errores.numeroDocumento}</small>
        ) : (
          <small className="field__hint">Sin puntos ni espacios.</small>
        )}
      </label>
    </div>
  );
}
