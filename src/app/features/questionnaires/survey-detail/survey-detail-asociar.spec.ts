import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { API_BASE_URL } from '../../../core/data-access/api';
import {
  ID_TIPO_ATENCION_CONSULTA,
} from '../../../core/data-access/surveys/surveys-targets';
import { SurveyDetailScreen } from './survey-detail';

/* ============================================================================
    «Asociar a un servicio» con un selector y no con un UUID pegado.

    Lo que fija:
    1. El selector ofrece «Todas mis consultas» y los servicios del médico POR
       NOMBRE, con el `billing.service_catalog.id` como valor.
    2. Lo que viaja a `POST /surveys/assignments` es ese id (o el CARE_TYPE de
       consulta), nunca el texto de la etiqueta.
    3. La ficha dice a qué está asociada hoy con el NOMBRE del servicio; si el
       servidor no informó asociaciones, no afirma que no tiene ninguna.
    4. Un rechazo (409) se dice junto al selector y la ficha sigue en pie.
    ========================================================================== */

const VERSION = 'ver-1';

function detalle(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 's-1',
    title: 'Experiencia de teleconsulta',
    status: 'ACTIVE',
    latestVersionNumber: 1,
    latestVersionId: VERSION,
    published: true,
    questionCount: 0,
    responseWindowDays: 7,
    effectiveFrom: null,
    effectiveTo: null,
    questions: [],
    ...extra,
  };
}

const OFERTA = (id: string, catalogo: string, nombre: string) => ({
  id,
  practitionerProfileId: 'p',
  serviceCatalogId: catalogo,
  serviceCode: nombre,
  serviceName: nombre,
  price: '1.00',
  minDurationMinutes: 1,
  maxDurationMinutes: 2,
  prepMinutes: 0,
  cleanupMinutes: 0,
  isPatientBookable: true,
  requiresApproval: false,
  isActive: true,
});

