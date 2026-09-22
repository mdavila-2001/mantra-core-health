import { TestBed, type ComponentFixture } from '@angular/core/testing';

import {
  PEDIDO_ENTREGADO_CON_FACTURA,
  facturaDeEjemplo,
} from '../../pharmacy-inbox.fixtures';
import { ResumenDeFactura } from './resumen-de-factura';

/**
 * El resumen de factura del mostrador (FAR-I3): dice lo que hay que poder
 * responder de memoria —número, fecha, total y si ya salió— y no promete una
 * descarga que esta pantalla no puede cumplir: la pide, y quien la contiene
 * decide.
 */
describe('ResumenDeFactura', () => {
  let fixture: ComponentFixture<ResumenDeFactura>;

  /** La emisión se inyecta: la maqueta la fecha, no el pedido. */
  const EMITIDA_EL = new Date('2026-09-04T15:00:00.000Z');

  function montar(): HTMLElement {
    fixture = TestBed.createComponent(ResumenDeFactura);
    const factura = facturaDeEjemplo(PEDIDO_ENTREGADO_CON_FACTURA, EMITIDA_EL);
    expect(factura).not.toBeNull();
    fixture.componentRef.setInput('factura', factura);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => fixture.destroy());

  it('pinta número, emisión, total y estado del comprobante', () => {
    const root = montar();
    const texto = root.textContent ?? '';
    expect(texto).toContain('Número');
    expect(texto).toContain('Emitida el');
    // El día depende del huso de quien corre la prueba; el mes y el año no.
    expect(texto).toContain('/09/2026');
    expect(texto).toContain('68.00 BOB');
    expect(texto).toContain('Enviada al paciente');
  });

  it('se declara maqueta en la propia pantalla', () => {
    expect(montar().textContent ?? '').toContain('Datos de ejemplo');
  });

  it('nunca deja ver el identificador del pedido', () => {
    expect(montar().textContent ?? '').not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });

  it('la descarga se pide hacia afuera; el componente no la resuelve solo', () => {
    const root = montar();
    const pedidas: number[] = [];
    fixture.componentInstance.descargaSolicitada.subscribe(() => pedidas.push(1));

    root
      .querySelector<HTMLButtonElement>('[data-testid="mostrador-descargar-factura"]')
      ?.click();
    fixture.detectChanges();

    expect(pedidas).toHaveLength(1);
  });
});
