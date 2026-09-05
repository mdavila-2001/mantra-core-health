import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
/**
 * La descarga del PDF entra por `QUOTATION_PDF_DOWNLOADER`, no por `vi.mock`
 * (el sistema de pruebas de Angular no lo admite para imports relativos). Lo
 * que esta prueba comprueba es que el formulario exporta los datos correctos,
 * no cómo `buildBlocksPdf` maqueta el documento —eso lo prueba
 * `pdf-export.spec.ts`— y así tampoco depende del orden de carga de `jspdf`.
 */
import { QUOTATION_PDF_DOWNLOADER } from '../../../shared/utils/quotation-pdf/quotation-pdf';
import { QuotationForm } from './quotation-form';

const RUTA = '/my-quotations/new';

/** Lo que el formulario invoca al exportar: se provee por el token, sin PDF real. */
const descargarPdf = vi.fn();

const PRACTICA = { id: 'pr1', code: 'P1', name: 'Práctica 1' };

const SERVICIO = {
  id: 'srv1',
  practiceId: 'pr1',
  code: 'CONS-01',
  name: 'Consulta general',
  defaultPrice: '100.00',
  isActive: true,
};

const PACIENTE = {
  profileId: 'pac1',
  personId: 'per1',
  patientCode: 'PAC-01',
  displayName: 'Ana Pérez',
  deceased: false,
};

function paginaDeServicios(items: unknown[] = []) {
  return { items, count: items.length, limit: 25, nextCursor: null };
}

function paginaDeCitas(items: unknown[] = []) {
  return { items, count: items.length, limit: 20, truncated: false };
}

