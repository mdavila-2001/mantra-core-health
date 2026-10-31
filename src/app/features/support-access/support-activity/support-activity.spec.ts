import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { SupportActivityEntry, SupportActivityPage, SupportActivityQuery } from '../../../core/data-access/support-access/support-access.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { CsvExportService } from '../../../shared/utils/csv-export/csv-export';
import { SupportActivity } from './support-activity';

function entrada(i: number, userId: string, personName: string, action: string, doctor?: string): SupportActivityEntry {
  return {
    id: `e${i}`,
    userId,
    personName,
    action,
    auditAction: action.toUpperCase(),
    entity: 'booking',
    summary: `Detalle ${i}`,
    success: true,
    result: 'SUCCESS',
    createdAt: `2026-10-${String(20 + (i % 10)).padStart(2, '0')}T${String(12 + (i % 8)).padStart(2, '0')}:00:00Z`,
    ...(doctor === undefined ? {} : { practitionerName: doctor }),
  };
}

const DATOS: SupportActivityEntry[] = [
  ...Array.from({ length: 12 }, (_, i) => entrada(i, 'u-ana', 'Ana Gutiérrez', 'schedule.create', 'Dr. Pérez')),
  entrada(20, 'u-lucia', 'Lucía Paz', 'schedule.check_in', 'Dra. Méndez'),
  { ...entrada(21, 'u-marcos', 'Marcos Ribera', 'schedule.cancel', 'Dra. Antelo'), success: false, result: 'FAILURE' },
];

/** Lo que haría la API: filtra por persona, doctor y acción, y entrega por páginas con cursor. */
function leerComoLaApi(query: SupportActivityQuery, base: readonly SupportActivityEntry[], porPagina = 200): SupportActivityPage {
  const filtradas = base.filter(
    (e) => (query.userId === undefined || e.userId === query.userId) && (query.doctor === undefined || e.practitionerName === query.doctor) && (query.action === undefined || e.action === query.action),
  );
  const desde = query.cursor === undefined ? 0 : Number(query.cursor);
  const pagina = filtradas.slice(desde, desde + porPagina);
  return { items: pagina, count: pagina.length, nextCursor: desde + porPagina < filtradas.length ? String(desde + porPagina) : null };
}

