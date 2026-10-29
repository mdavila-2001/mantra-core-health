import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { InfrastructureClient } from '../../../../../core/data-access/infrastructure/infrastructure.client';
import { ESPACIO_OTRO_TENANT } from '../../../../../core/mock/fixtures/infrastructure.data';
import { uuid } from '../../../../../core/mock/mock-store';
import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { infraHttp } from '../testing/infra-test-http';
import { SpaceDetail } from './space-detail';

const id = (codigo: string): string => uuid(`infra-sanlucas-${codigo}`);
const QX1 = uuid('operating-room-1');

describe('SpaceDetail (ficha de un espacio)', () => {
  const dialogs = {
    confirm: vi.fn(async () => true),
    confirmWithReason: vi.fn(async (): Promise<string | null> => 'Fumigación del piso'),
  };

  async function montar(
    espacio: string,
    usuario: 'superadmin' | 'medica' = 'superadmin',
  ): Promise<{ fixture: ComponentFixture<SpaceDetail>; peticiones: ReturnType<typeof infraHttp>['peticiones'] }> {
    const http = infraHttp(usuario);
    const params = convertToParamMap({ id: espacio });
    TestBed.configureTestingModule({
      providers: [
        ...http.providers,
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(params), snapshot: { paramMap: params } } },
        { provide: DialogService, useValue: dialogs },
      ],
    });
    const fixture = TestBed.createComponent(SpaceDetail);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, peticiones: http.peticiones };
  }

  const el = (f: ComponentFixture<unknown>): HTMLElement => f.nativeElement as HTMLElement;
  const q = (f: ComponentFixture<unknown>, testId: string): HTMLElement | null => el(f).querySelector(`[data-testid="${testId}"]`);
  const textoDe = (f: ComponentFixture<unknown>, testId: string): string => q(f, testId)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const abrirPestana = async (f: ComponentFixture<unknown>, indice: number): Promise<void> => {
    (el(f).querySelectorAll('[role="tab"]')[indice] as HTMLElement).click();
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
  };
  const accion = async (f: ComponentFixture<SpaceDetail>, codigo: string): Promise<void> => {
    (f.componentInstance as unknown as { alElegirAccion(c: string): void }).alElegirAccion(codigo);
    await f.whenStable();
    await new Promise((r) => setTimeout(r));
    f.detectChanges();
  };

  beforeEach(() => {
    dialogs.confirm.mockClear().mockResolvedValue(true);
    dialogs.confirmWithReason.mockClear().mockResolvedValue('Fumigación del piso');
  });

  it('es UNA tarjeta con cinco pestañas, centrada y sin columna lateral (regla del 09/09/2026)', async () => {
    const { fixture } = await montar(id('HAB-301'));
    expect(el(fixture).querySelectorAll('app-card')).toHaveLength(1);
    const rotulos = Array.from(el(fixture).querySelectorAll('[role="tab"]')).map((t) => t.textContent!.trim());
    expect(rotulos).toEqual(['General', 'Atributos técnicos', 'Unidades', 'Hijos', 'Historial']);
    const ficha = q(fixture, 'ficha-espacio')!;
    expect(ficha.classList.contains('ficha-espacio')).toBe(true);
    expect(el(fixture).querySelector('aside')).toBeNull();
  });

  it('General: nombre, ubicación con enlaces y recuentos derivados', async () => {
    const { fixture } = await montar(id('HAB-301'));
    expect(textoDe(fixture, 'ficha-general')).toContain('HAB-301');
    expect(textoDe(fixture, 'ficha-general')).toContain('Edificio A');
    expect(textoDe(fixture, 'ficha-derivados')).toMatch(/Camas\s*2/);
    expect(textoDe(fixture, 'ficha-estado')).toBe('Activo');
  });

  it('Atributos técnicos: lo cargado se muestra y lo que no, como «—»', async () => {
    const { fixture } = await montar(QX1);
    await abrirPestana(fixture, 1);
    const t = textoDe(fixture, 'ficha-atributos');
    expect(t).toContain('Restringida');
    expect(t).toContain('Positiva');
    expect(t).toMatch(/Preparación\s*20 min/);
    expect(t).toMatch(/Categoría de cama\s*—/);
  });

  it('Unidades: la propietaria y su rol', async () => {
    const { fixture } = await montar(QX1);
    await abrirPestana(fixture, 2);
    expect(textoDe(fixture, 'ficha-unidades')).toContain('Quirófanos');
    expect(textoDe(fixture, 'ficha-unidades')).toContain('Propietaria');
  });

  it('Hijos: la lista enlaza a la ficha de cada uno', async () => {
    const { fixture } = await montar(id('HAB-301'));
    await abrirPestana(fixture, 3);
    const enlaces = Array.from(q(fixture, 'ficha-hijos')!.querySelectorAll('a')).map((a) => a.textContent!.trim());
    expect(enlaces).toEqual(['301-A', '301-B']);
  });

  it('Hijos: una cama es el último nivel y lo dice', async () => {
    const { fixture } = await montar(id('301-A'));
    await abrirPestana(fixture, 3);
    expect(textoDe(fixture, 'ficha-hijos-vacio')).toContain('último nivel');
    expect(q(fixture, 'ficha-agregar-hijo')).toBeNull();
  });

  it('Historial: se pide al abrir la pestaña y muestra la revisión 1', async () => {
    const { fixture, peticiones } = await montar(id('HAB-301'));
    expect(peticiones.some((p) => p.url.endsWith('/history'))).toBe(false);
    await abrirPestana(fixture, 4);
    expect(peticiones.some((p) => p.url.endsWith('/history'))).toBe(true);
    expect(textoDe(fixture, 'ficha-historial')).toContain('Revisión 1');
  });

  it('S6: un espacio de otro tenant no revela nada', async () => {
    const { fixture } = await montar(ESPACIO_OTRO_TENANT);
    expect(el(fixture).textContent).toContain('No encontramos lo que busca');
    expect(q(fixture, 'ficha-espacio')).toBeNull();
    expect(el(fixture).textContent).not.toContain('otro');
  });

  it('quien sólo lee no tiene acciones ni historial; la API respondería 403 si lo intentara', async () => {
    const { fixture } = await montar(id('HAB-301'), 'medica');
    const instancia = fixture.componentInstance as unknown as { acciones(): unknown[] };
    expect(instancia.acciones()).toEqual([]);
    await abrirPestana(fixture, 4);
    expect(q(fixture, 'ficha-historial-sin-permiso')).not.toBeNull();
  });

  it('clausurar con bloqueos: abre el diálogo con la próxima acción de cada uno y NO pide el motivo', async () => {
    const { fixture } = await montar(QX1);
    await accion(fixture, 'retire');
    const dialogo = q(fixture, 'bloqueos-dialogo')!;
    expect(dialogo.textContent).toContain('Cirugías programadas');
    expect(dialogo.textContent).toContain('Reprogramar');
    expect(dialogs.confirmWithReason).not.toHaveBeenCalled();
  });

  it('clausurar sin bloqueos pide el motivo con confirmWithReason y manda If-Match', async () => {
    dialogs.confirmWithReason.mockResolvedValue('Baja definitiva del consultorio');
    const { fixture, peticiones } = await montar(id('CONS-B01'));
    await accion(fixture, 'retire');
    expect(peticiones.some((p) => p.url.endsWith('/retire-check'))).toBe(true);
    expect(q(fixture, 'bloqueos-dialogo')).toBeNull();
    expect(dialogs.confirmWithReason).toHaveBeenCalledTimes(1);
    const envio = peticiones.find((p) => p.url.endsWith('/lifecycle'))!;
    expect(envio.body).toEqual({ action: 'retire', reason: 'Baja definitiva del consultorio' });
    expect(envio.ifMatch).toBe('1');
    expect(textoDe(fixture, 'ficha-estado')).toBe('Clausurado');
    // Clausurado es solo lectura: la ficha deja de ofrecer acciones.
    expect((fixture.componentInstance as unknown as { acciones(): unknown[] }).acciones()).toEqual([]);
  });

  it('un espacio ya clausurado no ofrece acciones', async () => {
    const { fixture } = await montar(id('HAB-399'));
    expect((fixture.componentInstance as unknown as { acciones(): unknown[] }).acciones()).toEqual([]);
  });

  it('suspender pide un motivo, lo manda con If-Match y la ficha pasa a «Suspendido»', async () => {
    const { fixture, peticiones } = await montar(id('CONS-102'));
    await accion(fixture, 'suspend');
    expect(dialogs.confirmWithReason).toHaveBeenCalledTimes(1);
    const envio = peticiones.find((p) => p.url.endsWith('/lifecycle'))!;
    expect(envio.body).toEqual({ action: 'suspend', reason: 'Fumigación del piso' });
    expect(envio.status).toBe(200);
    expect(textoDe(fixture, 'ficha-estado')).toBe('Suspendido');
  });

  it('el motivo vacío o cancelado no manda nada', async () => {
    dialogs.confirmWithReason.mockResolvedValue(null);
    const { fixture, peticiones } = await montar(id('CONS-101'));
    await accion(fixture, 'suspend');
    expect(peticiones.some((p) => p.url.endsWith('/lifecycle'))).toBe(false);
  });

  it('activar un hijo con el padre suspendido: S4 con la próxima acción «abrir el padre»', async () => {
    const { fixture } = await montar(id('QX-3'));
    // El piso 2 se suspende por detrás, como lo haría otra persona.
    const piso = id('ED-A-P2');
    const api = TestBed.inject(InfrastructureClient);
    const actual = await new Promise<{ rowVersion: number }>((r) => api.getCareSpace(piso).subscribe(r));
    await new Promise((r) => api.changeLifecycle(piso, actual.rowVersion, { action: 'suspend', reason: 'Obra' }).subscribe(r));
    await accion(fixture, 'activate');
    expect(textoDe(fixture, 'infra-issue-alert')).toContain('no está activo');
    expect(textoDe(fixture, 'ficha-salida-padre')).toContain('abrir «Piso 2');
    expect(textoDe(fixture, 'ficha-estado')).toBe('Planificado');
  });
});
