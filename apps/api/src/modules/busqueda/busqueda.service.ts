import { Injectable } from '@nestjs/common';
import type { RespuestaBusquedaGeneral } from '@veto/shared';
import { BusquedaRepository } from './busqueda.repository';

@Injectable()
export class BusquedaService {
  constructor(private readonly repository: BusquedaRepository) {}

  buscar(nombre: string): Promise<RespuestaBusquedaGeneral> {
    return this.repository.buscarPorNombre(nombre);
  }
}
