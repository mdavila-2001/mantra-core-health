import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { ChartNotesClient } from './chart-notes.client';

const originalMockBackend = environment.mockBackend;

describe('ChartNotesClient payload compatibility', () => {
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

  for (const operation of ['create', 'append'] as const) {
    it(`${operation}: real API preserves text and serializes rows without entries`, () => {
      const input = {
        ...(operation === 'create' ? { patientProfileId: 'synthetic-patient' } : {}),
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
        authorProfileId: 'synthetic-author',
        subjectiveText: 'Synthetic text', objectiveText: 'Existing observation\nSynthetic field: Synthetic value',
      });
      expect(input.entries).toHaveLength(1);
      request.flush({});
    });
  }

  it('omits empty entries without erasing existing objective text', () => {
    client.createNote({ patientProfileId: 'p', authorProfileId: 'a', entries: [], objectiveText: 'Synthetic' }).subscribe();
    const request = http.expectOne('/charts/notes');
    expect(request.request.body).toEqual({ patientProfileId: 'p', authorProfileId: 'a', objectiveText: 'Synthetic' });
    request.flush({});
  });

  it('serializes rows when there is no prior objective text', () => {
    client.createNote({ patientProfileId: 'p', authorProfileId: 'a', entries: [{ label: 'Field', value: 'Value' }] }).subscribe();
    const request = http.expectOne('/charts/notes');
    expect(request.request.body.objectiveText).toBe('Field: Value');
    expect(request.request.body).not.toHaveProperty('entries');
    request.flush({});
  });

  it('preserves the original structured demo payload', () => {
    Object.assign(environment, { mockBackend: true });
    const input = { patientProfileId: 'p', authorProfileId: 'a', entries: [{ label: 'Field', value: 'Value' }] };
    client.createNote(input).subscribe();
    const request = http.expectOne('/charts/notes');
    expect(request.request.body).toBe(input);
    request.flush({});
  });

  it('signVersion manda el perfil de quien firma: SignVersionDto lo exige (informe B, C5)', () => {
    client.signVersion('note-1', 'version-1', 'profile-1').subscribe({ error: () => undefined });
    const request = http.expectOne('/charts/notes/note-1/versions/version-1/sign');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ signerProfileId: 'profile-1' });
    request.flush({});
  });
});
