import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { ChartNotesClient } from './chart-notes.client';

const originalMockBackend = environment.mockBackend;

describe('ChartNotesClient payload (P39)', () => {
  let client: ChartNotesClient;
  let http: HttpTestingController;

  beforeEach(() => {
    Object.assign(environment, { mockBackend: false });
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(ChartNotesClient);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    Object.assign(environment, { mockBackend: originalMockBackend });
  });

  // P39: la API declara `entries` en `CreateNoteDto` y `AddVersionDto`, así
  // que las filas viajan estructuradas y el texto libre no se toca.
  for (const operation of ['create', 'append'] as const) {
    it(`${operation}: real API receives the structured rows untouched`, () => {
      const input = {
        authorProfileId: 'synthetic-author',
        subjectiveText: 'Synthetic text', objectiveText: 'Existing observation',
        entries: [{ label: 'Synthetic field', value: 'Synthetic value' }],
      };
      const call = operation === 'create' ? client.createNote({ ...input, patientProfileId: 'synthetic-patient' }) : client.appendVersion('synthetic-note', input);
      call.subscribe();
      const request = http.expectOne(operation === 'create' ? '/charts/notes' : '/charts/notes/synthetic-note/versions');
      expect(request.request.method).toBe(operation === 'create' ? 'POST' : 'PUT');
      expect(request.request.body).toEqual({
        ...(operation === 'create' ? { patientProfileId: 'synthetic-patient' } : {}),
        ...input,
      });
      request.flush({});
    });
  }

  it('does not fold the rows into objectiveText anymore', () => {
    client.createNote({ patientProfileId: 'p', authorProfileId: 'a', entries: [{ label: 'Field', value: 'Value' }] }).subscribe();
    const request = http.expectOne('/charts/notes');
    expect(request.request.body).not.toHaveProperty('objectiveText');
    expect(request.request.body.entries).toEqual([{ label: 'Field', value: 'Value' }]);
    request.flush({});
  });

  it('sends the same body to the simulator and to the real API', () => {
    const input = { patientProfileId: 'p', authorProfileId: 'a', entries: [{ label: 'Field', value: 'Value' }] };
    client.createNote(input).subscribe();
    const real = http.expectOne('/charts/notes');
    Object.assign(environment, { mockBackend: true });
    client.createNote(input).subscribe();
    const simulated = http.expectOne('/charts/notes');
    expect(simulated.request.body).toEqual(real.request.body);
    real.flush({});
    simulated.flush({});
  });

  it('listNotes keeps the rows of each note as served', () => {
    let rows: unknown;
    client.listNotes({ patientProfileId: 'p' }).subscribe((page) => (rows = page.items[0]?.entries));
    http
      .expectOne((r) => r.url === '/charts/notes' && r.params.get('patientProfileId') === 'p')
      .flush({
        items: [{ noteId: 'n', lifecycleStatusConceptId: 'c', releasedToPatient: false, createdAt: '2026-10-26T00:00:00.000Z', entries: [{ label: 'Field', value: 'Value' }] }],
        count: 1, limit: 50, nextCursor: null,
      });
    expect(rows).toEqual([{ label: 'Field', value: 'Value' }]);
  });

  it('listNotes no manda encounterId (la API lo rechaza con 400) y acota por consulta acá (A3)', () => {
    let ids: readonly string[] = [];
    client
      .listNotes({ patientProfileId: 'p', encounterId: 'enc-1', limit: 50 })
      .subscribe((page) => (ids = page.items.map((nota) => nota.noteId)));
    const pedido = http.expectOne((r) => r.url === '/charts/notes');
    expect(pedido.request.params.has('encounterId')).toBe(false);
    expect(pedido.request.params.get('limit')).toBe('50');
    pedido.flush({
      items: [
        { noteId: 'de-esta', encounterId: 'enc-1', lifecycleStatusConceptId: 'c', releasedToPatient: false, createdAt: '2026-10-26T00:00:00.000Z' },
        { noteId: 'de-otra', encounterId: 'enc-2', lifecycleStatusConceptId: 'c', releasedToPatient: false, createdAt: '2026-10-25T00:00:00.000Z' },
      ],
      count: 2, limit: 50, nextCursor: null,
    });
    expect(ids).toEqual(['de-esta']);
  });

  it('signVersion manda el perfil de quien firma: SignVersionDto lo exige (informe B, C5)', () => {
    client.signVersion('note-1', 'version-1', 'profile-1').subscribe({ error: () => undefined });
    const request = http.expectOne('/charts/notes/note-1/versions/version-1/sign');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ signerProfileId: 'profile-1' });
    request.flush({});
  });
});
