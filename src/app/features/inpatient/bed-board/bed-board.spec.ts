import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SITIO_NORTE, SITIO_OTRO_TENANT } from '../../../core/mock/fixtures/infrastructure.data';
import { SITIO_SANLUCAS } from '../../../core/mock/fixtures/agenda';
import { resetOps } from '../../../core/mock/handlers/infrastructure-ops.store';
import { uuid } from '../../../core/mock/mock-store';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { opsHttp } from '../testing/ops-test-http';
import { BedBoard } from './bed-board';

const bedId = (code: string): string => uuid(`infra-sanlucas-${code}`);
/** La unidad por omisión del tablero es la primera por nombre (Maternidad); casi todo vive en Medicina interna. */
const MEDICINE = uuid('unit-SANLUCAS-MEDINT');

describe('BedBoard (tablero de camas)', () => {
  const dialogs = {
    confirm: vi.fn(async () => true),
    confirmWithReason: vi.fn(async (): Promise<string | null> => 'Derrame de suero'),
  };
  let failures: Record<string, number> = {};

  async function mount(query = `site=${SITIO_SANLUCAS.id}`): Promise<{ harness: RouterTestingHarness; requests: ReturnType<typeof opsHttp>['requests'] }> {
    const http = opsHttp({ failures: () => failures });
    TestBed.configureTestingModule({
      providers: [...http.providers, provideRouter([{ path: 'inpatient/bed-board', component: BedBoard }]), { provide: DialogService, useValue: dialogs }],
    });
    const harness = await RouterTestingHarness.create();
    const url = /unit=/.test(query) ? query : `${query}&unit=${MEDICINE}`;
    const board = await harness.navigateByUrl(`/inpatient/bed-board?${url}`, BedBoard);
    await settle(harness);
    return { harness, requests: http.requests, ...{ board } };
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
  const q = (h: RouterTestingHarness, testId: string): HTMLElement | null => el(h).querySelector(`[data-testid="${testId}"]`);
  const text = (h: RouterTestingHarness): string => (el(h).textContent ?? '').replace(/\s+/g, ' ');

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('mock:infra-ops-drift', 'off');
    sessionStorage.setItem('mock:infra-ops-persona', 'nurse');
    resetOps();
    failures = {};
    dialogs.confirm.mockClear().mockResolvedValue(true);
    dialogs.confirmWithReason.mockClear().mockResolvedValue('Derrame de suero');
  });

  it('es UNA tarjeta con las unidades en pestañas, «Actualizado hace…» a la vista y los recuentos de cada unidad', async () => {
    const { harness } = await mount();
    expect(el(harness).querySelectorAll('app-card')).toHaveLength(1);
    const tabs = Array.from(el(harness).querySelectorAll('[role="tab"]')).map((t) => t.textContent!.trim());
    expect(tabs.some((t) => t.startsWith('Medicina interna'))).toBe(true);
    expect(tabs.some((t) => t.startsWith('Quirófanos'))).toBe(true);
    expect(q(harness, 'bb-freshness-text')?.textContent).toContain('Actualizado hace');
    expect(el(harness).querySelectorAll('[data-count="assignable"]').length).toBeGreaterThan(0);
    expect(q(harness, 'bb-legend')?.querySelectorAll('li')).toHaveLength(7);
  });

  it('cada cama es un botón con el estado en texto y su código', async () => {
    const { harness } = await mount();
    const tile = q(harness, 'bed-tile-302-A');
    expect(tile?.tagName).toBe('BUTTON');
    expect(tile?.getAttribute('data-v2')).toBe('U');
    expect(tile?.getAttribute('aria-label')).toContain('Disponible');
  });

  it('los recuentos de la pestaña salen de las celdas que se ven', async () => {
    const { harness } = await mount();
    const tabs = el(harness).querySelectorAll('[role="tab"]');
    const medicina = Array.from(tabs).findIndex((t) => t.textContent!.includes('Medicina interna'));
    (tabs[medicina] as HTMLElement).click();
    await settle(harness);
    const tiles = el(harness).querySelectorAll('app-bed-tile');
    const assignable = Number(q(harness, `bb-counts-${medicina}`)!.querySelector('[data-count="assignable"]')!.textContent);
    const libres = Array.from(tiles).filter((t) => t.querySelector('[data-v2="U"]')).length;
    expect(tiles.length).toBeGreaterThan(0);
    expect(assignable).toBe(libres);
  });

  it('elegir una cama abre el panel con sus ejes y las acciones de enfermería; la URL lo recuerda', async () => {
    const { harness } = await mount();
    q(harness, 'bed-tile-302-A')!.click();
    await settle(harness);
    expect(TestBed.inject(Router).url).toContain(`cell=${bedId('302-A')}`);
    expect(q(harness, 'bb-panel')).not.toBeNull();
    expect(q(harness, 'axis-hygiene')?.textContent).toContain('Inspeccionada');
    expect(q(harness, 'axis-assignable')?.textContent).toContain('Sí');
    expect(q(harness, 'action-block-clinical')).not.toBeNull();
    expect(q(harness, 'action-mark-dirty')).not.toBeNull();
    expect(q(harness, 'action-start-maintenance')).toBeNull();
  });

  it('marcar sucia: pide el motivo, manda If-Match-Ops, la cama pasa a «por limpiar» y el tablero se relee', async () => {
    const { harness, requests } = await mount(`site=${SITIO_SANLUCAS.id}&cell=${bedId('302-A')}`);
    q(harness, 'action-mark-dirty')!.click();
    await settle(harness);
    const post = requests.find((r) => r.method === 'POST' && r.url.endsWith('/hygiene'))!;
    expect(post.headers['If-Match-Ops']).toBe('1');
    expect(post.body).toEqual({ action: 'mark-dirty', reasonText: 'Derrame de suero' });
    expect(post.status).toBe(200);
    expect(q(harness, 'bed-tile-302-A')?.getAttribute('data-v2')).toBe('H');
    expect(q(harness, 'axis-hygiene')?.textContent).toContain('Sucia');
    expect(q(harness, 'cell-order')).not.toBeNull();
  });

  it('un 412 por versión vieja avisa y muestra el estado vigente', async () => {
    const { harness } = await mount(`site=${SITIO_SANLUCAS.id}&cell=${bedId('302-A')}`);
    // Otra persona cambió la cama por su lado: la versión que esta pantalla tiene quedó vieja.
    const { opsStates } = await import('../../../core/mock/handlers/infrastructure-ops.store');
    opsStates.actualizar(bedId('302-A'), { opsVersion: 9 });
    q(harness, 'action-mark-dirty')!.click();
    await settle(harness);
    expect(q(harness, 'cell-detail')!.textContent).toContain('Otra persona cambió el estado de esta cama');
    expect(q(harness, 'cell-detail')!.textContent).toContain('Código de soporte');
  });

  describe('vistas por rol', () => {
    it('limpieza ve solo el eje de higiene: sin paciente, sin aislamiento, sin recuentos de bloqueo y sin acciones clínicas', async () => {
      sessionStorage.setItem('mock:infra-ops-persona', 'housekeeping');
      const { harness } = await mount(`site=${SITIO_SANLUCAS.id}&cell=${bedId('301-A')}`);
      expect(q(harness, 'bb-hygiene-note')).not.toBeNull();
      expect(text(harness)).not.toMatch(/M\.R\.|J\.C\.|Tuberculosis|Rotavirus/);
      expect(q(harness, 'axis-isolation')).toBeNull();
      expect(q(harness, 'axis-occupancy')).toBeNull();
      expect(q(harness, 'action-block-clinical')).toBeNull();
      expect(q(harness, 'action-isolate')).toBeNull();
      expect(el(harness).querySelector('[data-count="blocked"]')).toBeNull();
    });

    it('mantenimiento ofrece mantenimiento y no bloqueo clínico; administración, bloqueo administrativo y cierre', async () => {
      sessionStorage.setItem('mock:infra-ops-persona', 'maintenance');
      let { harness } = await mount(`site=${SITIO_SANLUCAS.id}&cell=${bedId('302-A')}`);
      expect(q(harness, 'action-start-maintenance')).not.toBeNull();
      expect(q(harness, 'action-block-clinical')).toBeNull();
      expect(q(harness, 'axis-occupancy')?.textContent).not.toMatch(/\d+ años/);
      TestBed.resetTestingModule();
      sessionStorage.setItem('mock:infra-ops-persona', 'admin');
      ({ harness } = await mount(`site=${SITIO_SANLUCAS.id}&cell=${bedId('302-A')}`));
      expect(q(harness, 'action-block-admin')).not.toBeNull();
      expect(q(harness, 'action-close')).not.toBeNull();
      expect(q(harness, 'action-mark-dirty')).toBeNull();
    });

    it('enfermería ve al paciente (iniciales, sexo, edad) y solo ella', async () => {
      const { harness } = await mount(`site=${SITIO_SANLUCAS.id}&cell=${bedId('301-A')}`);
      expect(q(harness, 'axis-occupancy')?.textContent).toContain('M.R.');
      expect(q(harness, 'axis-occupancy')?.textContent).toContain('54 años');
    });
  });

  describe('los nueve estados M34', () => {
    it('S3 un establecimiento sin camas → «Crear camas»', async () => {
      const { harness } = await mount(`site=${SITIO_NORTE.id}`);
      expect(q(harness, 'bb-empty')).not.toBeNull();
      expect(text(harness)).toContain('Crear camas');
    });

    it('S3 de unidad: sin coincidencias con el filtro, ofrece quitarlo', async () => {
      const { harness } = await mount(`site=${SITIO_SANLUCAS.id}&v2=K&unit=${uuid('unit-SANLUCAS-QX')}`);
      expect(q(harness, 'bb-unit-empty')?.textContent).toContain('Ninguna cama coincide con los filtros');
      expect(q(harness, 'bb-unit-empty')?.textContent).toContain('Quitar los filtros');
    });

    it('S5 si la API niega la lectura', async () => {
      failures = { [`GET /sites/${SITIO_SANLUCAS.id}/bed-board`]: 403 };
      const { harness } = await mount();
      expect(text(harness)).toContain('No tiene acceso');
    });

    it('S6 un establecimiento de otro tenant, sin datos', async () => {
      const { harness } = await mount(`site=${SITIO_OTRO_TENANT}`);
      expect(text(harness)).toContain('No encontramos lo que busca');
      expect(text(harness)).not.toContain('Centro de otra organización');
    });

    it('S7 con la lectura vieja: «Dato de hace N min» y un botón para reintentar', async () => {
      sessionStorage.setItem('mock:infra-antiguedad', '4');
      const { harness } = await mount();
      expect(q(harness, 'bb-stale')?.textContent).toContain('Dato de hace 4 min');
      expect(q(harness, 'bb-stale-retry')).not.toBeNull();
      expect(q(harness, 'bed-tile-302-A')).not.toBeNull(); // los datos siguen a la vista
    });

    it('S7 si el sondeo falla: quedan los datos de antes, marcados como atrasados', async () => {
      const { harness } = await mount();
      failures = { [`GET /sites/${SITIO_SANLUCAS.id}/bed-board`]: 0 };
      q(harness, 'bb-refresh')!.click();
      await settle(harness);
      expect(q(harness, 'bb-stale')?.textContent).toContain('No se pudo actualizar');
      expect(q(harness, 'bed-tile-302-A')).not.toBeNull();
      failures = {};
      q(harness, 'bb-stale-retry')!.click();
      await settle(harness);
      expect(q(harness, 'bb-stale')).toBeNull();
    });

    it('S8 sin conexión desde el principio', async () => {
      failures = { [`GET /sites/${SITIO_SANLUCAS.id}/bed-board`]: 0 };
      const { harness } = await mount();
      expect(text(harness)).toContain('Sin conexión');
    });

    it('S9 error inesperado con el código de soporte', async () => {
      failures = { [`GET /sites/${SITIO_SANLUCAS.id}/bed-board`]: 500 };
      const { harness } = await mount();
      expect(text(harness)).toContain('Algo salió mal');
      expect(text(harness)).toContain('req-forzado');
    });
  });

  it('la lista muestra las mismas camas y sin columna de paciente', async () => {
    const { harness } = await mount(`site=${SITIO_SANLUCAS.id}&view=list`);
    const lista = q(harness, 'bb-list');
    expect(lista).not.toBeNull();
    expect(lista!.textContent).toContain('302-A');
    expect(lista!.textContent).not.toMatch(/Paciente/);
  });
});
