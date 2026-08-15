import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SessionStore } from '../../../core/auth/session.store';
import { MedicalRecord } from './medical-record';

/**
 * El archivo clínico del paciente (carril 09) — el cierre del P0.
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **Se pide la historia propia y ninguna otra.** El aislamiento lo hace el
 *    servidor, pero esta pantalla no puede ni intentar pedir otra.
 * 2. **Sin perfil de paciente no se pide nada.** Una cuenta de personal de
 *    salud tiene sesión válida y esta pantalla no le corresponde.
 * 3. **Ningún uuid llega a la pantalla**: todo `*ConceptId` se traduce.
 * 4. **Lo que el catálogo no resuelva se muestra como ausencia**, no como
 *    identificador.
 */

/** base64url **sobre UTF-8**, como el token real. */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

const RESUMEN = {
  patientProfileId: 'pp-1',
  conditions: [
    {
      id: 'c-1',
      codeConceptId: 'con-faringitis',
      clinicalStatusConceptId: 'st-activa',
      encounterId: 'e-1',
      createdAt: '2026-03-01T10:10:00.000Z',
    },
  ],
  allergies: [],
  medicationRequests: [
    {
      id: 'm-1',
      medicationConceptId: 'med-amoxi',
      statusConceptId: 'st-activa',
      doseText: '500 mg',
      frequencyText: 'cada 8 horas',
      issuedAt: '2026-03-01T11:00:00.000Z',
      createdAt: '2026-03-01T10:30:00.000Z',
    },
  ],
  observations: [],
  encounters: [
    {
      id: 'e-1',
      statusConceptId: 'st-activa',
      reasonText: 'Dolor de garganta',
      startAt: '2026-03-01T10:00:00.000Z',
      endAt: '2026-03-01T10:40:00.000Z',
    },
  ],
  careEpisodes: [],
  limit: 50,
  truncated: [],
};

const CONCEPTOS = {
  items: [
    {
      conceptId: 'con-faringitis',
      code: 'J02',
      display: 'Faringitis aguda',
      codeSystemVersionId: 'v1',
    },
    { conceptId: 'st-activa', code: 'ACTIVE', display: 'Activa', codeSystemVersionId: 'v1' },
    {
      conceptId: 'med-amoxi',
      code: 'J01CA04',
      display: 'Amoxicilina',
      codeSystemVersionId: 'v1',
    },
  ],
  count: 3,
  limit: 200,
};

describe('MedicalRecord', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'my-account/medical-record', component: MedicalRecord }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Abre sesión con perfil de paciente (`pid`) antes de montar. */
  async function montar(claims: Record<string, unknown> = { pid: 'pp-1' }): Promise<void> {
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PATIENT'], tenants: ['t-1'], ...claims }),
      refreshToken: 'r-1',
    });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/my-account/medical-record', MedicalRecord);
  }

  function responder(resumen: object = RESUMEN, conceptos: object = CONCEPTOS): void {
    http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary').flush(resumen);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(conceptos);
    harness.detectChanges();
  }

  it('pide la historia del perfil propio, con su tope por bloque', async () => {
    await montar();

    const req = http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary');
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(RESUMEN);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTOS);
  });

  it('sin perfil de paciente no sale ninguna lectura', async () => {
    // Una cuenta de personal de salud: sesión válida, sin `pid`.
    await montar({});

    // El `http.verify()` del afterEach falla si algo salió a la red.
    expect(harness.routeNativeElement?.textContent).toContain('Esta sección es para pacientes');
  });

  it('muestra la atención con su motivo y sus diagnósticos, sin uuid', async () => {
    await montar();
    responder();

    const texto = harness.routeNativeElement?.textContent ?? '';
    expect(texto).toContain('Dolor de garganta');
    expect(texto).toContain('Faringitis aguda');
    expect(texto).not.toContain('con-faringitis');
  });

  it('muestra la receta traducida y su indicación', async () => {
    await montar();
    responder();

    const texto = harness.routeNativeElement?.textContent ?? '';
    expect(texto).toContain('Amoxicilina');
    expect(texto).toContain('500 mg · cada 8 horas');
  });

  it('cada atención y cada receta ofrecen su descarga (corrección #16)', async () => {
    await montar();
    responder();

    const raiz = harness.routeNativeElement;
    expect(raiz?.querySelector('[data-testid="historia-descargar-atencion"]')).not.toBeNull();
    expect(raiz?.querySelector('[data-testid="historia-descargar-receta"]')).not.toBeNull();
  });

  it('una historia sin nada registrado lo dice, con su salida', async () => {
    await montar();
    // Sin registros no hay conceptos que traducir, así que la lectura del
    // catálogo ni sale: pedirla vacía sería una petición que se sabe inútil.
    http
      .expectOne((r) => r.url === '/clinical/patients/pp-1/summary')
      .flush({
        ...RESUMEN,
        conditions: [],
        medicationRequests: [],
        encounters: [],
      });
    harness.detectChanges();

    expect(harness.routeNativeElement?.textContent).toContain('Todavía no hay atenciones');
  });

  it('si el catálogo falla, la historia igual se muestra', async () => {
    await montar();
    http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary').flush(RESUMEN);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush(
        { code: 'ERROR', message: 'Catálogo caído', timestamp: '', path: '' },
        { status: 500, statusText: 'Server Error' },
      );
    harness.detectChanges();

    const texto = harness.routeNativeElement?.textContent ?? '';
    // La atención sigue: perder la traducción no justifica perder la historia.
    expect(texto).toContain('Dolor de garganta');
    // Y lo que no se pudo traducir sale como ausencia, nunca como uuid.
    expect(texto).toContain('Sin registrar');
    expect(texto).not.toContain('med-amoxi');
  });

  it('lo recortado se declara: callarlo se lee como «no hay nada más»', async () => {
    await montar();
    responder({ ...RESUMEN, truncated: ['observations'] });

    expect(harness.routeNativeElement?.textContent).toContain('observations');
  });
});
