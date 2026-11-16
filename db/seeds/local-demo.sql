-- Datos deterministas para desarrollo local. Ejecutados solo por db/seed-local.mjs,
-- que rechaza cualquier host distinto al servicio Compose db.
-- Un segundo arranque no duplica filas ni reinicia cambios hechos manualmente.

INSERT INTO usuario (id, nombre, celular, correo, password_hash, rol, estado)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'Tutor Demo', '3000000001', 'tutor@veto.local', 'scrypt$dmV0by1sb2NhbC1kZW1vLXNhbHQ$DHkzIrtn20LBT_jF5hNB63opQ3ORfZfsicDkrOpruAPfPeoXGInD9ibaPBAl5UUpXPQMR7zas1qJ63tfGZgdeA', 'TUTOR', 'ACTIVA'),
  ('00000000-0000-4000-8000-000000000002', 'Clínica Demo', '3000000002', 'clinica@veto.local', 'scrypt$dmV0by1sb2NhbC1kZW1vLXNhbHQ$DHkzIrtn20LBT_jF5hNB63opQ3ORfZfsicDkrOpruAPfPeoXGInD9ibaPBAl5UUpXPQMR7zas1qJ63tfGZgdeA', 'ALIADO', 'ACTIVA'),
  ('00000000-0000-4000-8000-000000000003', 'Veterinaria Demo', '3000000003', 'veterinario@veto.local', 'scrypt$dmV0by1sb2NhbC1kZW1vLXNhbHQ$DHkzIrtn20LBT_jF5hNB63opQ3ORfZfsicDkrOpruAPfPeoXGInD9ibaPBAl5UUpXPQMR7zas1qJ63tfGZgdeA', 'VETERINARIO', 'ACTIVA'),
  ('00000000-0000-4000-8000-000000000004', 'Veterinario Independiente Demo', '3000000004', 'vet.independiente@veto.local', 'scrypt$dmV0by1sb2NhbC1kZW1vLXNhbHQ$DHkzIrtn20LBT_jF5hNB63opQ3ORfZfsicDkrOpruAPfPeoXGInD9ibaPBAl5UUpXPQMR7zas1qJ63tfGZgdeA', 'ALIADO', 'ACTIVA'),
  ('00000000-0000-4000-8000-000000000005', 'Tienda Demo', '3000000005', 'tienda@veto.local', 'scrypt$dmV0by1sb2NhbC1kZW1vLXNhbHQ$DHkzIrtn20LBT_jF5hNB63opQ3ORfZfsicDkrOpruAPfPeoXGInD9ibaPBAl5UUpXPQMR7zas1qJ63tfGZgdeA', 'ALIADO', 'ACTIVA'),
  ('00000000-0000-4000-8000-000000000006', 'Fundación Demo', '3000000006', 'fundacion@veto.local', 'scrypt$dmV0by1sb2NhbC1kZW1vLXNhbHQ$DHkzIrtn20LBT_jF5hNB63opQ3ORfZfsicDkrOpruAPfPeoXGInD9ibaPBAl5UUpXPQMR7zas1qJ63tfGZgdeA', 'ALIADO', 'ACTIVA'),
  ('00000000-0000-4000-8000-000000000007', 'Equipo Veto Demo', '3000000007', 'equipo@veto.local', 'scrypt$dmV0by1sb2NhbC1kZW1vLXNhbHQ$DHkzIrtn20LBT_jF5hNB63opQ3ORfZfsicDkrOpruAPfPeoXGInD9ibaPBAl5UUpXPQMR7zas1qJ63tfGZgdeA', 'EQUIPO_VETO', 'ACTIVA'),
  ('00000000-0000-4000-8000-000000000008', 'Fundación Pendiente Demo', '3000000008', 'fundacion.pendiente@veto.local', 'scrypt$dmV0by1sb2NhbC1kZW1vLXNhbHQ$DHkzIrtn20LBT_jF5hNB63opQ3ORfZfsicDkrOpruAPfPeoXGInD9ibaPBAl5UUpXPQMR7zas1qJ63tfGZgdeA', 'ALIADO', 'ACTIVA')
