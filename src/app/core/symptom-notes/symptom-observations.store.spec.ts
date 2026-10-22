import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../auth/auth.service';
import {
  MAX_OBSERVACIONES,
  SYMPTOM_OBSERVATIONS_STORAGE,
  SymptomObservationsStore,
  comoMotivoDeConsulta,
  type ObservacionDeSintomas,
  type SymptomObservationsStorageAdapter,
} from './symptom-observations.store';

class MemoryStorage implements SymptomObservationsStorageAdapter {
  readonly datos = new Map<string, readonly ObservacionDeSintomas[]>();
  read(clave: string): readonly ObservacionDeSintomas[] {
    return this.datos.get(clave) ?? [];
  }
  write(clave: string, observaciones: readonly ObservacionDeSintomas[]): void {
    this.datos.set(clave, observaciones);
  }
}

describe('SymptomObservationsStore', () => {
  const userId = signal<string | null>('user-1');
  let storage: MemoryStorage;
  let store: SymptomObservationsStore;

  const CEFALEA = { id: 'dolor-de-cabeza', nombre: 'Cefalea (dolor de cabeza)', codigo: 'CIE-10 R51' };

  beforeEach(() => {
    userId.set('user-1');
    storage = new MemoryStorage();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { userId } },
        { provide: SYMPTOM_OBSERVATIONS_STORAGE, useValue: storage },
      ],
    });
    store = TestBed.inject(SymptomObservationsStore);
    TestBed.tick();
  });

  it('guarda la observación por cuenta, la más nueva primero', () => {
    store.guardar('me duele la cabeza hace tres dias', [CEFALEA], new Date('2026-10-08T10:00:00Z'));
    store.guardar('ahora tengo fiebre', [], new Date('2026-10-08T12:00:00Z'));

    expect(store.lista().map((o) => o.texto)).toEqual(['ahora tengo fiebre', 'me duele la cabeza hace tres dias']);
    expect(storage.read('alovida.observaciones-de-sintomas.user-1')).toHaveLength(2);
  });

  it('otra cuenta en el mismo navegador no ve las observaciones de la anterior', () => {
    store.guardar('me duele la cabeza', [CEFALEA]);
    userId.set('user-2');
    TestBed.tick();
    expect(store.lista()).toEqual([]);
  });

  it('borra una observación', () => {
    const una = store.guardar('uno', []);
    store.guardar('dos', []);
    store.borrar(una.id);
    expect(store.lista().map((o) => o.texto)).toEqual(['dos']);
  });

  it(`conserva como máximo ${MAX_OBSERVACIONES}`, () => {
    for (let i = 0; i < MAX_OBSERVACIONES + 5; i += 1) store.guardar(`obs ${i}`, []);
    expect(store.lista()).toHaveLength(MAX_OBSERVACIONES);
    expect(store.lista()[0].texto).toBe(`obs ${MAX_OBSERVACIONES + 4}`);
  });

  it('la pendiente es la más reciente sin usar y vigente; usada deja de serlo', () => {
    const vieja = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    store.guardar('hace veinte días', [], vieja);
    expect(store.pendiente()).toBeNull();

    const hoy = store.guardar('hoy', [CEFALEA]);
    expect(store.pendiente()?.id).toBe(hoy.id);
    store.marcarUsada(hoy.id);
    expect(store.pendiente()).toBeNull();
  });

  it('como motivo de consulta: síntomas con su código del glosario y lo que contó, en 500 caracteres', () => {
    const obs = store.guardar('me duele la cabeza hace tres dias', [CEFALEA]);
    expect(comoMotivoDeConsulta(obs)).toBe(
      'Síntomas: Cefalea (dolor de cabeza) [CIE-10 R51]. Lo que contó el paciente: «me duele la cabeza hace tres dias»',
    );
    const larga = store.guardar('a'.repeat(800), [CEFALEA]);
    expect(comoMotivoDeConsulta(larga).length).toBe(500);
  });
});
