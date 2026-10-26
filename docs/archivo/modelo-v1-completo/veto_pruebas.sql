-- =============================================================================
-- VETO · Pruebas de humo del modelo de datos
-- Ejecutar DESPUÉS de veto_schema.sql, en una base de datos de prueba:
--     psql -d veto_test -v ON_ERROR_STOP=1 -f veto_pruebas.sql
-- Todo corre dentro de una transacción que termina en ROLLBACK: no deja datos.
-- Cada prueba "debe fallar" verifica además el código SQLSTATE del rechazo.
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
            RAISE NOTICE 'OK   rechazado  | %  (% )', p_nombre, SQLSTATE;
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
    t_consulta smallint := (SELECT id FROM tipo_servicio WHERE nombre = 'Consulta general');
    t_bano     smallint := (SELECT id FROM tipo_servicio WHERE nombre = 'Baño y peluquería');
    cat_alim   smallint := (SELECT id FROM categoria_producto WHERE nombre = 'Alimentos');

    u_tutor uuid; u_clinica uuid; u_vet uuid; u_tienda uuid; u_fund uuid; u_admin uuid; u_tutor2 uuid;
    a_clinica uuid; a_tienda uuid; a_fund uuid; a_fund_pend uuid;
    sede1 uuid; vet1 uuid; srv uuid; srv_bano uuid; masc uuid; masc_gato uuid;
    cita1 uuid; cita2 uuid; cons uuid; prod uuid; ped uuid; pg1 uuid; mad uuid; plan_p uuid;
    n int;
