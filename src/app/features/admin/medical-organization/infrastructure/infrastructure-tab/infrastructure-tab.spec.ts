import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SITIO_CONSULTORIO, SITIO_OLIVOS, SITIO_SANLUCAS } from '../../../../../core/mock/fixtures/agenda';
import { infraHttp } from '../testing/infra-test-http';
import { InfrastructureTab, type SiteChoice } from './infrastructure-tab';

const SAN_LUCAS: SiteChoice = { id: SITIO_SANLUCAS.id, code: 'SANLUCAS', name: 'Hospital San Lucas' };
const CONSULTORIO: SiteChoice = { id: SITIO_CONSULTORIO.id, code: 'ROJAS', name: 'Consultorio Dra. Rojas' };
const OLIVOS: SiteChoice = { id: SITIO_OLIVOS.id, code: 'OLIVOS-C', name: 'Clínica Los Olivos' };

describe('InfrastructureTab', () => {
  async function montar(
    sites: readonly SiteChoice[],
    usuario: 'superadmin' | 'medica' = 'superadmin',
    opciones: { sinOrganizacion?: boolean } = {},
  ): Promise<{ fixture: ComponentFixture<InfrastructureTab>; peticiones: ReturnType<typeof infraHttp>['peticiones'] }> {
    const http = infraHttp(usuario, opciones);
    TestBed.configureTestingModule({ providers: [...http.providers, provideRouter([])] });
    const fixture = TestBed.createComponent(InfrastructureTab);
    fixture.componentRef.setInput('sites', sites);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, peticiones: http.peticiones };
  }

  const el = (f: ComponentFixture<unknown>): HTMLElement => f.nativeElement as HTMLElement;
  const q = (f: ComponentFixture<unknown>, testId: string): HTMLElement | null => el(f).querySelector(`[data-testid="${testId}"]`);
  const filas = (f: ComponentFixture<unknown>): HTMLElement[] => Array.from(el(f).querySelectorAll('[role="treeitem"]'));

  afterEach(() => {
    sessionStorage.removeItem('mock:infra-antiguedad');
  });

  it('S1: sin organización activa no se pide ningún dato del establecimiento', async () => {
    const { fixture, peticiones } = await montar([SAN_LUCAS], 'superadmin', { sinOrganizacion: true });
    expect(peticiones).toEqual([]);
    expect(el(fixture).textContent).toContain('Verificando permisos');
    // Y no es un esqueleto de contenido: S1 no insinúa que hay algo que ver (S1 ≠ S2).
    expect(el(fixture).querySelector('[role="tree"]')).toBeNull();
  });

  it('pide la estructura del establecimiento y dibuja el árbol con role=tree', async () => {
    const { fixture, peticiones } = await montar([SAN_LUCAS]);
    expect(peticiones.map((p) => `${p.method} ${p.url}`)).toEqual(
      expect.arrayContaining([`GET /sites/${SITIO_SANLUCAS.id}/structure`, 'GET /practice/infrastructure-catalog']),
    );
    expect(el(fixture).querySelector('[role="tree"]')).not.toBeNull();
    const raices = filas(fixture).filter((f) => f.getAttribute('aria-level') === '1');
    expect(raices.map((f) => f.textContent)).toEqual([expect.stringContaining('Edificio A'), expect.stringContaining('Edificio B')]);
  });

  it('con una sola sede no hay selector; con varias sí', async () => {
    const una = await montar([SAN_LUCAS]);
    expect(q(una.fixture, 'infra-sitio')).toBeNull();
    TestBed.resetTestingModule();
    const varias = await montar([SAN_LUCAS, OLIVOS]);
    expect(q(varias.fixture, 'infra-sitio')).not.toBeNull();
  });

  it('sin selección muestra cifras contadas del árbol, no escritas', async () => {
    const { fixture } = await montar([SAN_LUCAS]);
    const resumen = q(fixture, 'infra-resumen')!;
    expect(resumen.textContent).toContain('Quirófanos activos');
    // Dos quirófanos activos y uno planificado (en obra): el planificado no cuenta.
    const quirofanos = Array.from(resumen.querySelectorAll('div')).find((d) => d.textContent?.includes('Quirófanos activos'))!;
    expect(quirofanos.querySelector('dd')!.textContent!.trim()).toBe('2');
  });

  it('elegir un espacio muestra su detalle y el enlace a la ficha', async () => {
    const { fixture } = await montar([SAN_LUCAS]);
    filas(fixture)[0].click();
    fixture.detectChanges();
    expect(q(fixture, 'infra-panel-nombre')!.textContent).toContain('Edificio A');
    const enlace = q(fixture, 'infra-abrir-ficha') as HTMLAnchorElement;
    expect(enlace.getAttribute('href')).toMatch(/\/administration\/medical-organization\/spaces\/.+/);
  });

  it('quien puede escribir ve la barra de acciones', async () => {
    const { fixture } = await montar([SAN_LUCAS]);
    expect(q(fixture, 'infra-agregar')).not.toBeNull();
    expect(q(fixture, 'infra-importar')).not.toBeNull();
  });

  it('S5 reflejado: quien sólo lee ve el árbol completo y ninguna acción de escritura', async () => {
    const { fixture } = await montar([SAN_LUCAS], 'medica');
    expect(filas(fixture).length).toBeGreaterThan(0);
    expect(q(fixture, 'infra-agregar')).toBeNull();
    expect(q(fixture, 'infra-importar')).toBeNull();
    filas(fixture)[0].click();
    fixture.detectChanges();
    expect(q(fixture, 'infra-agregar-dentro')).toBeNull();
    expect(q(fixture, 'infra-abrir-ficha')).not.toBeNull();
  });

  it('S3: un establecimiento sin espacios ofrece agregar el primer edificio o importar', async () => {
    const { fixture } = await montar([CONSULTORIO]);
    expect(q(fixture, 'infra-vacio')).not.toBeNull();
    expect(q(fixture, 'infra-primer-edificio')!.textContent).toContain('Agregar el primer edificio');
    expect(q(fixture, 'infra-importar-vacio')).not.toBeNull();
    expect(el(fixture).querySelector('[role="tree"]')).toBeNull();
  });

  it('S3 sin permiso: dice a quién pedirlo, no ofrece una acción que daría 403', async () => {
    const { fixture } = await montar([CONSULTORIO], 'medica');
    expect(q(fixture, 'infra-primer-edificio')).toBeNull();
    expect(q(fixture, 'infra-vacio-sin-permiso')!.textContent).toContain('administrador');
  });

  it('S7: una lectura vieja se dice, con su antigüedad y «Actualizar»', async () => {
    sessionStorage.setItem('mock:infra-antiguedad', '12');
    const { fixture } = await montar([SAN_LUCAS]);
    const texto = el(fixture).textContent ?? '';
    expect(texto).toContain('pueden estar atrasados');
    expect(q(fixture, 'infra-asof')!.textContent).toContain('hace 12 min');
    expect(filas(fixture).length).toBeGreaterThan(0);
  });

  it('crear dentro de la selección abre el alta con ese padre y lo creado queda insertado y elegido', async () => {
    const { fixture } = await montar([SAN_LUCAS]);
    filas(fixture)[0].click();
    fixture.detectChanges();
    (q(fixture, 'infra-agregar-dentro') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el(fixture).querySelector('app-space-form-dialog')).not.toBeNull();
    expect(el(fixture).querySelector('app-content-dialog')!.textContent).toContain('Dentro de «Edificio A');
  });

  it('un espacio clausurado sólo aparece (tachado) si se pide mostrarlo', async () => {
    const { fixture } = await montar([SAN_LUCAS]);
    const inst = fixture.componentInstance as unknown as {
      vista(): { structure: { spaces: { id: string; childCount: number }[] } };
      expandedIds: { set(v: readonly string[]): void };
      mostrarClausurados: { set(v: boolean): void };
    };
    inst.expandedIds.set(inst.vista().structure.spaces.filter((e) => e.childCount > 0).map((e) => e.id));
    fixture.detectChanges();
    const nombres = (): string[] => filas(fixture).map((f) => f.textContent ?? '');
    expect(nombres().some((n) => n.includes('Habitación 399'))).toBe(false);
    inst.mostrarClausurados.set(true);
    fixture.detectChanges();
    const clausurada = filas(fixture).find((f) => (f.textContent ?? '').includes('Habitación 399'))!;
    expect(clausurada.classList.contains('tree__item--muted')).toBe(true);
  });
});
