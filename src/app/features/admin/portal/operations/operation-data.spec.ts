import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { esperarSinViolaciones } from '../../../../../testing/a11y';
import type { OperacionDetalle } from '../../../../core/data-access/admin-portal/portal.types';
import { billingTables, operationDetail } from '../portal.fixture';
import { OperationData } from './operation-data';

describe('OperationData', () => {
  let fixture: ComponentFixture<OperationData>;

  function montar(over: Partial<OperacionDetalle>): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(OperationData);
    fixture.componentRef.setInput('operation', operationDetail(over));
    fixture.componentRef.setInput('tableUrl', (schema: string, table: string) => `/t/${schema}/${table}`);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const num = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`)!.textContent!.trim();

  it('resume cuántas tablas escribe y cuántas lee, contando cada tabla una vez', () => {
    const el = montar({ datos: billingTables() });
    expect(num(el, 'portal-tables-distinct')).toBe('4');
    expect(num(el, 'portal-tables-writes')).toBe('2');
    expect(num(el, 'portal-tables-reads')).toBe('3');
    expect(num(el, 'portal-tables-read-only')).toBe('2');
    expect(num(el, 'portal-tables-accesses')).toBe('5');
    expect(el.textContent).toContain('1 tabla se lee y se escribe.');
  });

  it('separa «escribe» de «lee» y una tabla que hace las dos cosas sale en ambas listas', () => {
    const el = montar({ datos: billingTables() });
    const writes = el.querySelector('[data-testid="portal-tables-write-list"]')!;
    const reads = el.querySelector('[data-testid="portal-tables-read-list"]')!;
    expect(writes.textContent).toContain('billing.bill_lines');
    expect(writes.textContent).toContain('billing.bills');
    expect(writes.textContent).not.toContain('billing.vendors');
    expect(reads.textContent).toContain('billing.bills');
    expect(reads.textContent).toContain('billing.vendors');
    expect(reads.textContent).not.toContain('billing.bill_lines');
  });

  it('por cada acceso pinta la fuente, la confianza y la cadena de llamadas en orden', () => {
    const el = montar({ datos: billingTables() });
    const writes = el.querySelector('[data-testid="portal-tables-write-list"]')!;
    expect(writes.textContent).toContain('Acceso en src/modules/billing/repositories/bills.repository.ts:209');
    expect(writes.textContent).toContain('Confianza: Directa');
    const chain = [...writes.querySelectorAll('ol')[0]!.querySelectorAll('li')].map((li) => li.textContent!.trim());
    expect(chain).toEqual(['BillingPayablesController.registerBill', 'BillsService.register', 'BillsRepository.createLine']);
    expect(writes.querySelector('ol')!.getAttribute('aria-label')).toBe('Cadena de llamadas hasta la tabla');
    expect(el.querySelector('[data-testid="portal-tables-read-list"]')!.textContent).toContain('Confianza: Por SQL');
  });

  it('el verbo del acceso («Crea») se agrega al de la lista sólo cuando dice algo más', () => {
    const el = montar({ datos: billingTables() });
    const writes = el.querySelector('[data-testid="portal-tables-write-list"]')!;
    expect(writes.textContent).toContain('Escribe');
    expect(writes.textContent).toContain('Crea');
    // Un acceso de lectura repite «LEE» en `detalle`: no se pinta dos veces.
    const reads = el.querySelector('[data-testid="portal-tables-read-list"]')!.textContent!;
    expect(reads.match(/Lee/g)?.length).toBe(3);
  });

  it('enlaza cada tabla a su ficha y marca la que está fuera del catálogo', () => {
    const el = montar({ datos: billingTables() });
    const link = [...el.querySelectorAll('a')].find((a) => a.textContent!.trim() === 'billing.vendors')!;
    expect(link.getAttribute('href')).toBe('/t/billing/vendors');
    expect(el.textContent).toContain('No está en el catálogo');
  });

  it('un acceso sin cadena de llamadas lo dice en vez de dejar un hueco', () => {
    const el = montar({ datos: billingTables() });
    expect(el.textContent).toContain('El generador no anotó el camino de llamadas.');
  });

  it('una operación que sólo lee dice que no escribe en ninguna tabla', () => {
    const el = montar({});
    expect(num(el, 'portal-tables-writes')).toBe('0');
    expect(el.querySelector('[data-testid="portal-tables-write-empty"]')!.textContent).toContain('sólo consulta');
    expect(el.querySelector('[data-testid="portal-tables-read-list"]')).not.toBeNull();
  });

  it('sin tablas explica por qué, con el motivo curado si lo hay', () => {
    expect(montar({ datos: [], sinTablas: 'Sólo habla con Redis' }).textContent).toContain('No toca tablas: Sólo habla con Redis');
  });

  it('sin tablas y sin motivo orienta a dónde mirar y no muestra conteos', () => {
    const el = montar({ datos: [], sinTablas: null });
    expect(el.textContent).toContain('El inventario no encontró tablas que toque.');
    expect(el.textContent).toContain('árbol de decisión');
    expect(el.querySelector('[data-testid="portal-tables-summary"]')).toBeNull();
  });

  it('lo que el generador no pudo seguir se lista aparte, junto a los eventos y trabajos', () => {
    const el = montar({
      datos: billingTables(),
      eventos: ['billing.bill.registered'],
      trabajos: ['billing.reconcile'],
      noResuelto: ['this.handlers[kind].run (a.ts:10)'],
    });
    expect(el.textContent).toContain('billing.bill.registered');
    expect(el.textContent).toContain('billing.reconcile');
    expect(el.textContent).toContain('Lo que el generador no pudo seguir');
    expect(el.textContent).toContain('this.handlers[kind].run (a.ts:10)');
  });

  it('un verbo que el front no conoce se muestra como «Otros accesos» en lugar de perderse', () => {
    const [primera] = billingTables();
    const el = montar({ datos: [{ ...primera!, operacion: 'TRUNCA', detalle: 'TRUNCA' }] });
    expect(el.querySelector('[data-testid="portal-tables-other-list"]')!.textContent).toContain('TRUNCA');
  });

  it('no tiene violaciones de accesibilidad con tablas, cadenas y conteos', async () => {
    const el = montar({ datos: billingTables(), eventos: ['billing.bill.registered'] });
    await esperarSinViolaciones(el);
  }, 30_000);
});
