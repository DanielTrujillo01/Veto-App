-- =============================================================================
-- VETO · Pruebas de humo del modelo de datos (historias esenciales)
-- Ejecutar DESPUÉS de aplicar las migraciones:
--     pnpm db:migrate && pnpm db:test
-- Todo corre en una transacción que termina en ROLLBACK: no deja datos.
-- =============================================================================
SET search_path TO veto, public;
BEGIN;

CREATE FUNCTION pg_temp.debe_fallar(p_nombre text, p_sql text, p_sqlstate text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = p_sqlstate THEN
            RAISE NOTICE 'OK   rechazado  | %  (%)', p_nombre, SQLSTATE;
            RETURN;
        END IF;
        RAISE EXCEPTION 'PRUEBA FALLIDA | %: se esperaba %, llegó % (%)', p_nombre, p_sqlstate, SQLSTATE, SQLERRM;
    END;
    RAISE EXCEPTION 'PRUEBA FALLIDA | %: la operación NO fue rechazada', p_nombre;
END $$;

CREATE FUNCTION pg_temp.debe_pasar(p_nombre text, p_condicion boolean) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF p_condicion IS NOT TRUE THEN RAISE EXCEPTION 'PRUEBA FALLIDA | %', p_nombre; END IF;
    RAISE NOTICE 'OK   verificado | %', p_nombre;
END $$;

DO $$
DECLARE
    perro smallint := (SELECT id FROM especie WHERE nombre = 'Perro');
    gato  smallint := (SELECT id FROM especie WHERE nombre = 'Gato');
    t_cons smallint := (SELECT id FROM tipo_servicio WHERE nombre = 'Consulta general');
    cat    smallint := (SELECT id FROM categoria_producto WHERE nombre = 'Alimentos');

    u_tutor uuid; u_tutor2 uuid; u_clinica uuid; u_clinica2 uuid; u_vet uuid; u_vet2 uuid;
    u_tienda uuid; u_fund uuid; u_fund2 uuid; u_admin uuid;
    a_clinica uuid; a_clinica2 uuid; a_tienda uuid; a_fund uuid; a_fund_pend uuid;
    sede1 uuid; sede2 uuid; vet1 uuid; vet2 uuid; srv uuid; masc uuid; masc_gato uuid;
    masc_limite uuid;
    cita1 uuid; cita2 uuid; cons uuid; prod uuid; ped uuid; ped2 uuid; mad uuid;
    dia smallint;
BEGIN
    -- ---------- Usuarios ----------
    INSERT INTO usuario (nombre, celular, correo, password_hash) VALUES ('Tutor Uno','3001112233','tutor@mail.com','h') RETURNING id INTO u_tutor;
    INSERT INTO usuario (nombre, celular, correo, password_hash) VALUES ('Tutor Dos','3001112244','tutor2@mail.com','h') RETURNING id INTO u_tutor2;
    INSERT INTO usuario (nombre, celular, correo, password_hash, rol) VALUES ('Admin Clínica','3002223344','clinica@mail.com','h','ALIADO') RETURNING id INTO u_clinica;
    INSERT INTO usuario (nombre, celular, correo, password_hash, rol) VALUES ('Admin Clínica 2','3002223355','clinica2@mail.com','h','ALIADO') RETURNING id INTO u_clinica2;
    INSERT INTO usuario (nombre, celular, correo, password_hash, rol) VALUES ('Dra. Vet','3003334455','vet@mail.com','h','VETERINARIO') RETURNING id INTO u_vet;
    INSERT INTO usuario (nombre, celular, correo, password_hash, rol) VALUES ('Dr. Vet 2','3003334466','vet2@mail.com','h','VETERINARIO') RETURNING id INTO u_vet2;
    INSERT INTO usuario (nombre, celular, correo, password_hash, rol) VALUES ('Tienda','3004445566','tienda@mail.com','h','ALIADO') RETURNING id INTO u_tienda;
    INSERT INTO usuario (nombre, celular, correo, password_hash, rol) VALUES ('Fundación','3005556677','fund@mail.com','h','ALIADO') RETURNING id INTO u_fund;
    INSERT INTO usuario (nombre, celular, correo, password_hash, rol) VALUES ('Fundación 2','3005556688','fund2@mail.com','h','ALIADO') RETURNING id INTO u_fund2;
    INSERT INTO usuario (nombre, celular, correo, password_hash, rol) VALUES ('Equipo Veto','3006667788','admin@veto.co','h','EQUIPO_VETO') RETURNING id INTO u_admin;

    INSERT INTO desafio_2fa (token_hash, usuario_id, expira_en)
        VALUES ('hu004:verificacion:hash-prueba', u_tutor, now() + interval '15 minutes');
    PERFORM pg_temp.debe_pasar('HU-004 guarda enlaces como desafíos en la tabla existente',
        EXISTS (SELECT 1 FROM desafio_2fa
                 WHERE usuario_id = u_tutor
                   AND token_hash = 'hu004:verificacion:hash-prueba'));
    PERFORM pg_temp.debe_fallar('los tokens de recuperación conservan unicidad en desafio_2fa',
        format($q$INSERT INTO desafio_2fa (token_hash, usuario_id, expira_en)
                  VALUES ('hu004:verificacion:hash-prueba',%L,now()+interval '15 minutes')$q$, u_tutor),
        '23505');

    PERFORM pg_temp.debe_fallar('correo duplicado (sin importar mayúsculas)',
        $q$INSERT INTO usuario (nombre, celular, correo, password_hash) VALUES ('X','3001112299','TUTOR@mail.com','h')$q$, '23505');
    PERFORM pg_temp.debe_fallar('celular con menos de 10 dígitos',
        $q$INSERT INTO usuario (nombre, celular, correo, password_hash) VALUES ('X','300123','x@mail.com','h')$q$, '23514');
    PERFORM pg_temp.debe_fallar('correo con formato inválido',
        $q$INSERT INTO usuario (nombre, celular, correo, password_hash) VALUES ('X','3001112299','no-es-correo','h')$q$, '23514');
    PERFORM pg_temp.debe_fallar('falta el nombre',
        $q$INSERT INTO usuario (nombre, celular, correo, password_hash) VALUES (NULL,'3001112299','y@mail.com','h')$q$, '23502');

    -- ---------- Aliados ----------
    INSERT INTO aliado (usuario_id, tipo, nombre, estado) VALUES (u_clinica,'CLINICA','Clínica Patitas','ACTIVO') RETURNING id INTO a_clinica;
    INSERT INTO aliado (usuario_id, tipo, nombre, estado) VALUES (u_clinica2,'CLINICA','Clínica Otra','ACTIVO') RETURNING id INTO a_clinica2;
    INSERT INTO aliado (usuario_id, tipo, nombre, estado) VALUES (u_tienda,'TIENDA','PetShop','ACTIVO') RETURNING id INTO a_tienda;
    INSERT INTO aliado (usuario_id, tipo, nombre, estado, descripcion, contacto, ciudad, ubicacion, anio_fundacion)
        VALUES (u_fund,'FUNDACION','Fundación Huellas','ACTIVO','Rescate','contacto@huellas.org','Bogotá','Calle 100 (privada)',2015) RETURNING id INTO a_fund;
    PERFORM pg_temp.debe_fallar('fundación sin los datos obligatorios',
        format($q$INSERT INTO aliado (usuario_id, tipo, nombre) VALUES (%L,'FUNDACION','Sin datos')$q$, u_fund2), '23514');
    INSERT INTO aliado (usuario_id, tipo, nombre, descripcion, contacto, ciudad, ubicacion, anio_fundacion)
        VALUES (u_fund2,'FUNDACION','Fundación Nueva','x','c','Bogotá','u',2020) RETURNING id INTO a_fund_pend;
    PERFORM pg_temp.debe_pasar('un aliado nuevo queda PENDIENTE', (SELECT estado FROM aliado WHERE id = a_fund_pend) = 'PENDIENTE');

    INSERT INTO veterinario (aliado_id, usuario_id) VALUES (a_clinica,  u_vet)  RETURNING id INTO vet1;
    INSERT INTO veterinario (aliado_id, usuario_id) VALUES (a_clinica2, u_vet2) RETURNING id INTO vet2;
    INSERT INTO sede (aliado_id, nombre, direccion, ciudad) VALUES (a_clinica,  'Sede Norte','Cra 7 # 60-10','Bogotá') RETURNING id INTO sede1;
    INSERT INTO sede (aliado_id, nombre, direccion, ciudad) VALUES (a_clinica2, 'Sede Sur','Av 1 # 2-3','Bogotá') RETURNING id INTO sede2;
    INSERT INTO aliado_especie VALUES (a_clinica, perro);
    PERFORM pg_temp.debe_fallar('la tienda no puede tener veterinarios',
        format($q$INSERT INTO veterinario (aliado_id, usuario_id) VALUES (%L,%L)$q$, a_tienda, u_tutor), '23514');
    PERFORM pg_temp.debe_fallar('un usuario no tiene dos perfiles de veterinario',
        format($q$INSERT INTO veterinario (aliado_id, usuario_id) VALUES (%L,%L)$q$, a_clinica, u_vet), '23505');

    -- ---------- Servicios y precio variable ----------
    INSERT INTO servicio (aliado_id, tipo_servicio_id, nombre, modalidad, sede_id, precio_base)
        VALUES (a_clinica, t_cons, 'Consulta general', 'EN_SEDE', sede1, 60000) RETURNING id INTO srv;
    PERFORM pg_temp.debe_fallar('la tienda no ofrece servicios',
        format($q$INSERT INTO servicio (aliado_id, tipo_servicio_id, nombre, modalidad, precio_base) VALUES (%L,%L,'x','A_DOMICILIO',1)$q$, a_tienda, t_cons), '23514');
    PERFORM pg_temp.debe_fallar('servicio en sede sin ubicación',
        format($q$INSERT INTO servicio (aliado_id, tipo_servicio_id, nombre, modalidad, precio_base) VALUES (%L,%L,'x','EN_SEDE',1)$q$, a_clinica, t_cons), '23514');
    PERFORM pg_temp.debe_fallar('servicio con la sede de otro aliado',
        format($q$INSERT INTO servicio (aliado_id, tipo_servicio_id, nombre, modalidad, sede_id, precio_base) VALUES (%L,%L,'x','EN_SEDE',%L,1)$q$, a_clinica, t_cons, sede2), '23503');
    PERFORM pg_temp.debe_fallar('precio negativo',
        format($q$UPDATE servicio SET precio_base = -5 WHERE id = %L$q$, srv), '23514');

    INSERT INTO mascota (tutor_id, nombre, especie_id, sexo, peso_kg, edad_meses) VALUES (u_tutor,'Firulais',perro,'MACHO',28,60) RETURNING id INTO masc;
    INSERT INTO mascota (tutor_id, nombre, especie_id, sexo) VALUES (u_tutor,'Misu',gato,'HEMBRA') RETURNING id INTO masc_gato;
    INSERT INTO mascota (tutor_id, nombre, especie_id, sexo, peso_kg, edad_meses)
        VALUES (u_tutor,'Borde',perro,'MACHO',20,60) RETURNING id INTO masc_limite;
    PERFORM pg_temp.debe_fallar('mascota sin sexo',
        format($q$INSERT INTO mascota (tutor_id, nombre, especie_id) VALUES (%L,'X',%L)$q$, u_tutor, perro), '23502');
    INSERT INTO servicio_regla_precio (servicio_id, peso_min_kg, precio, prioridad) VALUES (srv, 20, 90000, 1);
    PERFORM pg_temp.debe_pasar('perro de 28 kg paga la tarifa por peso (90000)', fn_precio_servicio(srv, masc) = 90000);
    PERFORM pg_temp.debe_pasar('el límite inferior de peso es inclusivo', fn_precio_servicio(srv, masc_limite) = 90000);
    PERFORM pg_temp.debe_pasar('mascota sin peso cae en el precio base (60000)', fn_precio_servicio(srv, masc_gato) = 60000);
    INSERT INTO servicio_regla_precio (servicio_id, especie_id, precio, prioridad)
        VALUES (srv, perro, 100000, 2);
    PERFORM pg_temp.debe_pasar('la regla de especie aplica a la especie exacta', fn_precio_servicio(srv, masc) = 100000);
    INSERT INTO servicio_regla_precio
        (servicio_id, edad_min_meses, edad_max_meses, precio, prioridad)
        VALUES (srv, 60, 60, 110000, 3);
    PERFORM pg_temp.debe_pasar('los límites de edad son inclusivos y la prioridad mayor gana', fn_precio_servicio(srv, masc) = 110000);
    INSERT INTO servicio_regla_precio
        (servicio_id, edad_min_meses, edad_max_meses, precio, prioridad)
        VALUES (srv, 60, 60, 120000, 3);
    PERFORM pg_temp.debe_pasar('a igual prioridad gana el precio más alto', fn_precio_servicio(srv, masc) = 120000);
    DELETE FROM servicio_regla_precio WHERE servicio_id = srv;
    INSERT INTO servicio_regla_precio
        (servicio_id, edad_min_meses, edad_max_meses, precio, prioridad)
        VALUES (srv, 0, 12, 50000, 1);
    PERFORM pg_temp.debe_pasar('si falta la edad necesaria no aplica la regla', fn_precio_servicio(srv, masc_gato) = 60000);
    DELETE FROM servicio_regla_precio WHERE servicio_id = srv;
    PERFORM pg_temp.debe_pasar('sin reglas aplicables se usa el precio base', fn_precio_servicio(srv, masc) = 60000);

    -- ---------- Horarios ----------
    INSERT INTO horario (aliado_id, veterinario_id, dia_semana, hora_inicio, hora_fin) VALUES (a_clinica, vet1, 1, '00:00', '24:00');
    PERFORM pg_temp.debe_fallar('horarios solapados del mismo veterinario',
        format($q$INSERT INTO horario (aliado_id, veterinario_id, dia_semana, hora_inicio, hora_fin) VALUES (%L,%L,1,'11:00','14:00')$q$, a_clinica, vet1), '23P01');
    PERFORM pg_temp.debe_fallar('hora de fin antes del inicio',
        format($q$INSERT INTO horario (aliado_id, veterinario_id, dia_semana, hora_inicio, hora_fin) VALUES (%L,%L,2,'12:00','08:00')$q$, a_clinica, vet1), '22000');
    PERFORM pg_temp.debe_fallar('horario de un veterinario que es de otro aliado',
        format($q$INSERT INTO horario (aliado_id, veterinario_id, dia_semana, hora_inicio, hora_fin) VALUES (%L,%L,3,'08:00','12:00')$q$, a_clinica, vet2), '23503');
    FOR dia IN 2..7 LOOP
        INSERT INTO horario (aliado_id, veterinario_id, dia_semana, hora_inicio, hora_fin)
        VALUES (a_clinica, vet1, dia, '00:00', '24:00');
    END LOOP;

    -- ---------- Citas ----------
    PERFORM set_config('app.usuario_id', u_tutor::text, true);
    INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, veterinario_id, inicio, fin, precio)
        VALUES (u_tutor, masc, a_clinica, srv, vet1, now() + interval '2 days', now() + interval '2 days 30 minutes', 90000) RETURNING id INTO cita1;
    INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, veterinario_id, inicio, fin, precio)
        VALUES (u_tutor, masc, a_clinica, srv, vet1, now() + interval '6 days', now() + interval '6 days 30 minutes', 60000) RETURNING id INTO cita2;
    UPDATE sede SET activa = false WHERE id = sede1;
    PERFORM pg_temp.debe_fallar('no se agenda en una sede desactivada',
        format($q$INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, veterinario_id, inicio, fin, precio)
                  VALUES (%L,%L,%L,%L,%L, now() + interval '4 days', now() + interval '4 days 30 minutes',1)$q$,
                u_tutor, masc, a_clinica, srv, vet1), '23514');
    UPDATE sede SET activa = true WHERE id = sede1;
    PERFORM pg_temp.debe_fallar('cita solapada con la del mismo veterinario',
        format($q$INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, veterinario_id, inicio, fin, precio)
                  VALUES (%L,%L,%L,%L,%L, now() + interval '2 days 10 minutes', now() + interval '2 days 40 minutes',1)$q$,
                u_tutor, masc, a_clinica, srv, vet1), '23P01');
    PERFORM pg_temp.debe_fallar('cita duplicada por doble clic',
        format($q$INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, inicio, fin, precio)
                  SELECT tutor_id, mascota_id, aliado_id, servicio_id, inicio, fin, precio FROM cita WHERE id = %L$q$, cita1), '23505');
    PERFORM pg_temp.debe_fallar('cita en el pasado',
        format($q$INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, inicio, fin, precio)
                  VALUES (%L,%L,%L,%L, now() - interval '1 day', now() - interval '1 day' + interval '30 minutes',1)$q$, u_tutor, masc, a_clinica, srv), '23514');
    PERFORM pg_temp.debe_fallar('el aliado no atiende gatos',
        format($q$INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, inicio, fin, precio)
                  VALUES (%L,%L,%L,%L, now() + interval '3 days', now() + interval '3 days 30 minutes',1)$q$, u_tutor, masc_gato, a_clinica, srv), '23514');
    PERFORM pg_temp.debe_fallar('mascota de otro tutor',
        format($q$INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, inicio, fin, precio)
                  VALUES (%L,%L,%L,%L, now() + interval '3 days', now() + interval '3 days 30 minutes',1)$q$, u_tutor2, masc, a_clinica, srv), '23503');
    PERFORM pg_temp.debe_fallar('veterinario de otro aliado',
        format($q$INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, veterinario_id, inicio, fin, precio)
                  VALUES (%L,%L,%L,%L,%L, now() + interval '3 days', now() + interval '3 days 30 minutes',1)$q$, u_tutor, masc, a_clinica, srv, vet2), '23503');

    PERFORM pg_temp.debe_fallar('el tutor no puede finalizar la cita',
        format($q$UPDATE cita SET estado='FINALIZADA' WHERE id=%L$q$, cita1), '42501');
    UPDATE cita SET inicio = now() + interval '5 days', fin = now() + interval '5 days 30 minutes' WHERE id = cita1;   -- reprogramar
    PERFORM pg_temp.debe_pasar('reprogramar deja rastro de la fecha anterior',
        (SELECT count(*) FROM historial_estado WHERE entidad='cita' AND entidad_id=cita1 AND motivo LIKE 'Reprogramada:%') = 1);

    -- ---------- Consulta clínica ----------
    PERFORM set_config('app.usuario_id', u_vet::text, true);
    INSERT INTO consulta (cita_id, mascota_id, veterinario_id, motivo_consulta, estado_mental, condicion_corporal)
        VALUES (cita1, masc, vet1, 'Vómito y decaimiento', 'Alerta', 'Ideal') RETURNING id INTO cons;
    PERFORM pg_temp.debe_fallar('consulta sin motivo',
        format($q$INSERT INTO consulta (cita_id, mascota_id, veterinario_id) VALUES (%L,%L,%L)$q$, cita1, masc, vet1), '23502');
    PERFORM pg_temp.debe_fallar('una cita tiene una sola consulta',
        format($q$INSERT INTO consulta (cita_id, mascota_id, veterinario_id, motivo_consulta) VALUES (%L,%L,%L,'otra')$q$, cita1, masc, vet1), '23505');
    PERFORM pg_temp.debe_fallar('veterinario de otro aliado como responsable',
        format($q$INSERT INTO consulta (cita_id, mascota_id, veterinario_id, motivo_consulta) VALUES (%L,%L,%L,'x')$q$, cita2, masc, vet2), '23514');
    UPDATE consulta SET comportamiento = 'Tranquilo' WHERE id = cons;            -- abierta: editable
    PERFORM pg_temp.debe_fallar('cerrar sin fecha y responsable',
        format($q$UPDATE consulta SET estado='CERRADA' WHERE id=%L$q$, cons), '23514');
    UPDATE consulta SET estado='CERRADA', cerrada_en=now(), cerrada_por=u_vet WHERE id = cons;
    PERFORM pg_temp.debe_fallar('consulta cerrada no se edita',
        format($q$UPDATE consulta SET comportamiento='otro' WHERE id=%L$q$, cons), '55000');
    PERFORM pg_temp.debe_fallar('consulta cerrada no se borra',
        format($q$DELETE FROM consulta WHERE id=%L$q$, cons), '55000');
    INSERT INTO consulta_anotacion (consulta_id, autor_id, campo, texto) VALUES (cons, u_vet, 'comportamiento', 'Era inquieto, no tranquilo');
    PERFORM pg_temp.debe_fallar('las anotaciones no se editan',
        $q$UPDATE consulta_anotacion SET texto='x'$q$, '55000');

    -- Finalizar: el veterinario del aliado sí puede
    UPDATE cita SET estado='FINALIZADA', recomendaciones='Dieta blanda 3 días' WHERE id = cita1;
    PERFORM pg_temp.debe_fallar('cita finalizada ya no cambia de estado',
        format($q$UPDATE cita SET estado='CANCELADA' WHERE id=%L$q$, cita1), '55000');
    PERFORM pg_temp.debe_pasar('la cita finalizada aparece en el historial de la mascota con su consulta',
        (SELECT count(*) FROM v_historial_mascota WHERE mascota_id = masc AND consulta_id = cons AND recomendaciones IS NOT NULL) = 1);
    PERFORM pg_temp.debe_pasar('el historial de estados guardó quién finalizó',
        (SELECT count(*) FROM historial_estado WHERE entidad='cita' AND entidad_id=cita1
            AND estado_nuevo='FINALIZADA' AND cambiado_por=u_vet) = 1);
    -- HU-014: vista de consultas del veterinario
    PERFORM pg_temp.debe_pasar('v_consulta_detalle: el veterinario ve su consulta con cita, servicio y mascota',
        (SELECT count(*) FROM v_consulta_detalle
          WHERE veterinario_id = vet1 AND id = cons AND servicio = 'Consulta general'
            AND mascota_nombre = 'Firulais' AND especie = 'Perro') = 1);
    PERFORM pg_temp.debe_pasar('v_consulta_detalle: otro veterinario no tiene esa consulta',
        (SELECT count(*) FROM v_consulta_detalle WHERE veterinario_id = vet2) = 0);
    PERFORM pg_temp.debe_fallar('el historial de estados no se puede alterar',
        $q$UPDATE historial_estado SET estado_nuevo='X'$q$, '55000');

    PERFORM set_config('app.usuario_id', u_vet2::text, true);
    PERFORM pg_temp.debe_fallar('un veterinario de otra clínica no puede finalizar citas ajenas',
        format($q$UPDATE cita SET estado='FINALIZADA' WHERE id=%L$q$, cita2), '42501');
    PERFORM set_config('app.usuario_id', u_clinica::text, true);
    UPDATE cita SET estado='NO_ASISTIO' WHERE id = cita2;     -- el administrador del aliado sí puede
    PERFORM pg_temp.debe_pasar('el administrador del aliado marca "no asistió"', (SELECT estado FROM cita WHERE id = cita2) = 'NO_ASISTIO');

    -- ---------- Productos y pedidos ----------
    PERFORM set_config('app.usuario_id', u_tutor::text, true);
    INSERT INTO producto (aliado_id, categoria_id, nombre, precio, stock) VALUES (a_tienda, cat, 'Concentrado 10kg', 100000, 5) RETURNING id INTO prod;
    PERFORM pg_temp.debe_fallar('stock negativo',
        format($q$UPDATE producto SET stock = -1 WHERE id=%L$q$, prod), '23514');
    PERFORM pg_temp.debe_fallar('una clínica no vende productos',
        format($q$INSERT INTO producto (aliado_id, categoria_id, nombre, precio) VALUES (%L,%L,'x',1)$q$, a_clinica, cat), '23514');

    INSERT INTO pedido (tutor_id, aliado_id, total) VALUES (u_tutor, a_tienda, 200000) RETURNING id INTO ped;
    INSERT INTO pedido_item (pedido_id, producto_id, cantidad, precio_unitario) VALUES (ped, prod, 2, 100000);
    PERFORM pg_temp.debe_pasar('pedir descuenta stock (5 → 3)', (SELECT stock FROM producto WHERE id = prod) = 3);

    INSERT INTO pedido (tutor_id, aliado_id, total) VALUES (u_tutor, a_tienda, 700000) RETURNING id INTO ped2;
    PERFORM pg_temp.debe_fallar('pedir más unidades que el stock',
        format($q$INSERT INTO pedido_item (pedido_id, producto_id, cantidad, precio_unitario) VALUES (%L,%L,7,100000)$q$, ped2, prod), '23514');

    UPDATE pedido SET estado = 'CANCELADO' WHERE id = ped;
    PERFORM pg_temp.debe_pasar('cancelar antes del despacho devuelve el stock (→ 5)', (SELECT stock FROM producto WHERE id = prod) = 5);
    PERFORM pg_temp.debe_fallar('un pedido cancelado no se reactiva',
        format($q$UPDATE pedido SET estado='CONFIRMADO' WHERE id=%L$q$, ped), '23514');

    INSERT INTO pedido_item (pedido_id, producto_id, cantidad, precio_unitario) VALUES (ped2, prod, 3, 100000);
    PERFORM pg_temp.debe_fallar('el pedido no salta de PENDIENTE a ENTREGADO',
        format($q$UPDATE pedido SET estado='ENTREGADO' WHERE id=%L$q$, ped2), '23514');
    UPDATE pedido SET estado = 'CONFIRMADO' WHERE id = ped2;
    UPDATE pedido SET estado = 'DESPACHADO' WHERE id = ped2;
    PERFORM pg_temp.debe_fallar('no se cancela un pedido ya despachado',
        format($q$UPDATE pedido SET estado='CANCELADO' WHERE id=%L$q$, ped2), '23514');
    PERFORM pg_temp.debe_pasar('el historial del pedido registra cada cambio',
        (SELECT count(*) FROM historial_estado WHERE entidad = 'pedido' AND entidad_id = ped2) = 3);

    UPDATE producto SET activo = false WHERE id = prod;
    PERFORM pg_temp.debe_fallar('no se pide un producto desactivado',
        format($q$INSERT INTO pedido_item (pedido_id, producto_id, cantidad, precio_unitario)
                  VALUES ((SELECT id FROM pedido WHERE id = %L), %L, 1, 1)$q$, ped, prod), '23514');

    -- ---------- Adopción ----------
    PERFORM pg_temp.debe_fallar('fundación PENDIENTE no puede publicar mascotas',
        format($q$INSERT INTO mascota_adopcion (fundacion_id, nombre, especie_id, edad_meses, sexo, tamano, ubicacion)
                  VALUES (%L,'Rocky',%L,12,'MACHO','MEDIANO','Suba')$q$, a_fund_pend, perro), '23514');
    UPDATE aliado SET estado = 'ACTIVO' WHERE id = a_fund_pend;
    INSERT INTO accion_admin (admin_id, objetivo_tipo, objetivo_id, accion)
        VALUES (u_admin, 'aliado', a_fund_pend, 'APROBAR_FUNDACION');
    INSERT INTO mascota_adopcion (fundacion_id, nombre, especie_id, edad_meses, sexo, tamano, ubicacion)
        VALUES (a_fund_pend, 'Nube', perro, 10, 'HEMBRA', 'PEQUENO', 'Suba');
    PERFORM pg_temp.debe_pasar('una fundación aprobada puede publicar mascotas',
        EXISTS (SELECT 1 FROM mascota_adopcion WHERE fundacion_id = a_fund_pend AND nombre = 'Nube'));
    UPDATE aliado SET estado = 'RECHAZADO' WHERE id = a_fund_pend;
    INSERT INTO accion_admin (admin_id, objetivo_tipo, objetivo_id, accion)
        VALUES (u_admin, 'aliado', a_fund_pend, 'RECHAZAR_FUNDACION');
    PERFORM pg_temp.debe_fallar('una fundación rechazada no puede publicar mascotas',
        format($q$INSERT INTO mascota_adopcion (fundacion_id, nombre, especie_id, edad_meses, sexo, tamano, ubicacion)
                  VALUES (%L,'Luna',%L,8,'HEMBRA','PEQUENO','Suba')$q$, a_fund_pend, perro), '23514');
    PERFORM pg_temp.debe_fallar('una clínica no publica mascotas en adopción',
        format($q$INSERT INTO mascota_adopcion (fundacion_id, nombre, especie_id, edad_meses, sexo, tamano, ubicacion)
                  VALUES (%L,'Rocky',%L,12,'MACHO','MEDIANO','Suba')$q$, a_clinica, perro), '23514');
    PERFORM pg_temp.debe_fallar('mascota en adopción sin ubicación',
        format($q$INSERT INTO mascota_adopcion (fundacion_id, nombre, especie_id, edad_meses, sexo, tamano)
                  VALUES (%L,'Rocky',%L,12,'MACHO','MEDIANO')$q$, a_fund, perro), '23502');
    INSERT INTO mascota_adopcion (fundacion_id, nombre, especie_id, edad_meses, sexo, tamano, ubicacion, foto_url)
        VALUES (a_fund, 'Rocky', perro, 12, 'MACHO', 'MEDIANO', 'Suba', 'https://cdn.veto.co/rocky.jpg') RETURNING id INTO mad;
    PERFORM pg_temp.debe_pasar('el catálogo muestra la mascota disponible', (SELECT count(*) FROM v_catalogo_adopcion WHERE id = mad) = 1);
    PERFORM pg_temp.debe_pasar('el catálogo NO expone a la fundación',
        NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'veto' AND table_name = 'v_catalogo_adopcion'
                      AND column_name IN ('fundacion_id','aliado_id','nombre_fundacion','contacto','ciudad','anio_fundacion')));
    UPDATE mascota_adopcion SET estado = 'PAUSADA' WHERE id = mad;
    PERFORM pg_temp.debe_pasar('una publicación pausada sale del catálogo', NOT EXISTS (SELECT 1 FROM v_catalogo_adopcion WHERE id = mad));
    UPDATE mascota_adopcion SET estado = 'DISPONIBLE' WHERE id = mad;

    INSERT INTO solicitud_adopcion (mascota_adopcion_id, tutor_id, datos_personales, hogar_experiencia, motivacion)
        VALUES (mad, u_tutor, '{"nombre":"Tutor Uno"}', '{"vivienda":"apartamento"}', 'Quiero un compañero');
    PERFORM pg_temp.debe_fallar('solicitud activa duplicada para la misma mascota',
        format($q$INSERT INTO solicitud_adopcion (mascota_adopcion_id, tutor_id, datos_personales, hogar_experiencia, motivacion)
                  VALUES (%L,%L,'{}','{}','otra vez')$q$, mad, u_tutor), '23505');
    PERFORM pg_temp.debe_fallar('rechazar una solicitud sin motivo',
        format($q$UPDATE solicitud_adopcion SET estado='RECHAZADA' WHERE mascota_adopcion_id=%L$q$, mad), '23514');
    PERFORM pg_temp.debe_fallar('calificación fuera de 1 a 5',
        format($q$UPDATE solicitud_adopcion SET calificacion = 9 WHERE mascota_adopcion_id=%L$q$, mad), '23514');
    UPDATE solicitud_adopcion SET estado = 'CANCELADA' WHERE mascota_adopcion_id = mad;
    INSERT INTO solicitud_adopcion (mascota_adopcion_id, tutor_id, datos_personales, hogar_experiencia, motivacion)
        VALUES (mad, u_tutor, '{}', '{}', 'ahora sí');
    PERFORM pg_temp.debe_pasar('tras cancelar se permite una nueva solicitud', true);

    -- ---------- Administración, notificaciones, reportes ----------
    INSERT INTO accion_admin (admin_id, objetivo_tipo, objetivo_id, accion, motivo)
        VALUES (u_admin, 'aliado', a_clinica, 'SUSPENDER', 'Incumplimientos reiterados');
    PERFORM pg_temp.debe_fallar('las acciones del Equipo Veto no se alteran',
        $q$DELETE FROM accion_admin$q$, '55000');
    UPDATE aliado SET estado = 'SUSPENDIDO' WHERE id = a_clinica;
    PERFORM pg_temp.debe_fallar('un aliado suspendido no recibe reservas',
        format($q$INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, inicio, fin, precio)
                  VALUES (%L,%L,%L,%L, now() + interval '9 days', now() + interval '9 days 30 minutes',1)$q$, u_tutor, masc, a_clinica, srv), '23514');
    INSERT INTO notificacion (usuario_id, tipo, mensaje, referencia_id) VALUES (u_tutor, 'CITA_FINALIZADA', 'Tu cita finalizó', cita1);

    PERFORM pg_temp.debe_pasar('v_citas_reporte devuelve las citas con sus dimensiones de filtro',
        (SELECT count(*) FROM v_citas_reporte WHERE aliado_id = a_clinica AND especie = 'Perro' AND estado = 'FINALIZADA') = 1);
    PERFORM pg_temp.debe_pasar('v_ventas_productos suma los pedidos',
        (SELECT sum(subtotal) FROM v_ventas_productos WHERE aliado_id = a_tienda AND estado = 'DESPACHADO') = 300000);

    -- ---------- HU-009 · Un tutor registra varias mascotas independientes ----------
    DECLARE
        m1 uuid; m2 uuid; antes record;
    BEGIN
        INSERT INTO mascota (tutor_id, nombre, especie_id, sexo, color) VALUES (u_tutor2,'Rocky',perro,'MACHO','Negro') RETURNING id INTO m1;
        INSERT INTO mascota (tutor_id, nombre, especie_id, sexo, color) VALUES (u_tutor2,'Rocky',gato,'HEMBRA','Blanco') RETURNING id INTO m2;
        INSERT INTO mascota_foto (mascota_id, url) VALUES (m1,'https://fotos.veto.co/1.jpg'), (m2,'https://fotos.veto.co/2.jpg');
        PERFORM pg_temp.debe_pasar('un tutor puede tener varias mascotas, incluso con el mismo nombre',
            (SELECT count(*) FROM mascota WHERE tutor_id = u_tutor2) = 2);
        SELECT nombre, especie_id, sexo, color INTO antes FROM mascota WHERE id = m2;
        -- Lo mismo que hace MascotasRepository al editar m1
        UPDATE mascota SET nombre = 'Rocky Jr', color = 'Café' WHERE id = m1 AND tutor_id = u_tutor2;
        DELETE FROM mascota_foto WHERE mascota_id = m1;
        INSERT INTO mascota_foto (mascota_id, url) VALUES (m1,'https://fotos.veto.co/1b.jpg');
        PERFORM pg_temp.debe_pasar('editar una mascota no cambia los datos de las demás',
            (SELECT (nombre, especie_id, sexo, color) = (antes.nombre, antes.especie_id, antes.sexo, antes.color) FROM mascota WHERE id = m2));
        PERFORM pg_temp.debe_pasar('editar las fotos de una mascota no toca las de las demás',
            (SELECT array_agg(url) FROM mascota_foto WHERE mascota_id = m2) = ARRAY['https://fotos.veto.co/2.jpg']);
        PERFORM pg_temp.debe_pasar('una mascota de otro tutor no se edita con el filtro por tutor',
            NOT EXISTS (SELECT 1 FROM mascota WHERE id = masc AND tutor_id = u_tutor2));
    END;

    -- ---------- HU-006 · Eliminar cuenta: anonimizar y conservar ----------
    DECLARE
        u_borrar uuid; masc_b uuid; srv_b uuid; cita_b uuid;
    BEGIN
        INSERT INTO usuario (nombre, celular, correo, password_hash) VALUES ('Tutor Borrar','3007778899','borrar@mail.com','h') RETURNING id INTO u_borrar;
        INSERT INTO mascota (tutor_id, nombre, especie_id, sexo) VALUES (u_borrar,'Toby',perro,'MACHO') RETURNING id INTO masc_b;
        INSERT INTO aliado_especie VALUES (a_clinica2, perro);
        INSERT INTO servicio (aliado_id, tipo_servicio_id, nombre, modalidad, precio_base)
            VALUES (a_clinica2, t_cons, 'Consulta a domicilio', 'A_DOMICILIO', 50000) RETURNING id INTO srv_b;
        PERFORM set_config('app.usuario_id', u_borrar::text, true);
        INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, inicio, fin, precio)
            VALUES (u_borrar, masc_b, a_clinica2, srv_b, now() + interval '4 days', now() + interval '4 days 30 minutes', 50000) RETURNING id INTO cita_b;

        -- Lo mismo que hace IdentidadService.eliminarCuenta
        UPDATE cita SET estado = 'CANCELADA' WHERE tutor_id = u_borrar AND estado IN ('PENDIENTE','AGENDADA') AND inicio > now();
        UPDATE usuario SET estado = 'ELIMINADA', eliminado_en = now(), nombre = 'Usuario eliminado',
               celular = '0000000000', correo = 'eliminado+' || u_borrar || '@veto.invalid', password_hash = 'ELIMINADA'
         WHERE id = u_borrar;
        PERFORM pg_temp.debe_pasar('la cuenta eliminada queda anonimizada y cumple las reglas',
            (SELECT estado = 'ELIMINADA' AND eliminado_en IS NOT NULL AND correo <> 'borrar@mail.com' FROM usuario WHERE id = u_borrar));
        PERFORM pg_temp.debe_pasar('las citas futuras de la cuenta eliminada se cancelan con historial',
            (SELECT estado FROM cita WHERE id = cita_b) = 'CANCELADA'
            AND EXISTS (SELECT 1 FROM historial_estado WHERE entidad = 'cita' AND entidad_id = cita_b AND estado_nuevo = 'CANCELADA'));
        PERFORM pg_temp.debe_pasar('las mascotas de la cuenta eliminada se conservan', EXISTS (SELECT 1 FROM mascota WHERE id = masc_b));
        INSERT INTO usuario (nombre, celular, correo, password_hash) VALUES ('Nuevo','3007778800','borrar@mail.com','h');
        PERFORM pg_temp.debe_pasar('el correo de la cuenta eliminada se puede volver a registrar', true);

        -- ---------- HU-018 · Servicios desactivados y citas históricas ----------
        PERFORM set_config('app.usuario_id', u_tutor::text, true);
        INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, inicio, fin, precio)
            VALUES (u_tutor, masc, a_clinica2, srv_b, now() + interval '8 days', now() + interval '8 days 30 minutes', 50000) RETURNING id INTO cita_b;
        UPDATE servicio SET activo = false, precio_base = 70000, nombre = 'Consulta a domicilio (nueva)' WHERE id = srv_b;
        PERFORM pg_temp.debe_fallar('un servicio desactivado no recibe nuevas reservas',
            format($q$INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, inicio, fin, precio)
                      VALUES (%L,%L,%L,%L, now() + interval '10 days', now() + interval '10 days 30 minutes',1)$q$, u_tutor, masc, a_clinica2, srv_b), '23514');
        PERFORM pg_temp.debe_pasar('editar el servicio no cambia el precio de las citas ya reservadas',
            (SELECT precio FROM cita WHERE id = cita_b) = 50000);
        PERFORM set_config('app.usuario_id', u_clinica2::text, true);
        UPDATE cita SET estado = 'FINALIZADA' WHERE id = cita_b;
        PERFORM pg_temp.debe_pasar('una cita existente de un servicio desactivado se puede finalizar',
            (SELECT estado FROM cita WHERE id = cita_b) = 'FINALIZADA');
    END;

    -- ---------- HU-023 · Confirmación automática o manual de las citas ----------
    DECLARE
        c_auto uuid; c_man uuid; c_forzada uuid; c_rech uuid; c_tutor uuid; c_pend uuid; c_vet uuid;
    BEGIN
        PERFORM pg_temp.debe_pasar('por defecto la confirmación es automática',
            (SELECT modo_confirmacion FROM aliado WHERE id = a_clinica) = 'AUTOMATICA');
        UPDATE aliado SET estado = 'ACTIVO' WHERE id = a_clinica;   -- las pruebas anteriores la suspendieron
        PERFORM set_config('app.usuario_id', u_tutor::text, true);

        -- Automática: la reserva válida queda confirmada (AGENDADA)
        INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, veterinario_id, inicio, fin, precio)
            VALUES (u_tutor, masc, a_clinica, srv, vet1, now() + interval '20 days', now() + interval '20 days 30 minutes', 60000) RETURNING id INTO c_auto;
        PERFORM pg_temp.debe_pasar('automática: la reserva válida queda AGENDADA',
            (SELECT estado FROM cita WHERE id = c_auto) = 'AGENDADA');

        -- Manual: la reserva válida queda pendiente de aceptación
        UPDATE aliado SET modo_confirmacion = 'MANUAL' WHERE id = a_clinica;
        INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, veterinario_id, inicio, fin, precio)
            VALUES (u_tutor, masc, a_clinica, srv, vet1, now() + interval '21 days', now() + interval '21 days 30 minutes', 60000) RETURNING id INTO c_man;
        PERFORM pg_temp.debe_pasar('manual: la reserva válida queda PENDIENTE',
            (SELECT estado FROM cita WHERE id = c_man) = 'PENDIENTE');
        PERFORM pg_temp.debe_pasar('el historial registra la cita nueva como PENDIENTE',
            EXISTS (SELECT 1 FROM historial_estado WHERE entidad = 'cita' AND entidad_id = c_man
                      AND estado_anterior IS NULL AND estado_nuevo = 'PENDIENTE'));
        PERFORM pg_temp.debe_pasar('la configuración es por aliado (la otra clínica sigue automática)',
            (SELECT modo_confirmacion FROM aliado WHERE id = a_clinica2) = 'AUTOMATICA');

        -- Quien reserva no elige el estado: lo decide la configuración
        INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, veterinario_id, inicio, fin, precio, estado)
            VALUES (u_tutor, masc, a_clinica, srv, vet1, now() + interval '22 days', now() + interval '22 days 30 minutes', 60000, 'AGENDADA') RETURNING id INTO c_forzada;
        PERFORM pg_temp.debe_pasar('en modo manual no se puede reservar ya confirmada',
            (SELECT estado FROM cita WHERE id = c_forzada) = 'PENDIENTE');
        PERFORM pg_temp.debe_fallar('una cita nueva no puede nacer finalizada',
            format($q$INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, veterinario_id, inicio, fin, precio, estado)
                      VALUES (%L,%L,%L,%L,%L, now() + interval '23 days', now() + interval '23 days 30 minutes', 1, 'FINALIZADA')$q$,
                   u_tutor, masc, a_clinica, srv, vet1), '23514');

        -- Sin reservas duplicadas para el mismo espacio: la cita pendiente también lo ocupa
        PERFORM pg_temp.debe_fallar('una cita pendiente ocupa el espacio del veterinario',
            format($q$INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, veterinario_id, inicio, fin, precio)
                      VALUES (%L,%L,%L,%L,%L, now() + interval '21 days 10 minutes', now() + interval '21 days 40 minutes', 1)$q$,
                   u_tutor, masc, a_clinica, srv, vet1), '23P01');
        PERFORM pg_temp.debe_fallar('doble clic: la solicitud pendiente no se duplica',
            format($q$INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, inicio, fin, precio)
                      SELECT tutor_id, mascota_id, aliado_id, servicio_id, inicio, fin, precio FROM cita WHERE id = %L$q$, c_man), '23505');

        -- Aceptar: solo el aliado; el tutor no puede confirmar su propia cita
        PERFORM pg_temp.debe_fallar('el tutor no puede aceptar su propia cita',
            format($q$UPDATE cita SET estado = 'AGENDADA' WHERE id = %L$q$, c_man), '42501');
        PERFORM set_config('app.usuario_id', u_clinica::text, true);
        PERFORM pg_temp.debe_fallar('una cita pendiente no se finaliza sin aceptarla antes',
            format($q$UPDATE cita SET estado = 'FINALIZADA' WHERE id = %L$q$, c_man), '23514');
        PERFORM pg_temp.debe_fallar('una cita pendiente no admite consulta clínica',
            format($q$INSERT INTO consulta (cita_id, mascota_id, veterinario_id, motivo_consulta) VALUES (%L,%L,%L,'x')$q$, c_man, masc, vet1), '23514');
        UPDATE cita SET estado = 'AGENDADA' WHERE id = c_man;
        PERFORM pg_temp.debe_pasar('el aliado acepta la cita pendiente y queda AGENDADA con historial',
            (SELECT estado FROM cita WHERE id = c_man) = 'AGENDADA'
            AND EXISTS (SELECT 1 FROM historial_estado WHERE entidad = 'cita' AND entidad_id = c_man
                          AND estado_anterior = 'PENDIENTE' AND estado_nuevo = 'AGENDADA' AND cambiado_por = u_clinica));
        PERFORM pg_temp.debe_fallar('una cita confirmada no vuelve a pendiente',
            format($q$UPDATE cita SET estado = 'PENDIENTE' WHERE id = %L$q$, c_man), '23514');

        -- Rechazar: el aliado la cancela y el espacio queda libre
        PERFORM set_config('app.usuario_id', u_tutor::text, true);
        INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, veterinario_id, inicio, fin, precio)
            VALUES (u_tutor, masc, a_clinica, srv, vet1, now() + interval '24 days', now() + interval '24 days 30 minutes', 60000) RETURNING id INTO c_rech;
        PERFORM set_config('app.usuario_id', u_clinica::text, true);
        PERFORM set_config('app.motivo', 'Sin disponibilidad', true);
        UPDATE cita SET estado = 'CANCELADA' WHERE id = c_rech;
        PERFORM set_config('app.motivo', '', true);
        PERFORM pg_temp.debe_pasar('el aliado rechaza la cita pendiente (CANCELADA) y queda el motivo',
            (SELECT estado FROM cita WHERE id = c_rech) = 'CANCELADA'
            AND EXISTS (SELECT 1 FROM historial_estado WHERE entidad = 'cita' AND entidad_id = c_rech
                          AND estado_anterior = 'PENDIENTE' AND estado_nuevo = 'CANCELADA' AND motivo = 'Sin disponibilidad'));
        PERFORM set_config('app.usuario_id', u_tutor::text, true);
        INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, veterinario_id, inicio, fin, precio)
            VALUES (u_tutor, masc, a_clinica, srv, vet1, now() + interval '24 days', now() + interval '24 days 30 minutes', 60000);
        PERFORM pg_temp.debe_pasar('al rechazarse una cita pendiente su espacio se puede volver a reservar', true);

        -- El tutor puede cancelar mientras espera
        INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, veterinario_id, inicio, fin, precio)
            VALUES (u_tutor, masc, a_clinica, srv, vet1, now() + interval '25 days', now() + interval '25 days 30 minutes', 60000) RETURNING id INTO c_tutor;
        UPDATE cita SET estado = 'CANCELADA' WHERE id = c_tutor;
        PERFORM pg_temp.debe_pasar('el tutor cancela una cita mientras espera la aceptación',
            (SELECT estado FROM cita WHERE id = c_tutor) = 'CANCELADA');

        -- El veterinario del aliado también puede aceptar
        INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, veterinario_id, inicio, fin, precio)
            VALUES (u_tutor, masc, a_clinica, srv, vet1, now() + interval '26 days', now() + interval '26 days 30 minutes', 60000) RETURNING id INTO c_vet;
        PERFORM set_config('app.usuario_id', u_vet::text, true);
        UPDATE cita SET estado = 'AGENDADA' WHERE id = c_vet;
        PERFORM pg_temp.debe_pasar('el veterinario del aliado acepta la cita',
            (SELECT estado FROM cita WHERE id = c_vet) = 'AGENDADA');
        PERFORM set_config('app.usuario_id', u_vet2::text, true);
        INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, veterinario_id, inicio, fin, precio)
            VALUES (u_tutor, masc, a_clinica, srv, vet1, now() + interval '27 days', now() + interval '27 days 30 minutes', 60000) RETURNING id INTO c_pend;
        PERFORM pg_temp.debe_fallar('un veterinario de otra clínica no acepta citas ajenas',
            format($q$UPDATE cita SET estado = 'AGENDADA' WHERE id = %L$q$, c_pend), '42501');

        -- Volver a automática solo afecta a las reservas nuevas
        UPDATE aliado SET modo_confirmacion = 'AUTOMATICA' WHERE id = a_clinica;
        PERFORM pg_temp.debe_pasar('al pasar a automática, la cita pendiente sigue pendiente',
            (SELECT estado FROM cita WHERE id = c_pend) = 'PENDIENTE');
        PERFORM set_config('app.usuario_id', u_tutor::text, true);
        INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, veterinario_id, inicio, fin, precio)
            VALUES (u_tutor, masc, a_clinica, srv, vet1, now() + interval '28 days', now() + interval '28 days 30 minutes', 60000) RETURNING id INTO c_auto;
        PERFORM pg_temp.debe_pasar('al pasar a automática, las reservas nuevas quedan AGENDADA',
            (SELECT estado FROM cita WHERE id = c_auto) = 'AGENDADA');
    END;

    RAISE NOTICE '=== TODAS LAS PRUEBAS PASARON ===';
END $$;
ROLLBACK;