describe('SupportActivity', () => {
  let fixture: ComponentFixture<SupportActivity>;
  let download: ReturnType<typeof vi.fn>;
  let getOrganizationActivity: ReturnType<typeof vi.fn>;
  let getMyTeamActivity: ReturnType<typeof vi.fn>;
  let getMyActivity: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const refrescar = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  async function abrir(path: string, query: Record<string, string> = {}, porPagina = 200): Promise<void> {
    download = vi.fn();
    getOrganizationActivity = vi.fn((q: SupportActivityQuery) => of(leerComoLaApi(q, DATOS, porPagina)));
    getMyTeamActivity = vi.fn((q: SupportActivityQuery) => of(leerComoLaApi(q, DATOS.filter((e) => e.practitionerName === 'Dr. Pérez'), porPagina)));
    getMyActivity = vi.fn((q: SupportActivityQuery) => of(leerComoLaApi(q, DATOS.filter((e) => e.userId === 'u-ana'), porPagina)));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SupportAccessClient, useValue: { getOrganizationActivity, getMyTeamActivity, getMyActivity } },
        { provide: CsvExportService, useValue: { download } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { routeConfig: { path }, queryParamMap: convertToParamMap(query) }, queryParamMap: of(convertToParamMap(query)), queryParams: of(query) } },
      ],
    });
    fixture = TestBed.createComponent(SupportActivity);
    fixture.detectChanges();
    await refrescar();
  }

  const filas = (): HTMLElement[] => [...host().querySelectorAll('[data-testid="tabla-fila"]')] as HTMLElement[];

  it('la de la organización lee la bitácora de la organización y muestra persona, qué hizo y doctor, sin paciente', async () => {
    await abrir('administration/support-activity');
    expect(getOrganizationActivity).toHaveBeenCalledTimes(1);
    expect(host().querySelector('h1')!.textContent).toContain('Actividad del equipo de apoyo');
    expect(byId('actividad-resumen')!.textContent).toContain('14 acciones del equipo');
    expect(host().textContent).toContain('Persona');
    expect(host().textContent).not.toContain('Paciente');
    expect(filas()).toHaveLength(10);
  });

  it('la del doctor lee la de su equipo y no muestra la columna de doctor', async () => {
    await abrir('my-team/activity');
    expect(getMyTeamActivity).toHaveBeenCalled();
    expect(host().querySelector('h1')!.textContent).toContain('Actividad de mi equipo');
    expect([...host().querySelectorAll('thead th')].map((t) => t.textContent!.trim())).not.toContain('Doctor');
    expect(byId('actividad-resumen')!.textContent).toContain('12 acciones sobre mi agenda');
  });

  it('«Mi actividad» lee lo propio y no muestra la columna de persona', async () => {
    await abrir('my-support/activity');
    expect(getMyActivity).toHaveBeenCalled();
    expect(host().querySelector('h1')!.textContent).toContain('Mi actividad');
    expect([...host().querySelectorAll('thead th')].map((t) => t.textContent!.trim())).not.toContain('Persona');
  });

  it('los filtros de la URL se le piden a la API con sus nombres: persona por id, doctor, acción y fechas', async () => {
    await abrir('administration/support-activity', { persona: 'u-lucia', doctor: 'Dra. Méndez', accion: 'schedule.check_in', desde: '2026-10-20', hasta: '2026-10-30' });
    expect(getOrganizationActivity).toHaveBeenCalledWith({ userId: 'u-lucia', doctor: 'Dra. Méndez', action: 'schedule.check_in', from: '2026-10-20', to: '2026-10-30', limit: 200 });
    expect(byId('actividad-resumen')!.textContent).toContain('1 acción');
    expect(filas()).toHaveLength(1);
    expect(filas()[0]!.textContent).toContain('Registrar la llegada del paciente');
  });

  it('un asiento que no se pudo hacer lo dice', async () => {
    await abrir('administration/support-activity', { persona: 'u-marcos' });
    expect(byId('actividad-fallo')!.textContent).toContain('No se pudo');
  });

  it('la búsqueda es local: mira el detalle de lo cargado y no vuelve a pedir', async () => {
    await abrir('administration/support-activity', { q: 'Detalle 21' });
    expect(getOrganizationActivity).toHaveBeenCalledTimes(1);
    expect(filas()).toHaveLength(1);
    expect(filas()[0]!.textContent).toContain('Marcos Ribera');
  });

  it('con más actividad que una página ofrece «Cargar más» y la suma a lo que ya se ve', async () => {
    await abrir('administration/support-activity', {}, 10);
    expect(byId('actividad-resumen')!.textContent).toContain('10 acciones del equipo cargadas hasta ahora');
    (byId('actividad-cargar-mas') as HTMLElement).click();
    await refrescar();
    expect(getOrganizationActivity).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: '10' }));
    expect(byId('actividad-resumen')!.textContent).toContain('14 acciones');
    expect(byId('actividad-cargar-mas')).toBeNull();
  });

  it('pagina lo cargado', async () => {
    await abrir('administration/support-activity');
    expect(byId('actividad-paginacion')).not.toBeNull();
    expect(filas()).toHaveLength(10);
  });

  it('sin coincidencias lo dice y no deja exportar', async () => {
    await abrir('administration/support-activity', { persona: 'u-nadie' });
    expect(host().textContent).toContain('Ninguna actividad coincide con los filtros.');
    expect(byId('actividad-exportar')!.getAttribute('aria-disabled')).toBe('true');
  });

  it('exportar manda a CSV todas las filas que cumplen los filtros, no solo la página', async () => {
    await abrir('administration/support-activity', { persona: 'u-ana' });
    expect(filas()).toHaveLength(10);
    (byId('actividad-exportar') as HTMLElement).click();
    expect(download).toHaveBeenCalledTimes(1);
    const [exportadas, columnas, nombre] = download.mock.calls[0] as [SupportActivityEntry[], { header: string }[], string];
    expect(exportadas).toHaveLength(12);
    expect(exportadas.every((e) => e.personName === 'Ana Gutiérrez')).toBe(true);
    expect(columnas.map((c) => c.header)).toEqual(['Fecha y hora', 'Persona', 'Acción', 'Detalle', 'Doctor', 'Resultado', 'Código']);
    expect(nombre).toMatch(/^actividad-equipo-apoyo-\d{4}-\d{2}-\d{2}$/);
  });

  it('si faltan páginas por cargar, exportar las pide todas antes de entregar el archivo', async () => {
    await abrir('administration/support-activity', {}, 5);
    expect(getOrganizationActivity).toHaveBeenCalledTimes(1);
    (byId('actividad-exportar') as HTMLElement).click();
    await refrescar();
    expect(getOrganizationActivity).toHaveBeenCalledTimes(1 + 3);
    expect(download).toHaveBeenCalledTimes(1);
    expect((download.mock.calls[0] as [SupportActivityEntry[]])[0]).toHaveLength(14);
  });

  it('cambiar una fecha escribe el filtro en la URL', async () => {
    await abrir('administration/support-activity');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    (fixture.componentInstance as unknown as { cambiarFecha(c: string, v: string): void }).cambiarFecha('desde', '2026-10-29');
    expect(navegar).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { desde: '2026-10-29' }, queryParamsHandling: 'merge' }));
  });
});
