import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { CaseDetail } from './case-detail';

const CASO = '23232323-2323-2323-2323-232323232323';

function evidencia(n: number) {
  return {
    id: `ev-${n}`,
    evidenceTypeConceptId: `tipo-${n}`,
    evidenceFileId: `file-${n}`,
    createdAt: '2026-10-13T10:00:00.000Z',
    sequence: n,
  };
}

describe('CaseDetail', () => {
  let http: HttpTestingController;

  function montar() {
    TestBed.configureTestingModule({
      imports: [CaseDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['caseId', CASO]]) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CaseDetail);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('pide el expediente por id y rotula las cinco evidencias en orden', async () => {
    const fixture = montar();
    http.expectOne(`/identity/verification-cases/${CASO}`).flush({
      id: CASO,
      status: 'PENDING',
      subjectTypeConceptId: 't',
      subjectEntityId: 's',
      identityVerificationPolicyId: 'p',
      openedAt: '2026-10-13T09:00:00.000Z',
      evidence: [1, 2, 3, 4, 5].map(evidencia),
    });
    // Los bytes se piden aparte, por Common Files (que audita), no por la cola.
    for (let n = 1; n <= 5; n++) {
      http
        .expectOne((r) => r.url.includes(`file-${n}`))
        .flush(new Blob(['x'], { type: 'image/jpeg' }));
    }
    // La lectura del Blob a data URL es asíncrona (FileReader).
    await new Promise((resolve) => setTimeout(resolve, 100));
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Frente del documento');
    expect(texto).toContain('Reverso del documento');
    expect(texto).toContain('giro a la derecha');
  });

  it('un caso sin archivos lo dice en vez de quedar en blanco', () => {
    const fixture = montar();
    http.expectOne(`/identity/verification-cases/${CASO}`).flush({
      id: CASO,
      status: 'PENDING',
      subjectTypeConceptId: 't',
      subjectEntityId: 's',
      identityVerificationPolicyId: 'p',
      evidence: [],
    });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'no tiene archivos asociados',
    );
  });
});