ON CONFLICT (id) DO NOTHING;

INSERT INTO aliado (id, usuario_id, tipo, nombre, descripcion, contacto, estado, ciudad, ubicacion, anio_fundacion)
VALUES
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000002', 'CLINICA', 'Clínica Demo', 'Atención veterinaria general para perros y gatos.', '6010000001', 'ACTIVO', 'Bogotá', 'Chapinero', NULL),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000004', 'VET_INDEPENDIENTE', 'Veterinario Independiente Demo', 'Consulta veterinaria independiente.', '3000000004', 'ACTIVO', 'Bogotá', 'Teusaquillo', NULL),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000005', 'TIENDA', 'Tienda Demo', 'Productos para mascotas.', '6010000003', 'ACTIVO', 'Bogotá', 'Usaquén', NULL),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000006', 'FUNDACION', 'Fundación Demo', 'Fundación local para pruebas de adopción.', '6010000004', 'ACTIVO', 'Bogotá', 'Suba', 2010),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000008', 'FUNDACION', 'Fundación Pendiente Demo', 'Registro pendiente para revisión administrativa.', '6010000005', 'PENDIENTE', 'Bogotá', 'Fontibón', 2018)
ON CONFLICT (id) DO NOTHING;

INSERT INTO veterinario (id, aliado_id, usuario_id, descripcion, activo)
VALUES
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000003', 'Veterinario de la clínica demo.', true),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000004', 'Perfil del veterinario independiente demo.', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sede (id, aliado_id, nombre, direccion, ciudad, activa)
VALUES
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000101', 'Sede Principal', 'Carrera 7 # 60-10', 'Bogotá', true),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000102', 'Consultorio Demo', 'Calle 45 # 15-20', 'Bogotá', true),
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000101', 'Sede inactiva Demo', 'Carrera 8 # 61-10', 'Bogotá', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO aliado_especie (aliado_id, especie_id)
SELECT a.id, e.id
FROM aliado a
CROSS JOIN especie e
WHERE a.id IN ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102')
  AND e.nombre IN ('Perro', 'Gato')
ON CONFLICT DO NOTHING;

INSERT INTO servicio (id, aliado_id, tipo_servicio_id, nombre, descripcion, modalidad, sede_id, duracion_min, precio_base, activo, moderacion)
SELECT x.id, x.aliado_id, ts.id, x.nombre, x.descripcion, 'EN_SEDE', x.sede_id, 45, x.precio, true, 'PUBLICADO'
FROM (VALUES
  ('00000000-0000-4000-8000-000000000401'::uuid, '00000000-0000-4000-8000-000000000101'::uuid, '00000000-0000-4000-8000-000000000301'::uuid, 'Consulta general demo', 'Consulta para probar agenda y reservas.', 65000::numeric),
  ('00000000-0000-4000-8000-000000000402'::uuid, '00000000-0000-4000-8000-000000000102'::uuid, '00000000-0000-4000-8000-000000000302'::uuid, 'Consulta independiente demo', 'Consulta con veterinario independiente.', 55000::numeric)
) AS x(id, aliado_id, sede_id, nombre, descripcion, precio)
JOIN tipo_servicio ts ON ts.nombre = 'Consulta general'
ON CONFLICT (id) DO NOTHING;

