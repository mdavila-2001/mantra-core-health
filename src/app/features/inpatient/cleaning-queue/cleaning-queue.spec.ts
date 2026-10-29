import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SITIO_SANLUCAS } from '../../../core/mock/fixtures/agenda';
import { resetOps } from '../../../core/mock/handlers/infrastructure-ops.store';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { opsHttp } from '../testing/ops-test-http';
import { CleaningQueue } from './cleaning-queue';

describe('CleaningQueue (cola de limpieza)', () => {
  const dialogs = {
    confirm: vi.fn(async () => true),
    confirmWithReason: vi.fn(async (): Promise<string | null> => 'Quedó polvo'),
  };
  let failures: Record<string, number> = {};

  async function mount(persona: string, query = `site=${SITIO_SANLUCAS.id}`) {
    sessionStorage.setItem('mock:infra-ops-persona', persona);
    const http = opsHttp({ failures: () => failures });
    TestBed.configureTestingModule({
      providers: [...http.providers, provideRouter([{ path: 'inpatient/cleaning', component: CleaningQueue }]), { provide: DialogService, useValue: dialogs }],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/inpatient/cleaning?${query}`, CleaningQueue);
    await settle(harness);
    return { harness, requests: http.requests };
  }
  async function settle(harness: RouterTestingHarness): Promise<void> {
    for (let i = 0; i < 4; i++) {
      harness.detectChanges();
      await harness.fixture.whenStable();
      await new Promise((r) => setTimeout(r));
    }
    harness.detectChanges();
  }
  const el = (h: RouterTestingHarness): HTMLElement => h.routeNativeElement as HTMLElement;
  const rows = (h: RouterTestingHarness): HTMLElement[] => Array.from(el(h).querySelectorAll('tbody tr'));
  const rowOf = (h: RouterTestingHarness, bed: string): HTMLElement => rows(h).find((r) => r.textContent!.includes(bed))!;
  const buttonOf = (row: HTMLElement, label: string): HTMLButtonElement =>
    Array.from(row.querySelectorAll('button')).find((b) => b.textContent!.trim().includes(label))!;

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('mock:infra-ops-drift', 'off');
    resetOps();
    failures = {};
    dialogs.confirm.mockClear().mockResolvedValue(true);
    dialogs.confirmWithReason.mockClear().mockResolvedValue('Quedó polvo');
  });

  it('lista las órdenes abiertas, con la inmediata primero, la terminal resaltada y sin una sola columna de paciente', async () => {
    const { harness } = await mount('housekeeping');
    const table = el(harness).querySelector('[data-testid="cq-table"]')!;
    const cols = Array.from(table.querySelectorAll('th')).map((t) => t.textContent!.trim());
    expect(cols).toEqual(expect.arrayContaining(['Prioridad', 'Cama', 'Tipo', 'Estado', 'Pedida', 'Asignada a']));
    expect(cols.join(' ')).not.toMatch(/Paciente/i);
    expect(rows(harness)[0]!.textContent).toContain('QX-2'); // inmediata
    expect(rowOf(harness, 'UTI-4').textContent).toContain('Terminal');
    expect(rowOf(harness, 'UTI-4').querySelector('app-badge')).not.toBeNull();
    expect(el(harness).textContent).not.toMatch(/M\.R\.|J\.C\.|T\.V\./);
  });

  it('cada fila ofrece solo la transición válida para su estado y su rol', async () => {
    const { harness } = await mount('housekeeping');
    expect(buttonOf(rowOf(harness, '302-B'), 'Iniciar')).toBeTruthy();
    expect(buttonOf(rowOf(harness, '303-B'), 'Terminar')).toBeTruthy();
    // Limpieza no inspecciona: la orden terminada de 311-A no ofrece aprobar ni rechazar.
    expect(buttonOf(rowOf(harness, '311-A'), 'Aprobar')).toBeUndefined();
  });

  it('iniciar → terminar: manda If-Match con la versión de la orden y el estado cambia al releer', async () => {
    const { harness, requests } = await mount('housekeeping');
    buttonOf(rowOf(harness, '302-B'), 'Iniciar').click();
    await settle(harness);
    const start = requests.find((r) => r.url.endsWith('/start'))!;
    expect(start.headers['If-Match']).toBe('1');
    expect(start.status).toBe(200);
    expect(rowOf(harness, '302-B').textContent).toContain('En curso');
    buttonOf(rowOf(harness, '302-B'), 'Terminar').click();
    await settle(harness);
    expect(rowOf(harness, '302-B').textContent).toContain('Por inspeccionar');
  });

  it('la supervisión aprueba lo que otra persona terminó; la cama queda asignable', async () => {
    const { harness, requests } = await mount('housekeeping-supervisor');
    buttonOf(rowOf(harness, '311-A'), 'Aprobar').click();
    await settle(harness);
    const inspect = requests.find((r) => r.url.endsWith('/inspect'))!;
    expect(inspect.body).toEqual({ result: 'PASS' });
    expect(inspect.status).toBe(200);
    expect(rows(harness).some((r) => r.textContent!.includes('311-A'))).toBe(false); // salió de las abiertas
  });

  it('rechazar pide el motivo y abre una orden nueva', async () => {
    const { harness, requests } = await mount('housekeeping-supervisor');
    buttonOf(rowOf(harness, '311-A'), 'Rechazar').click();
    await settle(harness);
    expect(dialogs.confirmWithReason).toHaveBeenCalled();
    expect(requests.find((r) => r.url.endsWith('/inspect'))!.body).toEqual({ result: 'FAIL', reasonText: 'Quedó polvo' });
    expect(rowOf(harness, '311-A').textContent).toContain('Pendiente');
    expect(rowOf(harness, '311-A').textContent).toContain('Inspección rechazada');
  });

  it('si otra persona se adelantó, la API responde 412, la cola lo dice y se relee', async () => {
    const { harness } = await mount('housekeeping');
    const { orders } = await import('../../../core/mock/handlers/infrastructure-ops.store');
    const stale = orders.todos().find((o) => o.careSpace.code === '302-B' && o.status === 'CLN_PENDING')!;
    orders.actualizar(stale.id, { rowVersion: stale.rowVersion + 1 });
    buttonOf(rowOf(harness, '302-B'), 'Iniciar').click();
    await settle(harness);
    expect(el(harness).textContent).toContain('Otra persona cambió este dato');
    expect(el(harness).textContent).toContain('Código de soporte');
  });

  it('S3: con el filtro de estado sin órdenes, dice por qué y ofrece volver al tablero', async () => {
    const { harness } = await mount('housekeeping', `site=${SITIO_SANLUCAS.id}&status=CLN_REJECTED`);
    expect(el(harness).textContent).toContain('Ninguna orden coincide con ese estado');
    expect(el(harness).textContent).toContain('Ver el tablero de camas');
  });

  it('S5: si la API niega la lectura', async () => {
    failures = { [`GET /sites/${SITIO_SANLUCAS.id}/cleaning-orders`]: 403 };
    const { harness } = await mount('housekeeping');
    expect(el(harness).textContent).toContain('No tiene acceso');
  });

  it('S7: con la lectura vieja avisa cuántos minutos y ofrece reintentar', async () => {
    sessionStorage.setItem('mock:infra-antiguedad', '5');
    const { harness } = await mount('housekeeping');
    expect(el(harness).querySelector('[data-testid="cq-stale"]')?.textContent).toContain('Dato de hace 5 min');
  });

  it('«Pedir limpieza» solo se ofrece a quien puede crear órdenes', async () => {
    const { harness } = await mount('housekeeping');
    expect(el(harness).querySelector('[data-testid="cq-create"]')).not.toBeNull();
    TestBed.resetTestingModule();
    const other = await mount('admin');
    expect(el(other.harness).querySelector('[data-testid="cq-create"]')).toBeNull();
  });
});
