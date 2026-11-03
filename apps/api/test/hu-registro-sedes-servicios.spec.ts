import {
  registroAliadoSchema,
  registroUsuarioSchema,
  servicioInputSchema,
  sedeInputSchema,
} from '@veto/shared';
import { IdentidadService } from '../src/modules/identidad/identidad.service';
import { AliadosService } from '../src/modules/aliados/aliados.service';
import { ServiciosService } from '../src/modules/servicios/servicios.service';

describe('HU-001, HU-007, HU-015 y HU-019: validación y persistencia', () => {
  it('valida el contrato de registro; el controlador adapta el alias password al campo compartido contrasena', () => {
    const json = {
      nombre: 'Daniel Prueba',
      celular: '3000000000',
      correo: 'Daniel@Example.com',
      password: 'password123',
    };
    const input = registroUsuarioSchema.parse({ ...json, contrasena: json.password });
    expect(input.contrasena).toBe('password123');
    expect(input.correo).toBe('Daniel@Example.com');
    expect(() =>
      registroUsuarioSchema.parse({ nombre: '', celular: '123', correo: 'x', password: 'short' }),
    ).toThrow();
  });

  it('permite solo los tres tipos de aliado de HU-007 y normaliza contraseña', () => {
    const input = registroAliadoSchema.parse({
      nombre: 'Daniel',
      nombreAliado: 'Clínica Daniel',
      celular: '3000000000',
      correo: 'd@example.com',
      password: 'password123',
      tipo: 'CLINICA',
    });
    expect(input.tipo).toBe('CLINICA');
    expect(input.contrasena).toBe('password123');
    expect(() => registroAliadoSchema.parse({ tipo: 'FUNDACION' })).toThrow();
  });

  it('valida campos de sede y servicio, la modalidad en sede y precios no negativos', () => {
    expect(
      sedeInputSchema.parse({ nombre: 'Centro', direccion: 'Calle 1', ciudad: 'Bogotá' }).ciudad,
    ).toBe('Bogotá');
    expect(() => sedeInputSchema.parse({ nombre: 'Centro' })).toThrow();
    expect(
      servicioInputSchema.parse({
        tipoServicioId: 1,
        nombre: 'Consulta',
        modalidad: 'A_DOMICILIO',
        precioBase: 0,
      }).precioBase,
    ).toBe(0);
    expect(() =>
      servicioInputSchema.parse({
        tipoServicioId: 1,
        nombre: 'Consulta',
        modalidad: 'EN_SEDE',
        precioBase: -1,
      }),
    ).toThrow();
    expect(() =>
      servicioInputSchema.parse({
        tipoServicioId: 1,
        nombre: 'Consulta',
        modalidad: 'EN_SEDE',
        precioBase: 1,
      }),
    ).toThrow(/sede/);
  });

  it('persiste tutor con contraseña hasheada y nunca la incluye en la respuesta', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValue({ rows: [{ id: 'u1', correo: 'd@example.com', rol: 'TUTOR' }] }),
    };
    const database = { withUser: jest.fn((_id, fn) => fn(client)) };
    const service = new IdentidadService(database as never);
    const result = await service.createTutor(
      registroUsuarioSchema.parse({
        nombre: 'Daniel',
        celular: '3000000000',
        correo: 'd@example.com',
        contrasena: 'password123',
      }),
    );
    expect(client.query.mock.calls[0][0]).toContain('INSERT INTO usuario');
    expect(client.query.mock.calls[0][1][3]).toMatch(/^scrypt\$/);
    expect(result).not.toHaveProperty('password_hash');
  });

  it('crea aliado veterinario independiente y su perfil en la misma transacción', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: 'a1', tipo: 'VET_INDEPENDIENTE' }] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const database = { withUser: jest.fn((_id, fn) => fn(client)) };
    const identidad = {
      hashPassword: jest.fn().mockResolvedValue('scrypt$hash'),
      insertUser: jest.fn().mockResolvedValue({ id: 'u1', rol: 'ALIADO' }),
    };
    const service = new AliadosService(database as never, identidad as never);
    const input = registroAliadoSchema.parse({
      nombre: 'Daniel',
      celular: '3000000000',
      correo: 'd@example.com',
      password: 'password123',
      tipo: 'VET_INDEPENDIENTE',
    });
    const result = await service.register(input);
    expect(result.aliado.id).toBe('a1');
    expect(client.query.mock.calls[0][0]).toContain('INSERT INTO aliado');
    expect(client.query.mock.calls[1][0]).toContain('INSERT INTO veterinario');
  });

  it('HU-015 crea, consulta, edita y desactiva sedes; mantiene desactivadas fuera del listado normal', async () => {
    const branch = {
      id: 's1',
      aliado_id: 'a1',
      nombre: 'Centro',
      direccion: 'Calle 1',
      ciudad: 'Bogotá',
      activa: true,
    };
    const client = { query: jest.fn().mockResolvedValue({ rows: [branch], rowCount: 1 }) };
    const database = {
      withUser: jest.fn((_id, fn) => fn(client)),
      query: jest.fn((sql: string) =>
        Promise.resolve(
          sql.includes('SELECT tipo')
            ? { rowCount: 1, rows: [{ tipo: 'CLINICA' }] }
            : { rowCount: 1, rows: [branch] },
        ),
      ),
    };
    const service = new AliadosService(database as never, {} as never);
    expect(
      (
        await service.createBranch('a1', {
          nombre: 'Centro',
          direccion: 'Calle 1',
          ciudad: 'Bogotá',
        })
      ).id,
    ).toBe('s1');
    expect(await service.listBranches('a1')).toEqual([branch]);
    await service.updateBranch('a1', 's1', {
      nombre: 'Centro',
      direccion: 'Calle 1',
      ciudad: 'Bogotá',
    });
    await service.deactivateBranch('a1', 's1');
    expect(client.query.mock.calls[0][0]).toContain('INSERT INTO sede');
    expect(client.query.mock.calls[1][0]).toContain('UPDATE sede SET nombre');
    expect(client.query.mock.calls[2][0]).toContain('activa=false');
    expect(database.query.mock.calls[2][0]).toContain('($2::boolean OR activa)');
  });

  it('rechaza sedes para aliados que no sean clínicas y servicios para tiendas', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [{ tipo: 'TIENDA' }] }),
    };
    const service = new AliadosService(database as never, {} as never);
    await expect(
      service.createBranch('a1', { nombre: 'x', direccion: 'y', ciudad: 'z' }),
    ).rejects.toThrow('Solo una clínica');
    await expect(service.assertCanOfferServices('a1')).rejects.toThrow(
      'Solo una clínica o veterinario',
    );
  });

  it('crea servicio con los valores que se devuelven al tutor', async () => {
    const row = {
      id: 'sv1',
      nombre: 'Consulta',
      modalidad: 'EN_SEDE',
      sede_id: '00000000-0000-4000-8000-000000000001',
      precio_base: '45000.00',
      descripcion: 'Consulta general',
    };
    const client = { query: jest.fn().mockResolvedValue({ rows: [row] }) };
    const database = { withUser: jest.fn((_id, fn) => fn(client)) };
    const allies = { assertCanOfferServices: jest.fn(), assertActiveBranch: jest.fn() };
    const service = new ServiciosService(database as never, allies as never);
    const input = servicioInputSchema.parse({
      tipoServicioId: 1,
      nombre: 'Consulta',
      descripcion: 'Consulta general',
      modalidad: 'EN_SEDE',
      sedeId: row.sede_id,
      precioBase: 45000,
    });
    expect(await service.create('a1', input)).toEqual(row);
    expect(client.query.mock.calls[0][1]).toEqual([
      'a1',
      1,
      'Consulta',
      'Consulta general',
      'EN_SEDE',
      row.sede_id,
      30,
      45000,
    ]);
  });
});
