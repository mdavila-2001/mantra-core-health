import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { resetOps } from '../../../core/mock/handlers/infrastructure-ops.store';
import { uuid } from '../../../core/mock/mock-store';
import { SITIO_SANLUCAS } from '../../../core/mock/fixtures/agenda';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { opsHttp } from '../testing/ops-test-http';
import { SpaceOpsTab } from './space-ops-tab';

describe('SpaceOpsTab (pestaña «Operación» de la ficha)', () => {
  async function mount(code: string, form: string, fn: string, persona = 'nurse') {
    sessionStorage.setItem('mock:infra-ops-persona', persona);
    const http = opsHttp();
    TestBed.configureTestingModule({
      providers: [...http.providers, provideRouter([]), { provide: DialogService, useValue: { confirm: vi.fn(async () => true), confirmWithReason: vi.fn(async () => 'x') } }],
    });
    const fixture = TestBed.createComponent(SpaceOpsTab);
    fixture.componentRef.setInput('spaceId', uuid(`infra-sanlucas-${code}`));
    fixture.componentRef.setInput('siteId', SITIO_SANLUCAS.id);
    fixture.componentRef.setInput('formCode', form);
    fixture.componentRef.setInput('functionCode', fn);
    for (let i = 0; i < 4; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r));
    }
    fixture.detectChanges();
    return { fixture, requests: http.requests, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('mock:infra-ops-drift', 'off');
    resetOps();
  });

  it('una cama muestra sus ejes, el historial abierto y el enlace al tablero', async () => {
    const { el } = await mount('312-A', 'LOC_FORM_BED', 'SPACE_FN_BED_STANDARD');
    expect(el.querySelector('[data-testid="space-ops-tab"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="axis-availability"]')?.textContent).toContain('Mantenimiento');
    expect(el.querySelector('[data-testid="axis-availability"]')?.textContent).toMatch(/hasta \d\d\/\d\d \d\d:\d\d/);
    expect(el.querySelector('[data-testid="cell-blocks"]')?.textContent).toContain('OT-2026-0457');
    expect(el.querySelector('details')?.hasAttribute('open')).toBe(true);
    expect(el.querySelector('[data-testid="status-history-list"] li')).not.toBeNull();
    expect(el.querySelector('[data-testid="ops-open-board"]')?.getAttribute('href')).toContain('/inpatient/bed-board');
  });

  it('un espacio sin estado operativo lo dice y no hace ninguna petición', async () => {
    const { el, requests } = await mount('HAB-301', 'LOC_FORM_ROOM', 'SPACE_FN_INPATIENT_ROOM');
    expect(el.querySelector('[data-testid="space-ops-none"]')).not.toBeNull();
    expect(requests.filter((r) => r.url.includes('operational-state'))).toHaveLength(0);
  });

  it('para mantenimiento ofrece terminar el mantenimiento', async () => {
    const { el } = await mount('312-A', 'LOC_FORM_BED', 'SPACE_FN_BED_STANDARD', 'maintenance');
    expect(el.querySelector('[data-testid="action-end-maintenance"]')).not.toBeNull();
  });
});