describe('SurveyDetailScreen · asociar a un servicio', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let pantalla: SurveyDetailScreen;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '' },
        provideRouter([{ path: 'questionnaires/:surveyId', component: SurveyDetailScreen }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    pantalla = await harness.navigateByUrl('/questionnaires/s-1', SurveyDetailScreen);
  });

  afterEach(() => http.verify());

  const raiz = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const buscar = (testId: string): HTMLElement | null => raiz().querySelector(`[data-testid="${testId}"]`);

  /** Responde la ficha, sus respuestas y los servicios del médico. */
  function abrir(detalleEnCable: Record<string, unknown>, servicios = true): void {
    http.expectOne((r) => r.url === '/surveys/templates/s-1').flush(detalleEnCable);
    http.expectOne((r) => r.url === '/surveys/templates/s-1/responses').flush([]);
    const pedido = http.expectOne((r) => r.url === '/scheduling/service-offerings');
    if (servicios) {
      pedido.flush({
        items: [
          OFERTA('oferta-ecg', 'cat-ecg', 'Electrocardiograma'),
          OFERTA('oferta-holter', 'cat-holter', 'Holter de 24 horas'),
          // Dos ofertas del mismo servicio: una sola opción.
          OFERTA('oferta-ecg-2', 'cat-ecg', 'Electrocardiograma'),
        ],
      });
    } else {
      pedido.flush({ message: 'x' }, { status: 500, statusText: 'Server Error' });
    }
    harness.detectChanges();
  }

  const opciones = () => pantalla['opcionesDestino']();
  const elegir = (valor: string): void => {
    pantalla['formularioAsignacion'].setValue({ destino: valor });
    harness.detectChanges();
  };

  it('ya no hay un campo de texto para el UUID: hay un selector', () => {
    abrir(detalle());
    const campo = buscar('asignacion-servicio')!;
    expect(campo.tagName.toLowerCase()).toBe('app-select');
    expect(campo.querySelector('input[type="text"]')).toBeNull();
  });

  it('ofrece «Todas mis consultas» y los servicios por nombre, sin repetir el del catálogo', () => {
    abrir(detalle());
    expect(opciones().map((o) => o.label)).toEqual(['Todas mis consultas', 'Electrocardiograma', 'Holter de 24 horas']);
    // El valor es el id de catálogo, no el de la oferta.
    expect(opciones().map((o) => o.value)).toContain('cat-ecg');
    expect(opciones().map((o) => o.value)).not.toContain('oferta-ecg');
  });

  it('asociar un servicio manda SERVICE con su id de catálogo y relee la ficha', () => {
    abrir(detalle({ assignments: [] }));
    elegir('cat-ecg');
    (buscar('asignacion-guardar') as HTMLButtonElement).click();

    const post = http.expectOne((r) => r.method === 'POST' && r.url === '/surveys/assignments');
    expect(post.request.body).toEqual({ surveyVersionId: VERSION, targetType: 'SERVICE', targetId: 'cat-ecg' });
    post.flush({ id: 'a-1' }, { status: 201, statusText: 'Created' });

    // Persistencia: lo que se muestra sale de volver a leer, no de lo enviado.
    http
      .expectOne((r) => r.method === 'GET' && r.url === '/surveys/templates/s-1')
      .flush(detalle({ assignments: [{ id: 'a-1', targetType: 'SERVICE', targetId: 'cat-ecg' }] }));
    harness.detectChanges();

    const vigentes = (buscar('asignacion-vigentes')!.textContent ?? '').replace(/\s+/g, ' ');
    expect(vigentes).toContain('Electrocardiograma');
    expect(vigentes).not.toContain('cat-ecg');
  });

  it('«Todas mis consultas» manda CARE_TYPE con el valor aislado en la constante', () => {
    abrir(detalle({ assignments: [] }));
    elegir('TODAS_MIS_CONSULTAS');
    (buscar('asignacion-guardar') as HTMLButtonElement).click();
    const post = http.expectOne((r) => r.method === 'POST' && r.url === '/surveys/assignments');
    expect(post.request.body).toEqual({
      surveyVersionId: VERSION,
      targetType: 'CARE_TYPE',
      targetId: ID_TIPO_ATENCION_CONSULTA,
    });
    post.flush({ id: 'a-2' }, { status: 201, statusText: 'Created' });
    http.expectOne((r) => r.method === 'GET' && r.url === '/surveys/templates/s-1').flush(detalle());
  });

  it('sin elegir nada no se manda ninguna petición', () => {
    abrir(detalle({ assignments: [] }));
    (buscar('asignacion-guardar') as HTMLButtonElement).click();
    http.expectNone((r) => r.url === '/surveys/assignments');
  });

  it('dice a qué está asociada hoy con el nombre del servicio, nunca con el UUID', () => {
    abrir(
      detalle({
        assignments: [
          { id: 'a-1', targetType: 'SERVICE', targetId: 'cat-holter' },
          { id: 'a-2', targetType: 'CARE_TYPE', targetId: ID_TIPO_ATENCION_CONSULTA },
        ],
      }),
    );
    const texto = (buscar('asignacion-vigentes')!.textContent ?? '').replace(/\s+/g, ' ');
    expect(texto).toContain('Holter de 24 horas');
    expect(texto).toContain('Todas mis consultas');
    expect(texto).not.toContain('cat-holter');
    expect(texto).not.toContain(ID_TIPO_ATENCION_CONSULTA);
  });

  it('asociada a nada: lo dice sólo cuando el servidor mandó la lista vacía', () => {
    abrir(detalle({ assignments: [] }));
    expect(buscar('asignacion-ninguna')).not.toBeNull();
  });

  it('si el servidor no informó asociaciones, NO afirma que no tiene ninguna', () => {
    abrir(detalle());
    expect(buscar('asignacion-vigentes')).toBeNull();
    expect(buscar('asignacion-ninguna')).toBeNull();
  });

  it('un 409 se dice junto al selector y la ficha sigue en pie', () => {
    abrir(detalle({ assignments: [] }));
    elegir('cat-ecg');
    (buscar('asignacion-guardar') as HTMLButtonElement).click();
    http
      .expectOne((r) => r.method === 'POST' && r.url === '/surveys/assignments')
      .flush(
        { statusCode: 409, code: 'CONFLICT', message: 'Ya existe una asignación activa de esa versión a ese destino' },
        { status: 409, statusText: 'Conflict' },
      );
    harness.detectChanges();
    expect(buscar('asignacion-error')?.textContent).toContain('Ya existe una asignación activa');
    // La ficha no se reemplazó por una pantalla de error.
    expect(buscar('asignacion-servicio')).not.toBeNull();
  });

  it('si los servicios no cargan, «Todas mis consultas» sigue ofrecida y se puede reintentar', () => {
    abrir(detalle({ assignments: [] }), false);
    expect(opciones().map((o) => o.label)).toEqual(['Todas mis consultas']);
    expect(raiz().textContent).toContain('No pudimos traer sus servicios');
  });
});
