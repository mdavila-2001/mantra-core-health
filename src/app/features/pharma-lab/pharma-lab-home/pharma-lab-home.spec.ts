import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PharmaLabHome } from './pharma-lab-home';

const LAB_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';
const VISITOR_ID = '33333333-3333-4333-8333-333333333333';

const LAB = {
  id: LAB_ID,
  tenantId: TENANT_ID,
  labTypeConceptId: 'c-lab-type',
  legalName: 'Laboratorios Andes S.A.',
  tradeName: 'Andes Pharma',
  statusConceptId: 'c-lab-active',
};

const VISITOR_ACTIVO = {
  id: VISITOR_ID,
  pharmaLabId: LAB_ID,
  userId: '44444444-4444-4444-4444-444444444444',
  fullName: 'Ana Quiroga',
  internalCode: 'VM-001',
  assignedZone: 'Zona Sur',
  startedOn: '2026-01-05',
  identityVerificationConceptId: 'c-verif',
  contractVerificationConceptId: 'c-verif',
  credentialVerificationConceptId: 'c-verif',
  statusConceptId: 'c-link-active',
  publiclyListed: true,
};

const CONCEPTOS = [
  { key: 'LAB_ACTIVE', id: 'c-lab-active', code: 'PHL_LAB_ACTIVE', display: 'Laboratorio activo' },
  {
    key: 'LINK_ACTIVE',
    id: 'c-link-active',
    code: 'PHL_LINK_ACTIVE',
    display: 'Vinculación activa',
  },
  {
    key: 'LINK_TERMINATED',
    id: 'c-link-terminated',
    code: 'PHL_LINK_TERMINATED',
    display: 'Vinculación terminada',
  },
  { key: 'VERIFICATION_PENDING', id: 'c-verif', code: 'PHL_V', display: 'Verificación pendiente' },
];

const RATINGS = {
  sampleSize: 2,
  punctuality: 4,
  informationQuality: null,
  clarity: null,
  relevance: null,
  professionalConduct: null,
  materialUsefulness: null,
  overallSatisfaction: 4.5,
};

describe('PharmaLabHome', () => {
  let fixture: ComponentFixture<PharmaLabHome>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /**
   * Contesta la carga completa con los visitadores dados.
   *
   * El diccionario de conceptos sólo se pide **la primera vez**: está cacheado
   * para toda la sesión a propósito, y esperarlo en cada recarga afirmaría lo
   * contrario de lo que el servicio hace.
   */
  function cargar(
    visitors: readonly unknown[] = [VISITOR_ACTIVO],
    esPrimeraCarga = true,
  ): void {
    http.expectOne('/pharma-labs').flush([LAB]);
    http.expectOne(`/pharma-labs/${LAB_ID}/medical-visitors`).flush(visitors);
    http.expectOne(`/pharma-labs/${LAB_ID}/products`).flush([]);
    http.expectOne(`/pharma-labs/${LAB_ID}/materials`).flush([]);
    http.expectOne(`/pharma-labs/${LAB_ID}/pharmacovigilance/reports`).flush([]);
    http.expectOne(`/pharma-labs/${LAB_ID}/regulatory-documents`).flush([]);
    http.expectOne(`/visit-records/labs/${LAB_ID}/rating-summary`).flush(RATINGS);
    if (esPrimeraCarga) {
      http.expectOne('/pharma-labs/reference/concepts').flush(CONCEPTOS);
    }
    fixture.detectChanges();
  }

  /** Selecciona una pestaña por su rótulo; los paneles ocultos no se dibujan. */
  function abrirPestania(label: string): void {
    const raiz = fixture.nativeElement as HTMLElement;
    const boton = [...raiz.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      (candidato) => candidato.textContent?.trim() === label,
    );
    boton?.click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(PharmaLabHome);
    fixture.detectChanges();
  });

  it('muestra el laboratorio y sus visitadores con el estado en palabras', () => {
    cargar();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Laboratorios Andes S.A.');
    expect(texto).toContain('Ana Quiroga');
    // El estado se muestra rotulado, no como el uuid del concepto.
    expect(texto).toContain('Vinculación activa');
    expect(texto).not.toContain('c-link-active');
  });

  it('no desvincula sin motivo y lo dice', () => {
    cargar();

    const boton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-testid="unlink-VM-001"]',
    );
    boton?.click();
    fixture.detectChanges();

    // Sin motivo no sale ninguna petición: el aviso reemplaza a la llamada.
    http.expectNone(`/pharma-labs/${LAB_ID}/medical-visitors/${VISITOR_ID}/unlink`);
    const aviso = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="unlink-result"]',
    );
    expect(aviso?.textContent).toContain('Escribí el motivo');
  });

  it('desvincula con motivo y muestra qué se revocó', () => {
    cargar();

    const raiz = fixture.nativeElement as HTMLElement;
    const campo = raiz.querySelector<HTMLInputElement>('[data-testid="unlink-reason"]')!;
    campo.value = 'Fin de contrato';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    raiz.querySelector<HTMLButtonElement>('[data-testid="unlink-VM-001"]')!.click();

    const peticion = http.expectOne(
      `/pharma-labs/${LAB_ID}/medical-visitors/${VISITOR_ID}/unlink`,
    );
    expect(peticion.request.body).toEqual({ reason: 'Fin de contrato' });
    peticion.flush({
      id: VISITOR_ID,
      statusConceptId: 'c-link-terminated',
      revokedSessions: 3,
      revokedRefreshTokens: 2,
      cancelledVisitRequests: 1,
    });

    // Recarga con el visitador ya desvinculado.
    cargar(
      [
        {
          ...VISITOR_ACTIVO,
          statusConceptId: 'c-link-terminated',
          publiclyListed: false,
          unlinkReason: 'Fin de contrato',
        },
      ],
      false,
    );

    const aviso = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="unlink-result"]',
    );
    expect(aviso?.textContent).toContain('3 sesión(es) cerradas');
    expect(aviso?.textContent).toContain('2 token(s) revocados');
    expect(aviso?.textContent).toContain('1 visita(s) cancelada(s)');
  });

  it('un visitador desvinculado ya no ofrece la acción de desvincular', () => {
    cargar([
      {
        ...VISITOR_ACTIVO,
        statusConceptId: 'c-link-terminated',
        publiclyListed: false,
        unlinkReason: 'Fin de contrato',
      },
    ]);

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-testid="unlink-VM-001"]')).toBeNull();
    expect(raiz.querySelector('[data-testid="visitor-status-VM-001"]')?.textContent).toContain(
      'Vinculación terminada',
    );
  });

  it('presenta las calificaciones como promedios y nunca como notas individuales', () => {
    cargar();
    abrirPestania('Calificaciones');

    const ratings = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="ratings"]',
    );
    expect(ratings?.textContent).toContain('4.5');
    expect(ratings?.textContent).toContain('sin datos');
    // La pantalla no pide en ningún momento el listado de calificaciones.
    http.expectNone(`/visit-records/labs/${LAB_ID}/ratings`);
  });
});