-- HU-026: casos locales para verificar modalidad y exclusión de servicios no disponibles.
INSERT INTO servicio (id, aliado_id, tipo_servicio_id, nombre, descripcion, modalidad, sede_id, duracion_min, precio_base, activo, moderacion)
SELECT x.id, x.aliado_id, ts.id, x.nombre, x.descripcion, x.modalidad, x.sede_id, 30, x.precio, x.activo, x.moderacion
FROM (VALUES
  ('00000000-0000-4000-8000-000000000411'::uuid, '00000000-0000-4000-8000-000000000101'::uuid, NULL::uuid, 'Baño y peluquería demo', 'Servicio demo a domicilio para validar filtros HU-026.', 'A_DOMICILIO'::modalidad_servicio, 'Baño y peluquería', 40000::numeric, true, 'PUBLICADO'::estado_moderacion),
  ('00000000-0000-4000-8000-000000000412'::uuid, '00000000-0000-4000-8000-000000000101'::uuid, '00000000-0000-4000-8000-000000000301'::uuid, 'Servicio inactivo QA HU-026', 'Fixture local inactivo para verificar disponibilidad.', 'EN_SEDE'::modalidad_servicio, 'Consulta general', 20000::numeric, false, 'PUBLICADO'::estado_moderacion),
  ('00000000-0000-4000-8000-000000000413'::uuid, '00000000-0000-4000-8000-000000000101'::uuid, NULL::uuid, 'Servicio oculto QA HU-026', 'Fixture local oculto para verificar disponibilidad.', 'A_DOMICILIO'::modalidad_servicio, 'Consulta general', 20000::numeric, true, 'OCULTO'::estado_moderacion),
  ('00000000-0000-4000-8000-000000000414'::uuid, '00000000-0000-4000-8000-000000000101'::uuid, '00000000-0000-4000-8000-000000000303'::uuid, 'Servicio sede inactiva QA HU-026', 'Fixture local con sede inactiva para verificar disponibilidad.', 'EN_SEDE'::modalidad_servicio, 'Consulta general', 20000::numeric, true, 'PUBLICADO'::estado_moderacion)
) AS x(id, aliado_id, sede_id, nombre, descripcion, modalidad, tipo, precio, activo, moderacion)
JOIN tipo_servicio ts ON ts.nombre = x.tipo
ON CONFLICT (id) DO NOTHING;

INSERT INTO servicio_regla_precio (id, servicio_id, especie_id, peso_min_kg, precio, prioridad)
SELECT '00000000-0000-4000-8000-000000000403'::uuid, '00000000-0000-4000-8000-000000000401'::uuid, e.id, 20, 85000, 1
FROM especie e
WHERE e.nombre = 'Perro'
ON CONFLICT (id) DO NOTHING;

INSERT INTO producto (id, aliado_id, categoria_id, nombre, descripcion, precio, stock, activo, moderacion)
SELECT x.id, a.id, c.id, x.nombre, x.descripcion, x.precio, x.stock, true, 'PUBLICADO'
FROM (VALUES
  ('00000000-0000-4000-8000-000000000601'::uuid, 'Alimento balanceado demo', 'Concentrado de prueba para perros.', 95000::numeric, 20, 'Alimentos'),
  ('00000000-0000-4000-8000-000000000602'::uuid, 'Juguete para mascotas demo', 'Juguete de prueba para el catálogo.', 18000::numeric, 35, 'Accesorios')
) AS x(id, nombre, descripcion, precio, stock, categoria)
JOIN aliado a ON a.id = '00000000-0000-4000-8000-000000000103'
JOIN categoria_producto c ON c.nombre = x.categoria
ON CONFLICT (id) DO NOTHING;

-- HU-025: 11 resultados locales para comprobar el límite independiente de 10 por categoría.
INSERT INTO producto (id, aliado_id, categoria_id, nombre, descripcion, precio, stock, activo, moderacion)
SELECT md5('hu025-producto-' || n::text)::uuid,
       '00000000-0000-4000-8000-000000000103'::uuid,
       c.id,
       'HU025 Límite Producto ' || lpad(n::text, 2, '0'),
       'Dato local para validar búsqueda por nombre y límite por categoría.',
       1000,
       10,
       true,
       'PUBLICADO'
  FROM generate_series(1, 11) AS n
  JOIN categoria_producto c ON c.nombre = 'Accesorios'
ON CONFLICT (id) DO NOTHING;

INSERT INTO mascota (id, tutor_id, nombre, especie_id, sexo, raza, edad_meses, color, peso_kg)
SELECT x.id, '00000000-0000-4000-8000-000000000001'::uuid, x.nombre, e.id, x.sexo, x.raza, x.edad_meses, x.color, x.peso
FROM (VALUES
  ('00000000-0000-4000-8000-000000000501'::uuid, 'Luna', 'Perro', 'HEMBRA'::sexo_animal, 'Criolla', 36::smallint, 'Canela', 22.5::numeric),
  ('00000000-0000-4000-8000-000000000502'::uuid, 'Milo', 'Gato', 'MACHO'::sexo_animal, 'Criollo', 18::smallint, 'Atigrado', 4.2::numeric)
) AS x(id, nombre, especie, sexo, raza, edad_meses, color, peso)
JOIN especie e ON e.nombre = x.especie
ON CONFLICT (id) DO NOTHING;

