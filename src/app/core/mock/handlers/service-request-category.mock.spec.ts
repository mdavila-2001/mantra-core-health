import { HttpHeaders } from '@angular/common/http';

import { noteList } from '../fixtures/clinic';
import { ORDER_CATEGORY, STATUS } from '../fixtures/concepts';
import { PATIENTS } from '../fixtures/people';
import { MockRouter, type MockMethod } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { uuid } from '../mock-store';
import { registrarDiagnostico } from './diagnostics.handlers';
import { categoriaDeLaOrden } from './service-request-category.mock';

/**
 * P40 (carril C2) en el doble: `POST /clinical/service-requests` con
 * `category` y `basedOnNoteIds`, y su lectura en
 * `GET /diagnostics/patients/:id/orders`. Las reglas son las de la API
 * (`ServiceRequestNotesService`, `service-request-category.ts`), así que el
 * simulador sirve el mismo contrato que el servidor real.
 *
 * Usa las notas sembradas: `note-<paciente>-0` es de `encounter-<paciente>-0`
 * y `note-<paciente>-1` de `encounter-<paciente>-1`.
 */
describe('P40 · orden de análisis basada en notas (simulador)', () => {
  const router = new MockRouter();
  const medica = buscarUsuario('medica')!;
  registrarDiagnostico(router);

  const ana = PATIENTS[0]!;
  const bruno = PATIENTS[1]!;
  const notaDeAna = uuid(`note-${ana.id}-0`);
  const encuentroDeAna = uuid(`encounter-${ana.id}-0`);
  /** La sembrada `note-<paciente>-1` es un borrador: no motiva órdenes. */
  const notaEnBorrador = uuid(`note-${ana.id}-1`);
  /** Una nota firmada de otra consulta de Ana, sembrada por la prueba. */
  const notaDeAnaOtraConsulta = uuid('p40-nota-otra-consulta');
  const firmada = noteList.filtrar((n) => n.noteId === uuid(`note-${ana.id}-0`))[0]!;
  if (noteList.filtrar((n) => n.noteId === notaDeAnaOtraConsulta).length === 0) {
    noteList.agregar({
      ...firmada,
      id: notaDeAnaOtraConsulta,
      noteId: notaDeAnaOtraConsulta,
      encounterId: uuid(`encounter-${ana.id}-1`),
    });
  }
  const notaDeBruno = uuid(`note-${bruno.id}-0`);

  interface Respuesta {
    readonly status: number;
    readonly body: Record<string, unknown>;
  }

  function call<T>(
    method: MockMethod,
    path: string,
    body: unknown,
    user: MockUser | null = medica,
  ): T {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user,
    }) as T;
  }

  /** Un estudio por alta: el detector de duplicados no se cruza entre pruebas. */
  let n = 0;
  function pedir(extra: Record<string, unknown>): Respuesta {
    n += 1;
    return call<Respuesta>('POST', '/clinical/service-requests', {
      patientProfileId: ana.id,
      codeConceptId: uuid(`p40-estudio-${n}`),
      encounterId: encuentroDeAna,
      ...extra,
    });
  }

  function fichaDeAna(): readonly Record<string, unknown>[] {
    const res = call<{ orders: readonly Record<string, unknown>[] }>(
      'GET',
      `/diagnostics/patients/${ana.id}/orders`,
      undefined,
    );
    return res.orders;
  }

  it('guarda category y notas, y las devuelve en el alta y en la ficha', () => {
    const alta = pedir({ category: 'LAB', basedOnNoteIds: [notaDeAna] });

    expect(alta.status).toBe(201);
    expect(alta.body['category']).toBe('LAB');
    expect(alta.body['basedOnNoteIds']).toEqual([notaDeAna]);
    const leida = fichaDeAna().find((o) => o['id'] === alta.body['id']);
    expect(leida).toMatchObject({
      categoryConceptId: ORDER_CATEGORY['SRQ-LAB'],
      category: 'LAB',
      basedOnNoteIds: [notaDeAna],
    });
  });

  it('category OTHER se guarda con el concepto SRQ-OTHER', () => {
    const alta = pedir({ category: 'OTHER' });
    const leida = fichaDeAna().find((o) => o['id'] === alta.body['id']);
    expect(leida?.['categoryConceptId']).toBe(ORDER_CATEGORY['SRQ-OTHER']);
    expect(leida?.['basedOnNoteIds']).toEqual([]);
  });

  it('NEGATIVO · una nota de otro paciente da 422 BASED_ON_NOTE_NOT_FOUND y no crea la orden', () => {
    const antes = fichaDeAna().length;
    const res = pedir({ basedOnNoteIds: [notaDeBruno] });
    expect(res.status).toBe(422);
    expect(res.body['reason']).toBe('BASED_ON_NOTE_NOT_FOUND');
    expect(fichaDeAna()).toHaveLength(antes);
  });

  it('NEGATIVO · una nota inexistente responde igual que una ajena', () => {
    const res = pedir({ basedOnNoteIds: [uuid('nota-que-no-existe')] });
    expect(res.status).toBe(422);
    expect(res.body['reason']).toBe('BASED_ON_NOTE_NOT_FOUND');
  });

  it('NEGATIVO · una nota en borrador da 422 BASED_ON_NOTE_NOT_FOUND', () => {
    expect(firmada.lifecycleStatusConceptId).not.toBe(STATUS['ST-DRAFT']);
    const res = pedir({ basedOnNoteIds: [notaEnBorrador] });
    expect(res.status).toBe(422);
    expect(res.body['reason']).toBe('BASED_ON_NOTE_NOT_FOUND');
  });

  it('NEGATIVO · una nota de otra consulta del paciente da ENCOUNTER_MISMATCH', () => {
    const res = pedir({ basedOnNoteIds: [notaDeAnaOtraConsulta] });
    expect(res.status).toBe(422);
    expect(res.body['reason']).toBe('BASED_ON_NOTE_ENCOUNTER_MISMATCH');
  });

  it('NEGATIVO · category que contradice el concepto da 422; fuera de las tres, 400', () => {
    const contradice = pedir({ category: 'IMAGING', categoryConceptId: ORDER_CATEGORY['SRQ-LAB'] });
    expect(contradice.status).toBe(422);
    expect(contradice.body['reason']).toBe('SERVICE_REQUEST_CATEGORY_MISMATCH');
    expect(pedir({ category: 'CARDIO' }).status).toBe(400);
    expect(pedir({ basedOnNoteIds: [notaDeAna, notaDeAna] }).status).toBe(400);
  });

  it('el portal del paciente recibe la category pero no las notas', () => {
    const alta = pedir({ category: 'IMAGING', basedOnNoteIds: [notaDeAna] });
    const paciente = buscarUsuario('paciente');
    expect(paciente).toBeDefined();
    const res = call<{ items: readonly Record<string, unknown>[] }>(
      'GET',
      '/diagnostic-results/me/orders',
      undefined,
      { ...paciente!, patientProfileId: ana.id },
    );
    const propia = res.items.find((o) => o['id'] === alta.body['id']);
    expect(propia?.['category']).toBe('IMAGING');
    expect(propia).not.toHaveProperty('basedOnNoteIds');
  });

  it('categoriaDeLaOrden: laboratorio e imagen se nombran, el resto es OTHER, sin concepto nada', () => {
    expect(categoriaDeLaOrden(ORDER_CATEGORY['SRQ-LAB'])).toBe('LAB');
    expect(categoriaDeLaOrden(ORDER_CATEGORY['SRQ-IMAGING'])).toBe('IMAGING');
    expect(categoriaDeLaOrden(ORDER_CATEGORY['SRQ-PROCEDURE'])).toBe('OTHER');
    expect(categoriaDeLaOrden('')).toBeUndefined();
  });
});