BEGIN
    -- ---------- Personas ----------
    INSERT INTO usuario (nombre_completo, celular, correo, estado) VALUES ('Tutor Uno','3001112233','tutor@mail.com','ACTIVA') RETURNING id INTO u_tutor;
    INSERT INTO usuario (nombre_completo, celular, correo, estado) VALUES ('Tutor Dos','3001112244','tutor2@mail.com','ACTIVA') RETURNING id INTO u_tutor2;
    INSERT INTO usuario (nombre_completo, celular, correo, estado) VALUES ('Admin Clínica','3002223344','clinica@mail.com','ACTIVA') RETURNING id INTO u_clinica;
    INSERT INTO usuario (nombre_completo, celular, correo, estado) VALUES ('Dra. Vet','3003334455','vet@mail.com','ACTIVA') RETURNING id INTO u_vet;
    INSERT INTO usuario (nombre_completo, celular, correo, estado) VALUES ('Tienda','3004445566','tienda@mail.com','ACTIVA') RETURNING id INTO u_tienda;
    INSERT INTO usuario (nombre_completo, celular, correo, estado) VALUES ('Fundación','3005556677','fund@mail.com','ACTIVA') RETURNING id INTO u_fund;
    INSERT INTO usuario (nombre_completo, celular, correo, estado) VALUES ('Equipo Veto','3006667788','admin@veto.co','ACTIVA') RETURNING id INTO u_admin;
    INSERT INTO equipo_veto (usuario_id, rol) VALUES (u_admin, 'ADMIN');
    PERFORM set_config('app.usuario_id', u_admin::text, true);

    PERFORM pg_temp.debe_fallar('correo duplicado (sin importar mayúsculas)',
        $q$INSERT INTO usuario (nombre_completo, celular, correo) VALUES ('X','3001112233','TUTOR@mail.com')$q$, '23505');
    PERFORM pg_temp.debe_fallar('celular con menos de 10 dígitos',
        $q$INSERT INTO usuario (nombre_completo, celular, correo) VALUES ('X','300123','x@mail.com')$q$, '23514');
    PERFORM pg_temp.debe_fallar('correo con formato inválido',
        $q$INSERT INTO usuario (nombre_completo, celular, correo) VALUES ('X','3001112299','no-es-correo')$q$, '23514');

    -- ---------- Aliados ----------
    INSERT INTO aliado (tipo, nombre_comercial, documento, estado_verificacion, verificado_por, verificado_en)
        VALUES ('CLINICA','Clínica Patitas','900111','APROBADO',u_admin,now()) RETURNING id INTO a_clinica;
    INSERT INTO aliado (tipo, nombre_comercial, documento, estado_verificacion, verificado_por, verificado_en)
        VALUES ('TIENDA','PetShop','900222','APROBADO',u_admin,now()) RETURNING id INTO a_tienda;
    INSERT INTO aliado (tipo, nombre_comercial, documento, estado_verificacion, verificado_por, verificado_en)
        VALUES ('FUNDACION','Fundación Huellas','900333','APROBADO',u_admin,now()) RETURNING id INTO a_fund;
    INSERT INTO aliado (tipo, nombre_comercial, documento) VALUES ('FUNDACION','Fundación Nueva','900444') RETURNING id INTO a_fund_pend;
    INSERT INTO miembro_aliado (aliado_id, usuario_id, rol) VALUES (a_clinica,u_clinica,'ADMIN'),(a_clinica,u_vet,'VETERINARIO'),
                                                                  (a_tienda,u_tienda,'ADMIN'),(a_fund,u_fund,'ADMIN');
    INSERT INTO veterinario (aliado_id, usuario_id, matricula_profesional) VALUES (a_clinica,u_vet,'MV-12345') RETURNING id INTO vet1;
    INSERT INTO sede (aliado_id, nombre, direccion, localidad) VALUES (a_clinica,'Sede Chapinero','Cra 7 # 60-10','Chapinero') RETURNING id INTO sede1;
    INSERT INTO aliado_especie VALUES (a_clinica, perro);

    PERFORM pg_temp.debe_fallar('rechazo sin motivo',
        format($q$INSERT INTO aliado (tipo, nombre_comercial, documento, estado_verificacion, verificado_por, verificado_en)
                  VALUES ('CLINICA','X','900999','RECHAZADO',%L,now())$q$, u_admin), '23514');
    PERFORM pg_temp.debe_fallar('documento de aliado duplicado',
        $q$INSERT INTO aliado (tipo, nombre_comercial, documento) VALUES ('TIENDA','Otra','900222')$q$, '23505');
    PERFORM pg_temp.debe_fallar('la tienda no puede tener perfil de veterinario',
        format($q$INSERT INTO veterinario (aliado_id, usuario_id, matricula_profesional) VALUES (%L,%L,'MV-1')$q$, a_tienda, u_tienda), '23514');
    PERFORM pg_temp.debe_fallar('veterinario que no es miembro del aliado',
        format($q$INSERT INTO veterinario (aliado_id, usuario_id, matricula_profesional) VALUES (%L,%L,'MV-2')$q$, a_clinica, u_tutor), '23503');
    PERFORM pg_temp.debe_fallar('matrícula profesional duplicada',
        format($q$INSERT INTO veterinario (aliado_id, usuario_id, matricula_profesional) VALUES (%L,%L,'MV-12345')$q$, a_clinica, u_clinica), '23505');

    -- ---------- Servicios y precio variable ----------
    INSERT INTO servicio (aliado_id, tipo_servicio_id, nombre, modalidad, sede_id, precio_base)
        VALUES (a_clinica, t_consulta, 'Consulta general', 'EN_SEDE', sede1, 60000) RETURNING id INTO srv;
    INSERT INTO servicio (aliado_id, tipo_servicio_id, nombre, modalidad, sede_id, precio_base)
        VALUES (a_clinica, t_bano, 'Baño completo', 'EN_SEDE', sede1, 40000) RETURNING id INTO srv_bano;
    PERFORM pg_temp.debe_fallar('la tienda no ofrece servicios',
        format($q$INSERT INTO servicio (aliado_id, tipo_servicio_id, nombre, modalidad, sede_id, precio_base)
                  VALUES (%L,%L,'Consulta','A_DOMICILIO',NULL,1000)$q$, a_tienda, t_consulta), '23514');
    PERFORM pg_temp.debe_fallar('servicio en sede sin sede',
        format($q$INSERT INTO servicio (aliado_id, tipo_servicio_id, nombre, modalidad, precio_base)
                  VALUES (%L,%L,'X','EN_SEDE',1000)$q$, a_clinica, t_consulta), '23514');

    INSERT INTO mascota (tutor_id, nombre, especie_id, sexo, peso_kg, edad_aproximada_meses) VALUES (u_tutor,'Firulais',perro,'MACHO',28,60) RETURNING id INTO masc;
    INSERT INTO mascota (tutor_id, nombre, especie_id, sexo) VALUES (u_tutor,'Misu',gato,'HEMBRA') RETURNING id INTO masc_gato;
    INSERT INTO servicio_regla_precio (servicio_id, peso_min_kg, precio, prioridad) VALUES (srv, 20, 90000, 1);
    PERFORM pg_temp.debe_pasar('perro de 28 kg paga la tarifa por peso (90000)', fn_precio_servicio(srv, masc) = 90000);
    PERFORM pg_temp.debe_pasar('mascota sin peso cae en el precio base (60000)', fn_precio_servicio(srv, masc_gato) = 60000);

    -- ---------- Horarios ----------
    INSERT INTO horario_atencion (aliado_id, veterinario_id, dia_semana, hora_inicio, hora_fin) VALUES (a_clinica, vet1, 1, '08:00', '12:00');
    PERFORM pg_temp.debe_fallar('horarios solapados del mismo veterinario',
        format($q$INSERT INTO horario_atencion (aliado_id, veterinario_id, dia_semana, hora_inicio, hora_fin) VALUES (%L,%L,1,'11:00','14:00')$q$, a_clinica, vet1), '23P01');
    INSERT INTO horario_atencion (aliado_id, veterinario_id, dia_semana, hora_inicio, hora_fin) VALUES (a_clinica, vet1, 1, '14:00', '18:00');

    -- ---------- Citas ----------
    INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, sede_id, veterinario_id, inicio, fin, modalidad, precio_acordado, estado, clave_idempotencia)
        VALUES (u_tutor, masc, a_clinica, srv, sede1, vet1, now() + interval '2 days', now() + interval '2 days 30 minutes', 'EN_SEDE', 90000, 'CONFIRMADA', 'k1')
        RETURNING id INTO cita1;
    PERFORM pg_temp.debe_fallar('cita solapada con la del mismo veterinario',
        format($q$INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, sede_id, veterinario_id, inicio, fin, modalidad, precio_acordado)
                  VALUES (%L,%L,%L,%L,%L,%L, now() + interval '2 days 10 minutes', now() + interval '2 days 40 minutes','EN_SEDE',1000)$q$,
                u_tutor, masc, a_clinica, srv, sede1, vet1), '23P01');
    PERFORM pg_temp.debe_fallar('doble clic: misma clave de idempotencia',
        format($q$INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, sede_id, veterinario_id, inicio, fin, modalidad, precio_acordado, clave_idempotencia)
                  VALUES (%L,%L,%L,%L,%L,%L, now() + interval '5 days', now() + interval '5 days 30 minutes','EN_SEDE',1000,'k1')$q$,
                u_tutor, masc, a_clinica, srv, sede1, vet1), '23505');
    PERFORM pg_temp.debe_fallar('cita en el pasado',
        format($q$INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, sede_id, inicio, fin, modalidad, precio_acordado)
                  VALUES (%L,%L,%L,%L,%L, now() - interval '1 day', now() - interval '1 day' + interval '30 minutes','EN_SEDE',1000)$q$,
                u_tutor, masc, a_clinica, srv, sede1), '23514');
    PERFORM pg_temp.debe_fallar('el aliado no atiende gatos',
        format($q$INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, sede_id, inicio, fin, modalidad, precio_acordado)
                  VALUES (%L,%L,%L,%L,%L, now() + interval '3 days', now() + interval '3 days 30 minutes','EN_SEDE',1000)$q$,
                u_tutor, masc_gato, a_clinica, srv, sede1), '23514');
    PERFORM pg_temp.debe_fallar('mascota de otro tutor',
        format($q$INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, sede_id, inicio, fin, modalidad, precio_acordado)
                  VALUES (%L,%L,%L,%L,%L, now() + interval '3 days', now() + interval '3 days 30 minutes','EN_SEDE',1000)$q$,
                u_tutor2, masc, a_clinica, srv, sede1), '23503');
    PERFORM pg_temp.debe_fallar('el tutor no puede finalizar la cita',
        format($q$UPDATE cita SET estado='FINALIZADA', cerrada_por=%L WHERE id=%L$q$, u_tutor, cita1), '42501');
    PERFORM pg_temp.debe_fallar('cita CONFIRMADA no pasa a SOLICITADA',
        format($q$UPDATE cita SET estado='SOLICITADA' WHERE id=%L$q$, cita1), '23514');

    -- Consulta clínica: bloqueada para servicios sin historia (baño)
    INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, sede_id, inicio, fin, modalidad, precio_acordado, estado)
        VALUES (u_tutor, masc, a_clinica, srv_bano, sede1, now() + interval '4 days', now() + interval '4 days 1 hour','EN_SEDE',40000,'CONFIRMADA')
        RETURNING id INTO cita2;
    PERFORM pg_temp.debe_fallar('un baño no genera historia clínica',
        format($q$INSERT INTO consulta (cita_id, mascota_id, veterinario_id, motivo_consulta) VALUES (%L,%L,%L,'x')$q$, cita2, masc, vet1), '23514');

    INSERT INTO consulta (cita_id, mascota_id, veterinario_id, motivo_consulta, propietario_snapshot)
        VALUES (cita1, masc, vet1, 'Vómito y decaimiento', jsonb_build_object('nombre','Tutor Uno','cedula','123')) RETURNING id INTO cons;
    INSERT INTO signos_vitales (consulta_id, peso_kg, temperatura_c) VALUES (cons, 28.5, 39.2);
    PERFORM pg_temp.debe_fallar('temperatura fuera de rango',
        format($q$UPDATE signos_vitales SET temperatura_c = 60 WHERE consulta_id=%L$q$, cons), '23514');
    PERFORM pg_temp.debe_fallar('no se puede cerrar sin diagnóstico presuntivo',
        format($q$UPDATE consulta SET estado='CERRADA', cerrada_en=now(), cerrada_por=%L WHERE id=%L$q$, u_vet, cons), '23514');

    UPDATE consulta SET diagnostico_presuntivo='Gastroenteritis', tratamiento='Dieta blanda' WHERE id = cons;   -- abierta: editable
    UPDATE consulta SET estado='CERRADA', cerrada_en=now(), cerrada_por=u_vet WHERE id = cons;
    PERFORM pg_temp.debe_fallar('consulta cerrada no se edita',
        format($q$UPDATE consulta SET tratamiento='otro' WHERE id=%L$q$, cons), '55000');
    PERFORM pg_temp.debe_fallar('consulta cerrada no se borra',
        format($q$DELETE FROM consulta WHERE id=%L$q$, cons), '55000');
    PERFORM pg_temp.debe_fallar('signos vitales congelados al cerrar',
        format($q$UPDATE signos_vitales SET peso_kg=30 WHERE consulta_id=%L$q$, cons), '55000');
    INSERT INTO consulta_anotacion (consulta_id, autor_id, campo, texto) VALUES (cons, u_vet, 'tratamiento', 'Se agrega suero oral');
    PERFORM pg_temp.debe_fallar('anotaciones no se editan',
        $q$UPDATE consulta_anotacion SET texto='x'$q$, '55000');
    INSERT INTO control_seguimiento (consulta_id, mascota_id, fecha_control) VALUES (cons, masc, current_date + 7);
    PERFORM pg_temp.debe_fallar('control de seguimiento con mascota que no corresponde',
        format($q$INSERT INTO control_seguimiento (consulta_id, mascota_id, fecha_control) VALUES (%L,%L,current_date)$q$, cons, masc_gato), '23503');

    -- Finalizar: el veterinario (usuario del aliado) sí puede
    PERFORM set_config('app.usuario_id', u_vet::text, true);
    UPDATE cita SET estado='FINALIZADA', cerrada_por=u_vet, recomendaciones='Dieta blanda 3 días' WHERE id = cita1;
    PERFORM pg_temp.debe_pasar('finalizar fija cerrada_en automáticamente', (SELECT cerrada_en FROM cita WHERE id=cita1) IS NOT NULL);
    PERFORM pg_temp.debe_fallar('cita finalizada ya no cambia de estado',
        format($q$UPDATE cita SET estado='CANCELADA' WHERE id=%L$q$, cita1), '55000');
    PERFORM pg_temp.debe_pasar('la cita finalizada aparece en el historial de la mascota',
        (SELECT count(*) FROM v_historial_mascota WHERE mascota_id = masc AND consulta_id = cons) = 1);
    PERFORM pg_temp.debe_pasar('historial_estado registró SOLICITADA/CONFIRMADA→FINALIZADA con autor',
        (SELECT count(*) FROM historial_estado WHERE entidad='cita' AND entidad_id=cita1 AND cambiado_por=u_vet AND estado_nuevo='FINALIZADA') = 1);

    -- Reseñas
    PERFORM pg_temp.debe_fallar('reseñar una cita no finalizada',
        format($q$INSERT INTO resena (cita_id, tutor_id, aliado_id, calificacion) VALUES (%L,%L,%L,5)$q$, cita2, u_tutor, a_clinica), '23514');
    INSERT INTO resena (cita_id, tutor_id, aliado_id, calificacion, comentario) VALUES (cita1, u_tutor, a_clinica, 5, 'Excelente');
    PERFORM pg_temp.debe_fallar('segunda reseña de la misma cita',
        format($q$INSERT INTO resena (cita_id, tutor_id, aliado_id, calificacion) VALUES (%L,%L,%L,4)$q$, cita1, u_tutor, a_clinica), '23505');
    PERFORM pg_temp.debe_fallar('calificación fuera de 1..5',
        format($q$UPDATE resena SET calificacion = 7 WHERE cita_id=%L$q$, cita1), '23514');
    PERFORM pg_temp.debe_pasar('promedio del aliado = 5.00', (SELECT promedio FROM v_calificacion_aliado WHERE aliado_id=a_clinica) = 5.00);
    UPDATE resena SET moderacion='OCULTO' WHERE cita_id = cita1;
    PERFORM pg_temp.debe_pasar('reseña oculta no cuenta en la calificación pública', NOT EXISTS (SELECT 1 FROM v_calificacion_aliado WHERE aliado_id=a_clinica));

    -- ---------- Productos y pedidos ----------
    INSERT INTO producto (aliado_id, categoria_id, nombre, precio, stock) VALUES (a_tienda, cat_alim, 'Concentrado 10kg', 100000, 5) RETURNING id INTO prod;
    PERFORM pg_temp.debe_fallar('stock negativo',
        format($q$UPDATE producto SET stock = -1 WHERE id=%L$q$, prod), '23514');
    PERFORM pg_temp.debe_fallar('fórmula médica en un producto que no es medicamento',
        format($q$INSERT INTO producto (aliado_id, categoria_id, nombre, precio, requiere_formula) VALUES (%L,%L,'x',1,true)$q$, a_tienda, cat_alim), '23514');

    INSERT INTO pedido (tutor_id, aliado_id, metodo_entrega, subtotal, impuestos, total, direccion_entrega)
        VALUES (u_tutor, a_tienda, 'DOMICILIO', 200000, 38000, 238000, 'Calle 1 # 2-3') RETURNING id INTO ped;
    INSERT INTO pedido_item (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario, impuesto_pct) VALUES (ped, prod, 'Concentrado 10kg', 2, 100000, 19);
    PERFORM pg_temp.debe_fallar('total del pedido inconsistente',
        format($q$INSERT INTO pedido (tutor_id, aliado_id, metodo_entrega, subtotal, impuestos, total, direccion_entrega) VALUES (%L,%L,'DOMICILIO',100,19,500,'x')$q$, u_tutor, a_tienda), '23514');
    PERFORM pg_temp.debe_fallar('envío a domicilio sin dirección',
        format($q$INSERT INTO pedido (tutor_id, aliado_id, metodo_entrega, subtotal, total) VALUES (%L,%L,'DOMICILIO',100,100)$q$, u_tutor, a_tienda), '23514');
    UPDATE pedido SET estado='PAGADO' WHERE id = ped;
    PERFORM pg_temp.debe_pasar('pagar descuenta stock (5 → 3)', (SELECT stock FROM producto WHERE id=prod) = 3);
    UPDATE pedido SET estado='CANCELADO' WHERE id = ped;
    PERFORM pg_temp.debe_pasar('cancelar antes del despacho devuelve stock (→ 5)', (SELECT stock FROM producto WHERE id=prod) = 5);
    PERFORM pg_temp.debe_fallar('un pedido cancelado no se reactiva',
        format($q$UPDATE pedido SET estado='PAGADO' WHERE id=%L$q$, ped), '23514');

    INSERT INTO pedido (tutor_id, aliado_id, metodo_entrega, subtotal, total) VALUES (u_tutor, a_tienda, 'RECOGER_EN_SEDE', 700000, 700000) RETURNING id INTO ped;
    INSERT INTO pedido_item (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario) VALUES (ped, prod, 'Concentrado 10kg', 7, 100000);
    PERFORM pg_temp.debe_fallar('pagar más unidades que el stock disponible',
        format($q$UPDATE pedido SET estado='PAGADO' WHERE id=%L$q$, ped), '23514');
    DELETE FROM pedido_item WHERE pedido_id = ped;
    INSERT INTO pedido_item (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario) VALUES (ped, prod, 'Concentrado 10kg', 1, 100000);
    UPDATE pedido SET estado='PAGADO' WHERE id = ped;
    UPDATE pedido SET estado='DESPACHADO' WHERE id = ped;
    PERFORM pg_temp.debe_fallar('no se cancela un pedido ya despachado',
        format($q$UPDATE pedido SET estado='CANCELADO' WHERE id=%L$q$, ped), '23514');

    -- ---------- Pagos, comisión, suscripciones ----------
    INSERT INTO pago (pagador_id, pedido_id, monto, pasarela, referencia_pasarela, estado) VALUES (u_tutor, ped, 100000, 'WOMPI', 'ref-1', 'APROBADO') RETURNING id INTO pg1;
    PERFORM pg_temp.debe_fallar('pago apuntando a cita y pedido a la vez',
        format($q$INSERT INTO pago (pagador_id, cita_id, pedido_id, monto, pasarela) VALUES (%L,%L,%L,1000,'WOMPI')$q$, u_tutor, cita1, ped), '23514');
    PERFORM pg_temp.debe_fallar('pago sin destino',
        format($q$INSERT INTO pago (pagador_id, monto, pasarela) VALUES (%L,1000,'WOMPI')$q$, u_tutor), '23514');
    PERFORM pg_temp.debe_fallar('referencia de pasarela repetida',
        format($q$INSERT INTO pago (pagador_id, pedido_id, monto, pasarela, referencia_pasarela) VALUES (%L,%L,1000,'WOMPI','ref-1')$q$, u_tutor, ped), '23505');
    INSERT INTO comision (pago_id, aliado_id, base, porcentaje, monto) VALUES (pg1, a_tienda, 100000, 3.5, 3500.00);
    PERFORM pg_temp.debe_fallar('comisión mal calculada',
        format($q$INSERT INTO comision (pago_id, aliado_id, base, porcentaje, monto) VALUES (%L,%L,100,3,9)$q$, pg1, a_tienda), '23514');
    PERFORM pg_temp.debe_fallar('porcentaje de comisión fuera de 2–5 %',
        $q$INSERT INTO comision_config (aplica_a, porcentaje, vigente_desde) VALUES ('VENTA', 8, current_date)$q$, '23514');
    INSERT INTO comision_config (aplica_a, porcentaje, vigente_desde, vigente_hasta) VALUES ('VENTA', 3, '2026-11-01', '2026-12-31');
    PERFORM pg_temp.debe_fallar('vigencias de comisión solapadas',
        $q$INSERT INTO comision_config (aplica_a, porcentaje, vigente_desde) VALUES ('VENTA', 4, '2026-12-01')$q$, '23P01');

    INSERT INTO plan (codigo, nombre, destinatario, precio_mensual) VALUES ('ALIADO_MENSUAL','Suscripción aliado','ALIADO',99000) RETURNING id INTO plan_p;
    INSERT INTO suscripcion (plan_id, aliado_id, estado) VALUES (plan_p, a_clinica, 'ACTIVA');
    PERFORM pg_temp.debe_fallar('segunda suscripción activa del mismo aliado',
        format($q$INSERT INTO suscripcion (plan_id, aliado_id, estado) VALUES (%L,%L,'PENDIENTE_PAGO')$q$, plan_p, a_clinica), '23505');
    PERFORM pg_temp.debe_fallar('suscripción de aliado y tutor a la vez',
        format($q$INSERT INTO suscripcion (plan_id, aliado_id, usuario_id) VALUES (%L,%L,%L)$q$, plan_p, a_clinica, u_tutor), '23514');

    -- ---------- Adopción ----------
    INSERT INTO fundacion_perfil (aliado_id, ciudad, ubicacion, contacto_nombre, contacto_correo, anio_fundacion)
        VALUES (a_fund, 'Bogotá', 'Calle 100 # 10-10 (privada)', 'María', 'contacto@huellas.org', 2015);
    PERFORM pg_temp.debe_fallar('una clínica no puede tener perfil de fundación',
        format($q$INSERT INTO fundacion_perfil (aliado_id, ciudad, ubicacion, contacto_nombre, contacto_correo, anio_fundacion) VALUES (%L,'Bogotá','x','y','a@b.co',2000)$q$, a_clinica), '23514');
    PERFORM pg_temp.debe_fallar('fundación sin aprobar no puede publicar mascotas',
        format($q$INSERT INTO mascota_adopcion (fundacion_id, nombre, especie_id, edad_meses, sexo, tamano, ciudad) VALUES (%L,'Rocky',%L,12,'MACHO','MEDIANO','Bogotá')$q$, a_fund_pend, perro), '23514');
    INSERT INTO mascota_adopcion (fundacion_id, nombre, especie_id, edad_meses, sexo, tamano, ciudad, zona)
        VALUES (a_fund, 'Rocky', perro, 12, 'MACHO', 'MEDIANO', 'Bogotá', 'Suba') RETURNING id INTO mad;
    INSERT INTO adopcion_media (mascota_adopcion_id, url) VALUES (mad, 'https://cdn.veto.co/rocky1.jpg');
    PERFORM pg_temp.debe_pasar('el catálogo público muestra la mascota disponible',
        (SELECT count(*) FROM v_catalogo_adopcion WHERE id = mad AND foto_principal IS NOT NULL) = 1);
    PERFORM pg_temp.debe_pasar('el catálogo público NO expone la fundación ni su ubicación',
        NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='veto' AND table_name='v_catalogo_adopcion'
                      AND column_name IN ('fundacion_id','ubicacion','nombre_comercial','aliado_id')));
    UPDATE mascota_adopcion SET pausada = true WHERE id = mad;
    PERFORM pg_temp.debe_pasar('una publicación pausada sale del catálogo', NOT EXISTS (SELECT 1 FROM v_catalogo_adopcion WHERE id = mad));
    UPDATE mascota_adopcion SET pausada = false WHERE id = mad;

    INSERT INTO solicitud_adopcion (mascota_adopcion_id, tutor_id, datos_personales, hogar_experiencia, motivacion)
        VALUES (mad, u_tutor, '{"nombre":"Tutor Uno"}', '{"vivienda":"apartamento","experiencia":true}', 'Quiero un compañero');
    PERFORM pg_temp.debe_fallar('solicitud activa duplicada para la misma mascota',
        format($q$INSERT INTO solicitud_adopcion (mascota_adopcion_id, tutor_id, datos_personales, hogar_experiencia, motivacion) VALUES (%L,%L,'{}','{}','otra vez')$q$, mad, u_tutor), '23505');
    PERFORM pg_temp.debe_fallar('rechazar solicitud sin motivo',
        format($q$UPDATE solicitud_adopcion SET estado='RECHAZADA' WHERE mascota_adopcion_id=%L$q$, mad), '23514');
    UPDATE solicitud_adopcion SET estado='CANCELADA' WHERE mascota_adopcion_id = mad;
    INSERT INTO solicitud_adopcion (mascota_adopcion_id, tutor_id, datos_personales, hogar_experiencia, motivacion)
        VALUES (mad, u_tutor, '{}', '{}', 'ahora sí');
    PERFORM pg_temp.debe_pasar('tras cancelar se permite una nueva solicitud', true);

    -- ---------- Trazabilidad y privacidad ----------
    PERFORM pg_temp.debe_pasar('auditoría registró cambios de la cita',
        (SELECT count(*) FROM auditoria WHERE tabla = 'cita' AND registro_id = cita1::text) >= 2);
    PERFORM pg_temp.debe_pasar('auditoría de usuario NO contiene datos personales',
        NOT EXISTS (SELECT 1 FROM auditoria WHERE tabla='usuario' AND (datos_despues ?| ARRAY['correo','celular','cedula','nombre_completo','password_hash'])));
    PERFORM pg_temp.debe_fallar('la auditoría no se puede alterar',
        $q$DELETE FROM auditoria$q$, '55000');
    PERFORM pg_temp.debe_fallar('el historial de estados no se puede alterar',
        $q$UPDATE historial_estado SET estado_nuevo = 'X'$q$, '55000');

    PERFORM fn_anonimizar_usuario(u_tutor);
    PERFORM pg_temp.debe_pasar('anonimizar borra datos personales del tutor',
        (SELECT correo::text LIKE 'eliminado-%@veto.invalid' AND celular IS NULL AND cedula IS NULL AND estado='ELIMINADA' FROM usuario WHERE id=u_tutor));
    PERFORM pg_temp.debe_pasar('la cita finalizada y la consulta se conservan tras anonimizar',
        (SELECT count(*) FROM consulta WHERE id = cons) = 1 AND (SELECT estado FROM cita WHERE id = cita1) = 'FINALIZADA');

    SELECT count(*) INTO n FROM v_kpi_piloto;  PERFORM pg_temp.debe_pasar('v_kpi_piloto responde', n = 1);
    SELECT count(*) INTO n FROM v_oferta_servicios; PERFORM pg_temp.debe_pasar('v_oferta_servicios responde', n = 2);
    PERFORM count(*) FROM v_servicios_mas_solicitados; PERFORM count(*) FROM v_ocupacion_citas;

    RAISE NOTICE '=== TODAS LAS PRUEBAS PASARON ===';
END $$;

ROLLBACK;