INSERT INTO mascota_foto (id, mascota_id, url)
VALUES
  ('00000000-0000-4000-8000-000000000511', '00000000-0000-4000-8000-000000000501', 'https://example.com/luna-demo.jpg'),
  ('00000000-0000-4000-8000-000000000512', '00000000-0000-4000-8000-000000000502', 'https://example.com/milo-demo.jpg')
ON CONFLICT (id) DO NOTHING;

INSERT INTO horario (id, aliado_id, veterinario_id, dia_semana, hora_inicio, hora_fin)
SELECT
  (substr(md5(v.id::text || ':' || d.dia::text), 1, 8) || '-' ||
   substr(md5(v.id::text || ':' || d.dia::text), 9, 4) || '-' ||
   substr(md5(v.id::text || ':' || d.dia::text), 13, 4) || '-' ||
   substr(md5(v.id::text || ':' || d.dia::text), 17, 4) || '-' ||
   substr(md5(v.id::text || ':' || d.dia::text), 21, 12))::uuid,
  v.aliado_id, v.id, d.dia, '08:00', '18:00'
FROM veterinario v
CROSS JOIN generate_series(1, 7) AS d(dia)
WHERE v.id IN ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202')
ON CONFLICT (id) DO NOTHING;

INSERT INTO mascota_adopcion (id, fundacion_id, nombre, especie_id, edad_meses, sexo, tamano, ubicacion, descripcion, estado)
SELECT x.id, '00000000-0000-4000-8000-000000000104'::uuid, x.nombre, e.id, x.edad, x.sexo, x.tamano, 'Bogotá', x.descripcion, 'DISPONIBLE'
FROM (VALUES
  ('00000000-0000-4000-8000-000000000701'::uuid, 'Nube', 'Perro', 8::smallint, 'HEMBRA'::sexo_animal, 'MEDIANO'::tamano_mascota, 'Perrita sociable para probar el catálogo de adopción.'),
  ('00000000-0000-4000-8000-000000000702'::uuid, 'Copo', 'Gato', 5::smallint, 'MACHO'::sexo_animal, 'PEQUENO'::tamano_mascota, 'Gatito tranquilo para probar filtros y detalle.')
) AS x(id, nombre, especie, edad, sexo, tamano, descripcion)
JOIN especie e ON e.nombre = x.especie
ON CONFLICT (id) DO NOTHING;

INSERT INTO mascota_adopcion_media (id, mascota_adopcion_id, tipo, url, posicion)
VALUES
  ('00000000-0000-4000-8000-000000000711', '00000000-0000-4000-8000-000000000701', 'FOTO', 'https://example.com/nube-demo.jpg', 1),
  ('00000000-0000-4000-8000-000000000712', '00000000-0000-4000-8000-000000000702', 'FOTO', 'https://example.com/copo-demo.jpg', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO cita (id, tutor_id, mascota_id, aliado_id, servicio_id, veterinario_id, inicio, fin, precio, motivo)
VALUES
  ('00000000-0000-4000-8000-000000000801',
   '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000501',
   '00000000-0000-4000-8000-000000000101',
   '00000000-0000-4000-8000-000000000401',
   '00000000-0000-4000-8000-000000000201',
   date_trunc('day', now()) + interval '2 days 10 hours',
   date_trunc('day', now()) + interval '2 days 10 hours 45 minutes',
   65000,
   'Cita de demostración para probar agenda y detalle')
ON CONFLICT (id) DO NOTHING;

INSERT INTO notificacion (id, usuario_id, tipo, mensaje, referencia_id)
VALUES
  ('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000001', 'LOCAL_DEMO', 'Notificación local de demostración.', NULL)
ON CONFLICT (id) DO NOTHING;
