import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';

import type { PatientDiagnostics } from '../../../../../core/data-access/diagnostics/diagnostics.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { ready } from '../../../../../core/view-state/view-state';
import {
  faltasDeLasLecturas,
  lecturasCargando,
  lecturasComprobadas,
  leerLasLecturas,
  type LecturasDeLaRed,
} from './red-clinica-lecturas';

const estudios = (truncated: string[] = []): PatientDiagnostics => ({
  patientProfileId: 'p',
  orders: [],
  reports: [],
  limit: 50,
  truncated,
});
const todas = (extra: Partial<LecturasDeLaRed> = {}): LecturasDeLaRed => ({
  citas: ready([]),
  derivaciones: ready([]),
  estudios: ready(estudios()),
  procedimientos: ready([]),
  recortadas: [],
  ...extra,
});
const http = (status: number, body: object = { code: 'X' }) =>
  errorToViewState<never>(new HttpErrorResponse({ status, error: body, headers: undefined }));

describe('leerLasLecturas', () => {
  it('conserva qué lecturas llegaron recortadas por el tope', async () => {
    const leidas = await firstValueFrom(
      leerLasLecturas({
        citas: of({ items: [], count: 60, limit: 50, truncated: true }),
        derivaciones: of([]),
        estudios: of(estudios(['reports'])),
        procedimientos: of({ items: [], total: 70 }),
      }),
    );
    expect(leidas.recortadas).toEqual(['citas', 'estudios', 'procedimientos']);
    expect(leidas.citas).toEqual(ready([]));
  });

  it('cada lectura falla por su cuenta', async () => {
    const leidas = await firstValueFrom(
      leerLasLecturas({
        citas: throwError(() => new HttpErrorResponse({ status: 403, error: { code: 'FORBIDDEN' } })),
        derivaciones: of([]),
        estudios: of(estudios()),
        procedimientos: of({ items: [], total: 0 }),
      }),
    );
    expect(leidas.citas.status).toBe('forbidden');
    expect(leidas.recortadas).toEqual([]);
  });
});

describe('faltasDeLasLecturas', () => {
  it('distingue fuera de su acceso (S5), no disponible (S6) y fallo con reintento (S9)', () => {
    const f = faltasDeLasLecturas(
      todas({ citas: http(403, { code: 'FORBIDDEN' }), derivaciones: http(404, { code: 'NOT_FOUND' }), procedimientos: http(500) }),
      50,
    );
    expect(f.sinAcceso).toBe('las citas');
    expect(f.noDisponibles).toBe('las derivaciones');
    expect(f.faltan).toBe('los procedimientos');
    expect(f.listas).toBe(true);
  });

  it('dice lo recortado con el tope, y sin leer nada no están listas', () => {
    expect(faltasDeLasLecturas(todas({ recortadas: ['citas', 'estudios'] }), 50)).toMatchObject({
      recortadas: 'las citas, los estudios',
      tope: 50,
    });
    expect(faltasDeLasLecturas(null, 50).listas).toBe(false);
    expect(faltasDeLasLecturas(lecturasCargando(), 50)).toMatchObject({ cargando: true, listas: false });
  });
});

describe('lecturasComprobadas', () => {
  it('sólo lo leído completo sostiene una ausencia', () => {
    expect(lecturasComprobadas(todas())).toEqual({ ordenes: true, informes: true, derivaciones: true });
    expect(lecturasComprobadas(todas({ estudios: ready(estudios(['reports'])) }))).toEqual({
      ordenes: true,
      informes: false,
      derivaciones: true,
    });
    expect(lecturasComprobadas(todas({ estudios: http(500), derivaciones: http(403) }))).toEqual({
      ordenes: false,
      informes: false,
      derivaciones: false,
    });
    expect(lecturasComprobadas(null)).toEqual({ ordenes: false, informes: false, derivaciones: false });
  });
});
