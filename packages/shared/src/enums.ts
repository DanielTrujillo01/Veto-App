// Espejo de los tipos ENUM de la base de datos (db/migrations).
// El test test/enums.test.ts falla si estas listas se desfasan de las migraciones.

export const ROLES_USUARIO = ['TUTOR', 'ALIADO', 'VETERINARIO', 'EQUIPO_VETO'] as const;
export const ESTADOS_CUENTA = ['ACTIVA', 'SUSPENDIDA', 'ELIMINADA'] as const;
export const TIPOS_ALIADO = ['CLINICA', 'VET_INDEPENDIENTE', 'TIENDA', 'FUNDACION'] as const;
export const ESTADOS_ALIADO = ['PENDIENTE', 'ACTIVO', 'SUSPENDIDO'] as const;
export const SEXOS_ANIMAL = ['MACHO', 'HEMBRA'] as const;
export const TAMANOS_MASCOTA = ['PEQUENO', 'MEDIANO', 'GRANDE'] as const;
export const MODALIDADES_SERVICIO = ['EN_SEDE', 'A_DOMICILIO'] as const;
export const ESTADOS_MODERACION = ['PUBLICADO', 'MARCADO', 'OCULTO'] as const;
export const ESTADOS_CITA = ['AGENDADA', 'FINALIZADA', 'NO_ASISTIO', 'CANCELADA'] as const;
export const ESTADOS_CONSULTA = ['ABIERTA', 'CERRADA'] as const;
export const ESTADOS_PEDIDO = [
  'PENDIENTE',
  'CONFIRMADO',
  'DESPACHADO',
  'ENTREGADO',
  'CANCELADO',
] as const;
export const ESTADOS_MASCOTA_ADOPCION = [
  'DISPONIBLE',
  'PAUSADA',
  'EN_PROCESO',
  'ADOPTADA',
  'RETIRADA',
] as const;
export const ESTADOS_SOLICITUD = [
  'ENVIADA',
  'EN_REVISION',
  'ENTREVISTA',
  'APROBADA',
  'RECHAZADA',
  'ADOPCION_COMPLETADA',
  'CANCELADA',
] as const;
export const TIPOS_ACCION_ADMIN = [
  'ACTIVAR',
  'SUSPENDER',
  'REACTIVAR',
  'OCULTAR',
  'MARCAR',
  'PUBLICAR',
] as const;

export type RolUsuario = (typeof ROLES_USUARIO)[number];
export type EstadoCuenta = (typeof ESTADOS_CUENTA)[number];
export type TipoAliado = (typeof TIPOS_ALIADO)[number];
export type EstadoAliado = (typeof ESTADOS_ALIADO)[number];
export type SexoAnimal = (typeof SEXOS_ANIMAL)[number];
export type TamanoMascota = (typeof TAMANOS_MASCOTA)[number];
export type ModalidadServicio = (typeof MODALIDADES_SERVICIO)[number];
export type EstadoModeracion = (typeof ESTADOS_MODERACION)[number];
export type EstadoCita = (typeof ESTADOS_CITA)[number];
export type EstadoConsulta = (typeof ESTADOS_CONSULTA)[number];
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];
export type EstadoMascotaAdopcion = (typeof ESTADOS_MASCOTA_ADOPCION)[number];
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];
export type TipoAccionAdmin = (typeof TIPOS_ACCION_ADMIN)[number];

/** Nombre del tipo en PostgreSQL → valores. Lo usa el test que compara con las migraciones. */
export const ENUMS_BASE_DE_DATOS = {
  rol_usuario: ROLES_USUARIO,
  estado_cuenta: ESTADOS_CUENTA,
  tipo_aliado: TIPOS_ALIADO,
  estado_aliado: ESTADOS_ALIADO,
  sexo_animal: SEXOS_ANIMAL,
  tamano_mascota: TAMANOS_MASCOTA,
  modalidad_servicio: MODALIDADES_SERVICIO,
  estado_moderacion: ESTADOS_MODERACION,
  estado_cita: ESTADOS_CITA,
  estado_consulta: ESTADOS_CONSULTA,
  estado_pedido: ESTADOS_PEDIDO,
  estado_mascota_adopcion: ESTADOS_MASCOTA_ADOPCION,
  estado_solicitud: ESTADOS_SOLICITUD,
  tipo_accion_admin: TIPOS_ACCION_ADMIN,
} as const;
