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
    // El cronograma lo rearma un efecto: corre en la detección de cambios.
    harness.detectChanges();
  }

  interface Fila {
    installmentNumber: number;
    dueDate: string;
    amount: number;
    pinned: boolean;
  }

  function filas(): readonly Fila[] {
    return campo<readonly Fila[]>('filas')();
  }

  describe('el plan de pagos flexible', () => {
    beforeEach(() => {
      elegirPacienteYServicio();
      completarDatosDelPlan();
    });

    it('no pregunta tasa ni método: no hay simulador de crédito', () => {
      const texto = (harness.routeNativeElement as HTMLElement).textContent ?? '';
      expect(texto).not.toMatch(/tasa|inter[eé]s \(|franc[eé]s|simulador/i);
      expect(texto).toContain('Sin interés');
      // Tampoco va al servidor a «simular»: el plan se arma en pantalla.
      http.expectNone((r) => r.url.includes('/simulate'));
    });

    it('reparte el precio en cuotas mensuales iguales que suman exacto', () => {
      expect(filas().map((f) => f.amount)).toEqual([33.34, 33.33, 33.33]);
      // Sin primer vencimiento elegido, un mes después de la atención.
      expect(filas().map((f) => f.dueDate)).toEqual(['2026-10-10', '2026-11-10', '2026-12-10']);
      expect(campo<boolean>('planCierra')()).toBe(true);
    });

    it('con anticipo, reparte sólo el saldo', () => {
      campo<number | null>('anticipo').set(40);
      harness.detectChanges();
      expect(filas().map((f) => f.amount)).toEqual([20, 20, 20]);
    });

    it('cambia la frecuencia a quincenal', () => {
      campo<string>('frecuencia').set('BIWEEKLY');
      harness.detectChanges();
      expect(filas().map((f) => f.dueDate)).toEqual(['2026-09-24', '2026-10-08', '2026-10-22']);
    });

    it('un monto escrito a mano queda fijado y las demás cuotas se reparten el resto', () => {
      metodo<(i: number, v: number) => void>('fijarMonto')(0, 50);
      expect(filas().map((f) => [f.amount, f.pinned])).toEqual([
        [50, true],
        [25, false],
        [25, false],
      ]);
      expect(campo<boolean>('planCierra')()).toBe(true);
    });

    it('si todo está fijado y no suma el precio, avisa y no deja guardar', () => {
      metodo<(i: number, v: number) => void>('fijarMonto')(0, 50);
      metodo<(i: number, v: number) => void>('fijarMonto')(1, 20);
      metodo<(i: number, v: number) => void>('fijarMonto')(2, 20);
      harness.detectChanges();

      expect(campo<string | null>('descuadre')()).toContain('Faltan 10,00');
      expect(campo<boolean>('puedeGuardar')()).toBe(false);
    });

    it('agregar y quitar cuotas conserva lo escrito a mano y renumera', () => {
      metodo<(i: number, v: Date) => void>('fijarVencimiento')(1, new Date(2026, 11, 24));
      metodo<() => void>('agregarCuota')();
      harness.detectChanges();
      expect(filas()).toHaveLength(4);
      expect(filas()[1]!.dueDate).toBe('2026-12-24');
      expect(filas().map((f) => f.amount)).toEqual([25, 25, 25, 25]);

      metodo<(i: number) => void>('quitarCuota')(0);
      harness.detectChanges();
      expect(filas().map((f) => f.installmentNumber)).toEqual([1, 2, 3]);
      expect(filas()[0]!.dueDate).toBe('2026-12-24');
      expect(filas().map((f) => f.amount)).toEqual([33.34, 33.33, 33.33]);
    });
  });

  describe('guardar', () => {
    it('manda el plan tal como quedó en pantalla, sin tasa ni método', () => {
      elegirPacienteYServicio();
      completarDatosDelPlan();
      metodo<(i: number, v: number) => void>('fijarMonto')(2, 50);

      metodo<() => void>('guardar')();

      const req = http.expectOne((r) => r.url === '/quotations' && r.method === 'POST');
      expect(req.request.body).toEqual({
        practiceId: 'pr1',
        patientProfileId: 'pac1',
        attentionDate: '2026-09-10',
        serviceCatalogId: 'srv1',
        offeredPrice: 100,
        paymentPlanInstallmentCount: 3,
        downPaymentAmount: 0,
        paymentFrequency: 'MONTHLY',
        installments: [
          { installmentNumber: 1, dueDate: '2026-10-10', amount: 25 },
          { installmentNumber: 2, dueDate: '2026-11-10', amount: 25 },
          { installmentNumber: 3, dueDate: '2026-12-10', amount: 50 },
        ],
        validUntil: '2026-10-10',
      });

      req.flush({
        id: 'q1',
        ...req.request.body,
        serviceNameSnapshot: SERVICIO.name,
        status: 'DRAFT',
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
          downPaymentAmount: 0,
          paymentFrequency: 'MONTHLY',
          attentionDate: '2026-09-10',
          validUntil: '2026-10-10',
        }),
      );
      expect(descargarPdf.mock.calls[0]![0].installments).toHaveLength(3);
    });

    it('sin paciente o sin servicio no exporta nada', () => {
      // La práctica y el catálogo se piden al abrir, elija o no el usuario.
      responderPractica();
      peticionDeServicios().flush(paginaDeServicios([]));

      metodo<() => void>('exportar')();

      expect(descargarPdf).not.toHaveBeenCalled();
    });
  });

  describe('desde la consulta', () => {
    it('abre con el paciente ya elegido', async () => {
      responderPractica();
      peticionDeServicios().flush(paginaDeServicios([]));

      // Misma ruta con otro query param reusaría el componente: se sale y se vuelve.
      await harness.navigateByUrl('/my-quotations');
      componente = await harness.navigateByUrl(`${RUTA}?patient=pac1`, QuotationForm);
      http.expectOne((r) => r.url === '/practices').flush([PRACTICA]);
      harness.detectChanges();
      http.expectOne((r) => r.url === '/billing/service-catalog').flush(paginaDeServicios([]));
      http
        .expectOne((r) => r.url === '/profiles/patients/pac1')
        .flush({
          profileId: 'pac1',
          personId: 'per1',
          patientCode: 'PAC-01',
          displayName: 'Ana Pérez',
          relatedPersons: [],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        });
      http.expectOne((r) => r.url === '/scheduling/bookings').flush(paginaDeCitas([]));

      expect(campo<{ displayName?: string } | null>('pacienteElegido')()?.displayName).toBe('Ana Pérez');
    });
  });
});