describe('QuotationForm', () => {
  let harness: RouterTestingHarness;
  let componente: QuotationForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    descargarPdf.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'my-quotations/new', component: QuotationForm },
          // A dónde vuelve el formulario después de guardar: sin esta ruta el
          // router lanza NG04002 fuera de la prueba que lo provocó.
          { path: 'my-quotations', children: [] },
        ]),
        { provide: QUOTATION_PDF_DOWNLOADER, useValue: descargarPdf },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl(RUTA, QuotationForm);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  /** Los métodos protegidos, atados a la instancia (no sirve para signals: `bind` les saca `.set`). */
  function metodo<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    if (typeof valor !== 'function') {
      throw new Error(`«${nombre}» no es un método`);
    }
    return valor.bind(componente) as T;
  }

  /** Un signal protegido, sin pasar por `bind` (que le sacaría `.set`/`.update`). */
  function campo<T>(nombre: string): { (): T; set: (valor: T) => void } {
    return (componente as unknown as Record<string, unknown>)[nombre] as {
      (): T;
      set: (valor: T) => void;
    };
  }

  /** La práctica siempre se pide primero, igual que en `services-catalog`. */
  function responderPractica(): void {
    http.expectOne((r) => r.url === '/practices').flush([PRACTICA]);
    harness.detectChanges();
  }

  function peticionDeServicios() {
    return http.expectOne((r) => r.url === '/billing/service-catalog');
  }

  /**
   * Deja el formulario con un paciente y un servicio elegidos «a mano»: se
   * llama directo a los métodos protegidos en vez de simular clics en la
   * tabla, que es lo que la propia búsqueda ya prueba en `clinical-record` y
   * `services-catalog`. Acá lo que importa es lo que el formulario hace
   * **después** de elegir, no la búsqueda en sí.
   */
  function elegirPacienteYServicio(): void {
    responderPractica();
    peticionDeServicios().flush(paginaDeServicios([]));

    metodo<(p: unknown) => void>('elegirPaciente')(PACIENTE);
    http.expectOne((r) => r.url === '/scheduling/bookings').flush(paginaDeCitas([]));

    metodo<(s: unknown) => void>('elegirServicio')(SERVICIO);
  }

  function completarDatosDelPlan(): void {
    campo<Date | null>('fechaDeAtencion').set(new Date(2026, 8, 10));
    campo<Date | null>('validaHasta').set(new Date(2026, 9, 10));
    campo<number | null>('plazoEnCuotas').set(3);
    campo<number | null>('tasaDeInteres').set(5);
  }

  describe('el simulador', () => {
    beforeEach(() => {
      elegirPacienteYServicio();
      completarDatosDelPlan();
    });

    it('simula con FLAT y renderiza la tabla que devuelve el backend', () => {
      vi.useFakeTimers();
      harness.detectChanges();
      vi.advanceTimersByTime(500);

      const req = http.expectOne((r) => r.url === '/quotations/simulate');
      expect(req.request.body.interestCalculationMethod).toBe('FLAT');

      req.flush({
        installments: [
          { installmentNumber: 1, dueDate: '2026-11-10', principalAmount: 33.33, interestAmount: 5, totalAmount: 38.33 },
        ],
      });
      harness.detectChanges();

      expect(campo<readonly unknown[]>('cuotas')()).toEqual([
        { installmentNumber: 1, dueDate: '2026-11-10', principalAmount: 33.33, interestAmount: 5, totalAmount: 38.33 },
      ]);
    });

    it('manda FRENCH cuando se elige ese método, y da una tabla distinta de la de FLAT', () => {
      vi.useFakeTimers();

      // Primero FLAT, para tener con qué comparar.
      harness.detectChanges();
      vi.advanceTimersByTime(500);
      http
        .expectOne((r) => r.url === '/quotations/simulate')
        .flush({
          installments: [
            { installmentNumber: 1, dueDate: '2026-11-10', principalAmount: 33.33, interestAmount: 5, totalAmount: 38.33 },
          ],
        });
      harness.detectChanges();
      const cuotasFlat = campo<readonly unknown[]>('cuotas')();

      // Cambiar a FRENCH es un parámetro nuevo: dispara otra simulación.
      campo<'FLAT' | 'FRENCH'>('metodo').set('FRENCH');
      harness.detectChanges();
      vi.advanceTimersByTime(500);

      const req = http.expectOne((r) => r.url === '/quotations/simulate');
      expect(req.request.body.interestCalculationMethod).toBe('FRENCH');

      req.flush({
        installments: [
          { installmentNumber: 1, dueDate: '2026-11-10', principalAmount: 32.65, interestAmount: 5.68, totalAmount: 38.33 },
        ],
      });
      harness.detectChanges();
      const cuotasFrench = campo<readonly unknown[]>('cuotas')();

      // Mismo total, reparto de capital/interés distinto: es lo que separa a
      // los dos métodos, y es responsabilidad exclusiva del backend — el
      // componente sólo tiene que pedir el método correcto y pintar lo que
      // vuelva, sin recalcular nada acá.
      expect(cuotasFrench).not.toEqual(cuotasFlat);
    });
  });

  describe('guardar', () => {
    it('manda el id del servicio elegido (su nombre visible en pantalla) en el payload exacto', () => {
      elegirPacienteYServicio();
      completarDatosDelPlan();

      metodo<() => void>('guardar')();

      const req = http.expectOne((r) => r.url === '/quotations' && r.method === 'POST');
      // El contrato de FT-24 no manda `serviceNameSnapshot` en el alta —lo
      // calcula y lo devuelve el backend—; lo que el formulario sí manda es
      // el identificador del servicio que se mostró y se eligió en pantalla
      // (`SERVICIO.name`), y este payload completo es la prueba de que es
      // exactamente ese servicio el que viaja, sin mezclarse con otro campo.
      expect(req.request.body).toEqual({
        practiceId: 'pr1',
        patientProfileId: 'pac1',
        attentionDate: '2026-09-10',
        serviceCatalogId: 'srv1',
        offeredPrice: 100,
        paymentPlanInstallmentCount: 3,
        interestRatePercent: 5,
        interestCalculationMethod: 'FLAT',
        validUntil: '2026-10-10',
      });

      req.flush({
        id: 'q1',
        ...req.request.body,
        serviceNameSnapshot: SERVICIO.name,
        status: 'DRAFT',
        installments: [],
      });
    });
  });

  describe('exportar', () => {
    it('llama a la descarga del PDF con los datos de la cotización en pantalla', () => {
      elegirPacienteYServicio();
      completarDatosDelPlan();

      metodo<() => void>('exportar')();

      expect(descargarPdf).toHaveBeenCalledTimes(1);
      expect(descargarPdf).toHaveBeenCalledWith(
        expect.objectContaining({
          patientName: 'Ana Pérez',
          serviceName: 'Consulta general',
          offeredPrice: 100,
          interestRatePercent: 5,
          interestCalculationMethod: 'FLAT',
          installmentCount: 3,
          attentionDate: '2026-09-10',
          validUntil: '2026-10-10',
        }),
      );
    });

    it('sin paciente o sin servicio no exporta nada', () => {
      // La práctica y el catálogo se piden al abrir, elija o no el usuario.
      responderPractica();
      peticionDeServicios().flush(paginaDeServicios([]));

      metodo<() => void>('exportar')();

      expect(descargarPdf).not.toHaveBeenCalled();
    });
  });
});
