import { environment } from '../../../environments/environment';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { API_BASE_URL } from '../../core/data-access/api';
import type { SimulatedCharge } from '../../core/data-access/billing-simulated/billing-simulated.types';
import type { FacturacionSimulada } from '../../core/mock/billing-sim/facturacion-simulada';
import { apiRealForzada } from '../../core/mock/modo-api';
import { ToastService } from '../../shared/components/molecules/toast/toast.service';
import { Billing } from './billing';
import { motorDePrueba } from './billing.spec-fixtures';
import { resumenDeCobros } from './billing-summary';
import { FACTURACION_SIMULADA_DISPONIBLE } from './facturacion-disponible';

/**
 * La pantalla contra respuestas del **mismo motor** que atiende la maqueta:
 * cada `flush` es lo que `/billing/simulated/*` respondería.
 */
describe('Billing · facturación contra el SIAT SIMULADO', () => {
  let fixture: ComponentFixture<Billing>;
  let http: HttpTestingController;
  let motor: FacturacionSimulada;

  function montar(disponible: boolean): void {
    TestBed.configureTestingModule({
      imports: [Billing],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '' },
        { provide: FACTURACION_SIMULADA_DISPONIBLE, useValue: () => disponible },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    motor = motorDePrueba();
    fixture = TestBed.createComponent(Billing);
    fixture.detectChanges();
  }

  function responderLectura(): void {
    const cobros = motor.listarCobros();
    http.expectOne('/billing/simulated/charges').flush({ items: cobros, count: cobros.length, simulated: true });
    http.expectOne('/billing/simulated/catalogs').flush(motor.catalogos());
    http.expectOne('/billing/simulated/status').flush(motor.estadoFiscal());
    http.expectOne('/billing/simulated/outbox').flush({ items: motor.bandejaDeSalida(), count: 0, simulated: true });
    fixture.detectChanges();
  }

  function responderRefresco(): void {
    const cobros = motor.listarCobros();
    http.expectOne('/billing/simulated/charges').flush({ items: cobros, count: cobros.length, simulated: true });
    http.expectOne('/billing/simulated/status').flush(motor.estadoFiscal());
    fixture.detectChanges();
  }

  function el(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  function cobroDe(predicado: (c: SimulatedCharge) => boolean): SimulatedCharge {
    return fixture.componentInstance.datos()!.cobros.find(predicado)!;
  }

  afterEach(() => http.verify());

  describe('la puerta por omisión', () => {
    const originalEnvironment = {
      mockBackend: environment.mockBackend,
      billingSiatDemo: environment.billingSiatDemo,
    };

    afterEach(() => {
      apiRealForzada.set(false);
      Object.assign(environment, originalEnvironment);
    });

    it('se abre en la maqueta y se cierra si se fuerza la API real', () => {
      Object.assign(environment, { mockBackend: true, billingSiatDemo: true });
      TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
      http = TestBed.inject(HttpTestingController);
      const disponible = TestBed.inject(FACTURACION_SIMULADA_DISPONIBLE);
      expect(disponible()).toBe(true);
      apiRealForzada.set(true);
      expect(disponible()).toBe(false);
    });
  });

  it('sin facturación simulada disponible, dice que no está conectada y no pide nada', () => {
    montar(false);
    expect(el('facturacion-no-conectada')?.textContent).toContain('no está conectada');
    expect(el('aviso-simulado')).not.toBeNull();
    http.expectNone((r) => r.url.includes('/billing/simulated'));
  });

  it('muestra el aviso SIMULADO, el estado fiscal, las cifras y una fila por cobro', () => {
    montar(true);
    responderLectura();
    const cobros = motor.listarCobros();
    const resumen = resumenDeCobros(cobros);
    expect(el('aviso-simulado')?.textContent).toContain('no emite facturas reales');
    expect(el('estado-fiscal')?.textContent).toContain('SIMULADO');
    expect(el('monto-cobrado')?.textContent).toContain(resumen.montoCobrado);
    expect(el('pacientes-con-pago')?.textContent?.trim()).toBe(String(resumen.pacientesConPago));
    expect(fixture.nativeElement.querySelectorAll('[data-testid="fila-de-cobro"]').length).toBe(cobros.length);
  });

  it('filtra por origen y las cifras siguen al filtro', () => {
    montar(true);
    responderLectura();
    fixture.componentInstance.origen.set('PHARMACY');
    fixture.detectChanges();
    const deFarmacia = motor.listarCobros().filter((c) => c.source === 'PHARMACY');
    expect(fixture.nativeElement.querySelectorAll('[data-testid="fila-de-cobro"]').length).toBe(deFarmacia.length);
    expect(el('monto-cobrado')?.textContent).toContain(resumenDeCobros(deFarmacia).montoCobrado);
  });

  it('registra el pago simulado de un cobro pendiente', () => {
    montar(true);
    responderLectura();
    const componente = fixture.componentInstance;
    const pendiente = cobroDe((c) => c.payment === null && c.plan === null);
    componente.seleccionar(pendiente);
    fixture.detectChanges();
    expect(el('formulario-de-pago')).not.toBeNull();
    componente.formularioDePago.setValue({ methodCode: 1 });
    componente.registrarPago(pendiente);
    const req = http.expectOne(`/billing/simulated/charges/${pendiente.id}/payment`);
    expect(req.request.body).toEqual({ methodCode: 1 });
    const r = motor.registrarPago(pendiente.id, 1);
    req.flush(r.ok ? r.value : null);
    fixture.detectChanges();
    expect(el('pago-registrado')?.textContent).toContain('SIMULADO');
    expect(el('formulario-de-factura')).not.toBeNull();
  });

  it('un cobro con plan se cobra por instancia: tabla del plan, sin pago de una vez ni factura hasta saldarlo', () => {
    montar(true);
    responderLectura();
    const componente = fixture.componentInstance;
    const conPlan = cobroDe((c) => c.plan !== null && c.payment === null);
    componente.seleccionar(conPlan);
    fixture.detectChanges();

    expect(el('plan-de-pagos')).not.toBeNull();
    expect(el('formulario-de-pago')).toBeNull();
    expect(el('formulario-de-factura')).toBeNull();
    // En esta pantalla la factura tiene su formulario propio: el plan no la ofrece.
    expect(el('plan-generar-factura')).toBeNull();

    // Saldado en el motor, el mismo cobro ya ofrece su formulario de factura.
    for (const i of conPlan.plan!.instances.filter((x) => x.balance !== '0.00')) {
      motor.registrarPagoDeInstancia(conPlan.id, i.id, { methodCode: 1, amount: i.balance });
    }
    componente['reemplazarCobro'](motor.cobro(conPlan.id)!);
    fixture.detectChanges();
    expect(el('plan-saldado')).not.toBeNull();
    expect(el('pago-registrado')).not.toBeNull();
    expect(el('formulario-de-factura')).not.toBeNull();
  });

  it('confirma la facturación: 908, CUF, respuesta del SIAT simulado y línea de tiempo', () => {
    montar(true);
    responderLectura();
    const componente = fixture.componentInstance;
    const pagado = cobroDe((c) => c.payment !== null && c.latestInvoice === null);
    componente.seleccionar(pagado);
    fixture.detectChanges();
    if (componente.formularioDeFactura.controls.documentNumber.value === '') {
      componente.formularioDeFactura.controls.documentNumber.setValue('1234567');
    }
    componente.confirmarFacturacion(pagado);
    const req = http.expectOne(`/billing/simulated/charges/${pagado.id}/invoices`);
    expect(req.request.body.buyer.name).toBe(pagado.suggestedBuyer.name);
    expect(req.request.body.simulation).toBeUndefined();
    const r = motor.emitirFactura(pagado.id, req.request.body, 'prueba');
    req.flush(r.ok ? r.value : null);
    responderRefresco();
    expect(el('factura')?.textContent).toContain('Validada (SIMULADO)');
    expect(el('respuesta-siat')?.textContent).toContain('908');
    expect(el('cuf')?.textContent?.trim()).toBe(r.ok ? r.value.cuf : '');
    expect(el('linea-de-tiempo')?.querySelectorAll('li').length).toBe(4);
    expect(el('formulario-de-factura')).toBeNull();
  });

  it('un rechazo forzado muestra el 902 con su mensaje y deja reintentar', () => {
    montar(true);
    responderLectura();
    const componente = fixture.componentInstance;
    const pagado = cobroDe((c) => c.payment !== null && c.latestInvoice === null);
    componente.seleccionar(pagado);
    componente.formularioDeFactura.patchValue({ documentNumber: '1234567', forceMessageCode: 1013 });
    componente.confirmarFacturacion(pagado);
    const req = http.expectOne(`/billing/simulated/charges/${pagado.id}/invoices`);
    expect(req.request.body.simulation).toEqual({ forceMessageCode: 1013 });
    const r = motor.emitirFactura(pagado.id, req.request.body, 'prueba');
    req.flush(r.ok ? r.value : null);
    responderRefresco();
    expect(el('respuesta-siat')?.textContent).toContain('902');
    expect(el('mensajes-siat')?.textContent).toContain('1013');
    expect(el('mensajes-siat')?.textContent).toContain('forzado');
    expect(el('formulario-de-factura')).not.toBeNull();
  });

  it('anula la factura y ofrece revertir', () => {
    montar(true);
    responderLectura();
    const componente = fixture.componentInstance;
    const pagado = cobroDe((c) => c.payment !== null && c.latestInvoice === null);
    componente.seleccionar(pagado);
    componente.formularioDeFactura.patchValue({ documentNumber: '1234567' });
    componente.confirmarFacturacion(pagado);
    const emitir = http.expectOne(`/billing/simulated/charges/${pagado.id}/invoices`);
    const emitida = motor.emitirFactura(pagado.id, emitir.request.body, 'prueba');
    emitir.flush(emitida.ok ? emitida.value : null);
    responderRefresco();
    const factura = componente.factura()!;
    componente.formularioDeAnulacion.setValue({ reasonCode: 1 });
    componente.anular(factura);
    const anular = http.expectOne(`/billing/simulated/invoices/${factura.id}/annulment`);
    const anulada = motor.anular(factura.id, 1);
    anular.flush(anulada.ok ? anulada.value : null);
    responderRefresco();
    expect(el('factura')?.textContent).toContain('Anulada (SIMULADO)');
    expect(el('respuesta-siat')?.textContent).toContain('905');
    expect(fixture.nativeElement.textContent).toContain('Revertir anulación (SIMULADO)');
  });

  describe('abrir y cerrar el detalle (QA manual: «Ver» no mostraba nada a la vista)', () => {
    let desplazar: ReturnType<typeof vi.fn>;
    const original = Element.prototype.scrollIntoView;

    beforeEach(() => {
      // jsdom no implementa `scrollIntoView`.
      desplazar = vi.fn();
      Element.prototype.scrollIntoView = desplazar as unknown as typeof Element.prototype.scrollIntoView;
    });

    afterEach(() => {
      Element.prototype.scrollIntoView = original;
    });

    function botonVer(fila = 0): HTMLButtonElement {
      return fixture.nativeElement.querySelectorAll('[data-testid="fila-de-cobro"] button[data-charge-id]')[fila];
    }

    async function renderizar(): Promise<void> {
      fixture.detectChanges();
      await fixture.whenStable();
    }

    it('«Ver» baja hasta el detalle y le da el foco a su título', async () => {
      montar(true);
      responderLectura();
      const ver = botonVer(0);
      ver.click();
      await renderizar();
      const titulo = fixture.nativeElement.querySelector('#titulo-detalle') as HTMLElement;
      expect(titulo).not.toBeNull();
      expect(titulo.getAttribute('tabindex')).toBe('-1');
      expect(document.activeElement).toBe(titulo);
      expect(desplazar).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }));
      expect(desplazar.mock.contexts[0]).toBe(titulo);
    });

    it('«Cerrar» devuelve el foco al «Ver» de la fila que abrió el detalle', async () => {
      montar(true);
      responderLectura();
      const ver = botonVer(1);
      const id = ver.dataset['chargeId'];
      ver.click();
      await renderizar();
      const cerrar = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(
        (b) => b.textContent?.trim() === 'Cerrar',
      )!;
      cerrar.click();
      await renderizar();
      expect(el('detalle-de-cobro')).toBeNull();
      const activo = document.activeElement as HTMLElement;
      expect(activo.dataset['chargeId']).toBe(id);
      expect(desplazar.mock.contexts.at(-1)).toBe(activo);
    });

    it('sin animación cuando se pidió reducir movimiento', async () => {
      const matchMedia = window.matchMedia;
      window.matchMedia = ((consulta: string) =>
        ({ matches: consulta.includes('reduce'), media: consulta }) as MediaQueryList) as typeof window.matchMedia;
      try {
        montar(true);
        responderLectura();
        botonVer(0).click();
        await renderizar();
        expect(desplazar).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
      } finally {
        window.matchMedia = matchMedia;
      }
    });

    it('el botón «Ver» dice qué cobro abre', () => {
      montar(true);
      responderLectura();
      const primero = motor.listarCobros()[0]!;
      expect(botonVer(0).getAttribute('aria-label')).toBe(`Ver ${primero.description} de ${primero.patientName}`);
    });
  });

  it('un error del simulador llega como aviso, con el mensaje del contrato', () => {
    montar(true);
    responderLectura();
    const toast = TestBed.inject(ToastService);
    const error = vi.spyOn(toast, 'error');
    const componente = fixture.componentInstance;
    const pendiente = cobroDe((c) => c.payment === null && c.plan === null);
    componente.seleccionar(pendiente);
    componente.formularioDePago.setValue({ methodCode: 1 });
    componente.registrarPago(pendiente);
    http
      .expectOne(`/billing/simulated/charges/${pendiente.id}/payment`)
      .flush({ statusCode: 409, code: 'CONFLICT', message: 'El cobro ya está pagado' }, { status: 409, statusText: 'Conflict' });
    expect(error).toHaveBeenCalledWith('El cobro ya está pagado', 'Facturación (SIMULADO)');
  });
});
