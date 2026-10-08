import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';

import { CredentialsPanel } from './credentials-panel';
import { FilterBar } from '../../../../../../shared/components/organisms/filter-bar/filter-bar';
import { StatusSeal } from '../../../../../../shared/components/organisms/status-seal/status-seal';
import type {
  EspecialidadVisible,
  FormacionVisible,
  IdiomaVisible,
  MatriculaVisible,
  RespaldoCredencial,
} from '../practitioner-profile-view.types';

const MATRICULA: MatriculaVisible = {
  id: 'lic-1',
  jurisdiccion: 'Nacional',
  numero: 'LIC-3',
  autoridad: 'Colegio Médico',
  estado: 'Verificada',
  sello: 'approved',
  hasta: new Date(2030, 5, 30),
};

const ESPECIALIDAD: EspecialidadVisible = {
  id: 'esp-1',
  nombre: 'Cardiología',
  certificada: true,
  alcance: '',
  desde: new Date(2015, 1, 1),
  hasta: null,
  estado: 'Pendiente',
  sello: 'in-review',
};

const FORMACION: FormacionVisible = {
  id: 'cr-1',
  tipo: 'Título de grado',
  numero: 'TIT-9',
  institucion: 'UMSA',
  desde: new Date(2010, 10, 1),
  hasta: null,
  estado: 'Verificada',
  sello: 'approved',
  vencida: false,
  fuenteVerificacion: 'https://registro.test/tit-9',
};

const IDIOMA: IdiomaVisible = {
  id: 'idi-1',
  nombre: 'Español',
  nivel: 'Nativo',
  interpreta: true,
};

/**
 * La pestaña «Credenciales» rehecha el 19/09/2026: rejilla de tarjetas con
 * ícono por clase y un filtro en vez de repetir la lista.
 *
 * El toast que reemplazó a la caja de ayuda lo lanza la ficha, no este panel
 * —acá se instanciaría con la pestaña cerrada—, y tiene su prueba allá.
 */
describe('CredentialsPanel', () => {
  function montar(
    over: {
      matriculas?: readonly MatriculaVisible[];
      especialidades?: readonly EspecialidadVisible[];
      formacion?: readonly FormacionVisible[];
      idiomas?: readonly IdiomaVisible[];
      retirables?: ReadonlySet<string>;
      permiteDescarga?: boolean;
      descargando?: string | null;
    } = {},
  ) {
    TestBed.configureTestingModule({ imports: [CredentialsPanel], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(CredentialsPanel);
    fixture.componentRef.setInput('matriculas', over.matriculas ?? [MATRICULA]);
    fixture.componentRef.setInput('especialidades', over.especialidades ?? [ESPECIALIDAD]);
    fixture.componentRef.setInput('formacion', over.formacion ?? [FORMACION]);
    fixture.componentRef.setInput('idiomas', over.idiomas ?? [IDIOMA]);
    if (over.retirables !== undefined) {
      fixture.componentRef.setInput('retirables', over.retirables);
    }
    fixture.componentRef.setInput('permiteDescarga', over.permiteDescarga ?? false);
    fixture.componentRef.setInput('descargando', over.descargando ?? null);
    fixture.detectChanges();
    return fixture;
  }

  function tarjetas(fixture: ReturnType<typeof montar>): readonly string[] {
    return [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="credencial"]'),
    ].map((tarjeta) => tarjeta.getAttribute('data-kind') ?? '');
  }

  it('cada credencial es UNA tarjeta, con la clase que la identifica', () => {
    // Antes cada una aparecía dos veces: en la lista de su clase y otra vez en
    // la agrupación «Verificado»/«Declarado».
    const fixture = montar();

    expect(tarjetas(fixture)).toEqual(['license', 'specialty', 'education', 'language']);
    const texto = ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
    expect(texto.match(/Matrícula N\.º LIC-3/g) ?? []).toHaveLength(1);
  });

  it('la tarjeta de una especialidad no dice si es la principal (D-01)', () => {
    const fixture = montar({ matriculas: [], formacion: [], idiomas: [] });

    const tarjeta = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="credencial"][data-kind="specialty"]',
    );
    const texto = (tarjeta?.textContent ?? '').replace(/\s+/g, ' ');
    expect(texto).toContain('Cardiología');
    expect(texto).toContain('Certificada por el consejo');
    expect(texto).not.toMatch(/principal/i);
  });

  it('el filtro corta el mismo conjunto, no repite la lista', () => {
    const fixture = montar();
    const raiz = fixture.nativeElement as HTMLElement;

    raiz
      .querySelector<HTMLButtonElement>('[data-testid="credenciales-filtro-verificadas"]')!
      .click();
    fixture.detectChanges();
    // Verificadas: la matrícula y el título aprobados. La
    // especialidad pendiente y el idioma —que no tramita nada— quedan afuera.
    expect(tarjetas(fixture)).toEqual(['license', 'education']);

    raiz
      .querySelector<HTMLButtonElement>('[data-testid="credenciales-filtro-declaradas"]')!
      .click();
    fixture.detectChanges();
    expect(tarjetas(fixture)).toEqual(['specialty', 'language']);
  });

  it.each([3, 6])('el filtro de %i títulos distingue aprobación de fuente y vencimiento', (count) => {
    const studies: FormacionVisible[] = [
      { ...FORMACION, id: 'rejected', tipo: 'Título rechazado', sello: 'rejected', estado: 'Rechazado', approved: false },
      { ...FORMACION, id: 'unknown', tipo: 'Título sin decisión', sello: 'unknown', estado: 'Sin determinar' },
      { ...FORMACION, id: 'expired', tipo: 'Título aprobado vencido', sello: 'expired', estado: 'Vencido', hasta: new Date('2001-01-01'), vencida: true, approved: true },
      ...Array.from({ length: count - 3 }, (_, index): FormacionVisible => ({
        ...FORMACION, id: `pending-${index}`, tipo: `Título pendiente ${index}`,
        sello: 'pending', estado: 'Pendiente', fuenteVerificacion: undefined,
      })),
    ];
    const fixture = montar({ matriculas: [], especialidades: [], idiomas: [], formacion: studies });
    const root = fixture.nativeElement as HTMLElement;
    if (count === 3) {
      // La tarjeta rechazada sigue mostrando la fuente, sin presentarla como aprobación.
      const card = Array.from(root.querySelectorAll('[data-testid="credencial"]'))
        .find((item) => item.textContent?.includes('Título rechazado'));
      expect(card).toBeDefined();
      expect(card?.textContent).toContain('Fuente de revisión:');
      expect(card?.textContent).not.toContain('Verificada contra');
    }

    root.querySelector<HTMLButtonElement>('[data-testid="credenciales-filtro-verificadas"]')!.click();
    fixture.detectChanges();
    expect(root.textContent).toContain('Título aprobado vencido');
    expect(root.textContent).not.toContain('Título rechazado');
    expect(root.textContent).not.toContain('Título sin decisión');
    expect(root.querySelector('app-status-seal')?.textContent).toContain('Vencido');

    root.querySelector<HTMLButtonElement>('[data-testid="credenciales-filtro-declaradas"]')!.click();
    fixture.detectChanges();
    expect(root.textContent).toContain('Título rechazado');
    expect(root.textContent).toContain('Título sin decisión');
    expect(root.textContent).not.toContain('Título aprobado vencido');
  });

  function bloques(fixture: ReturnType<typeof montar>): readonly string[] {
    return [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll(
        '[data-testid="credenciales-grupo"]',
      ),
    ].map((bloque) => bloque.querySelector('h3')?.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  it('cada clase es su propio bloque, con su nombre y cuántas tiene, en orden fijo', () => {
    // Hasta el 24/09/2026 las cuatro clases iban entreveradas en UNA rejilla y
    // sólo las distinguía un rótulo chico en cada tarjeta: «completamente
    // inentendible», dijo el propietario.
    const fixture = montar({ especialidades: [ESPECIALIDAD, { ...ESPECIALIDAD, id: 'esp-2' }] });

    expect(bloques(fixture)).toEqual([
      'Matrículas 1',
      'Especialidades 2',
      'Títulos y formación 1',
      'Idiomas 1',
    ]);
    const especialidades = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="credenciales-grupo"][data-kind="specialty"]',
    );
    expect(
      [...especialidades!.querySelectorAll('[data-testid="credencial"]')].map((t) =>
        t.getAttribute('data-kind'),
      ),
    ).toEqual(['specialty', 'specialty']);
  });

  it('el filtro no deja bloques vacíos colgando', () => {
    const fixture = montar();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="credenciales-filtro-verificadas"]')!
      .click();
    fixture.detectChanges();

    expect(bloques(fixture)).toEqual(['Matrículas 1', 'Títulos y formación 1']);
  });

  it('«Retirar» sólo aparece en el título que la ficha marcó, y avisa con el título', () => {
    const pendiente: FormacionVisible = { ...FORMACION, id: 'cr-2', sello: 'in-review' };
    const fixture = montar({ formacion: [FORMACION, pendiente], retirables: new Set(['cr-2']) });
    const pedidos: FormacionVisible[] = [];
    fixture.componentInstance.retirar.subscribe((estudio) => pedidos.push(estudio));
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('[data-testid="formacion-retirar-cr-1"]')).toBeNull();
    raiz.querySelector<HTMLButtonElement>('[data-testid="formacion-retirar-cr-2"]')!.click();

    expect(pedidos).toEqual([pendiente]);
  });

  it('un idioma no lleva sello: no tramita nada', () => {
    const fixture = montar({ matriculas: [], especialidades: [], formacion: [] });
    const tarjeta = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="credencial"]',
    );

    expect(tarjeta?.getAttribute('data-kind')).toBe('language');
    expect(tarjeta?.querySelector('app-status-seal')).toBeNull();
  });

  it('sin nada cargado explica qué falta, no una caja vacía', () => {
    const fixture = montar({ matriculas: [], especialidades: [], formacion: [], idiomas: [] });

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.credenciales__vacio')?.textContent,
    ).toContain('Todavía no cargó credenciales');
  });

  function formaciones(cantidad: number): readonly FormacionVisible[] {
    return Array.from({ length: cantidad }, (_, indice) => ({
      ...FORMACION,
      id: `formacion-${indice + 1}`,
      tipo: `Diploma ${indice + 1}`,
      numero: `TIT-${indice + 1}`,
    }));
  }

  function grupo(fixture: ReturnType<typeof montar>, clase: string): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      `[data-testid="credenciales-grupo"][data-kind="${clase}"]`,
    )!;
  }

  function filas(bloque: HTMLElement): readonly string[] {
    return [...bloque.querySelectorAll('[data-testid="tabla-fila"]')].map((fila) =>
      fila.querySelector('[data-testid="credencial-titulo"]')?.textContent?.trim() ?? '',
    );
  }

  function buscar(fixture: ReturnType<typeof montar>, clase: string, termino: string): void {
    const bloque = fixture.debugElement.query(
      By.css(`[data-testid="credenciales-grupo"][data-kind="${clase}"]`),
    );
    const barra = bloque.query(By.directive(FilterBar)).componentInstance as FilterBar;
    expect(barra.searchInUrl()).toBe(false);
    barra.searchChanged.emit(termino);
    fixture.detectChanges();
  }

  it('cinco registros conservan tarjetas y seis usan tabla en su propio grupo', () => {
    const fixture = montar({ formacion: formaciones(5) });
    expect(grupo(fixture, 'education').querySelectorAll('[data-testid="credencial"]')).toHaveLength(5);
    expect(grupo(fixture, 'education').querySelector('app-data-table')).toBeNull();

    fixture.componentRef.setInput('formacion', formaciones(6));
    fixture.detectChanges();

    expect(filas(grupo(fixture, 'education'))).toHaveLength(6);
    expect(grupo(fixture, 'education').querySelectorAll('[data-testid="credencial"]')).toHaveLength(0);
    expect(grupo(fixture, 'license').querySelectorAll('[data-testid="credencial"]')).toHaveLength(1);
  });

  it('doce registros se recorren en páginas de diez independientes por grupo', () => {
    const matriculas = Array.from({ length: 12 }, (_, indice) => ({
      ...MATRICULA, id: `lic-${indice}`, jurisdiccion: `Matrícula ${indice + 1}`,
    }));
    const fixture = montar({ formacion: formaciones(12), matriculas });
    const formacion = grupo(fixture, 'education');
    expect(filas(formacion)).toHaveLength(10);
    expect(filas(grupo(fixture, 'license'))).toHaveLength(10);

    formacion.querySelector<HTMLButtonElement>('[aria-label="Página siguiente"]')!.click();
    fixture.detectChanges();

    expect(filas(formacion)).toEqual(['Diploma 11', 'Diploma 12']);
    expect(filas(grupo(fixture, 'license'))).toHaveLength(10);
    expect(formacion.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('2');
  });

  it('al reducir la colección a cinco no queda una búsqueda oculta filtrando tarjetas', () => {
    const fixture = montar({ formacion: formaciones(6) });
    buscar(fixture, 'education', 'Diploma 6');
    expect(filas(grupo(fixture, 'education'))).toEqual(['Diploma 6']);

    fixture.componentRef.setInput('formacion', formaciones(5));
    fixture.detectChanges();

    expect(grupo(fixture, 'education').querySelector('app-filter-bar')).toBeNull();
    expect(grupo(fixture, 'education').querySelectorAll('[data-testid="credencial"]')).toHaveLength(5);
  });

  it('buscar normaliza texto, vuelve a la primera página y conserva tabla aun sin resultados', () => {
    const datos = formaciones(12).map((fila, indice) => ({
      ...fila, institucion: indice === 0 ? 'Clínica Académica' : 'Universidad',
    }));
    const fixture = montar({ formacion: datos });
    const formacion = grupo(fixture, 'education');
    formacion.querySelector<HTMLButtonElement>('[aria-label="Página siguiente"]')!.click();
    fixture.detectChanges();
    const url = TestBed.inject(Router).url;

    buscar(fixture, 'education', 'CLINICA ACADEMICA');

    expect(filas(formacion)).toEqual(['Diploma 1']);
    expect(formacion.querySelector('app-data-table')).not.toBeNull();
    expect(formacion.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('1');
    expect(TestBed.inject(Router).url).toBe(url);

    buscar(fixture, 'education', 'No coincide');
    expect(formacion.querySelector('app-data-table')).not.toBeNull();
    expect(formacion.querySelector('[role="status"]')?.textContent).toContain('Ninguna credencial coincide');

    buscar(fixture, 'education', '');
    expect(filas(formacion)).toHaveLength(10);
  });

  it('cambiar el filtro de estado reinicia páginas sin volver de tabla a tarjeta', () => {
    const fixture = montar({ formacion: formaciones(12) });
    const formacion = grupo(fixture, 'education');
    formacion.querySelector<HTMLButtonElement>('[aria-label="Página siguiente"]')!.click();
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="credenciales-filtro-declaradas"]')!.click();
    fixture.detectChanges();
    expect(formacion.querySelector('app-data-table')).not.toBeNull();
    expect(filas(formacion)).toHaveLength(0);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="credenciales-filtro-todas"]')!.click();
    fixture.detectChanges();
    expect(filas(formacion)[0]).toBe('Diploma 1');
  });

  it('la tabla conserva los sellos aprobados, pendientes, rechazados y desconocidos', () => {
    const sellos = ['approved', 'pending', 'rejected', 'expired', 'unknown', 'in-review'] as const;
    const fixture = montar({
      matriculas: [], especialidades: [], idiomas: [],
      formacion: formaciones(6).map((fila, indice) => ({
        ...fila, sello: sellos[indice]!, estado: `Estado ${indice + 1}`,
      })),
    });
    const dibujados = fixture.debugElement.queryAll(By.directive(StatusSeal)).map((sello) =>
      (sello.componentInstance as StatusSeal).variant(),
    );
    expect(dibujados).toEqual(sellos);
    expect(grupo(fixture, 'education').textContent).toContain('Estado 3');
  });

  it('el título y el estado completo comparten una celda principal sin ocultar la verificación', () => {
    const fixture = montar({
      matriculas: [], especialidades: [], idiomas: [],
      formacion: formaciones(6).map((study): FormacionVisible => ({
        ...study, tipo: 'Título universitario', sello: 'pending',
        estado: 'Credencial pendiente de verificación',
      })),
    });
    const group = grupo(fixture, 'education');
    const headings = Array.from(group.querySelectorAll('thead th'))
      .filter((cell) => !cell.classList.contains('data-table__secondary') &&
        !cell.classList.contains('data-table__detail-toggle-cell'));
    expect(headings.map((cell) => cell.textContent?.trim())).toEqual(['Credencial y estado']);
    for (const row of group.querySelectorAll('[data-testid="tabla-fila"]')) {
      const primaryCell = row.querySelector('td:not(.data-table__secondary):not(.data-table__detail-toggle-cell)');
      expect(primaryCell?.querySelector('strong')?.textContent).toBe('Título universitario');
      expect(primaryCell?.querySelector('app-status-seal')?.textContent).toContain('Credencial pendiente de verificación');
      expect(row.querySelectorAll('app-status-seal')).toHaveLength(1);
    }
  });

  it('la descarga exige permiso y respaldo, emite contexto y no fuerza una extensión', () => {
    const fixture = montar({ formacion: [{ ...FORMACION, fileId: 'archivo-diploma' }] });
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-testid="credencial-descargar-cr-1"]')).toBeNull();
    fixture.componentRef.setInput('permiteDescarga', true);
    fixture.detectChanges();
    const pedidos: RespaldoCredencial[] = [];
    fixture.componentInstance.descargar.subscribe((pedido) => pedidos.push(pedido));
    const boton = raiz.querySelector<HTMLButtonElement>('[data-testid="credencial-descargar-cr-1"]')!;

    expect(boton.getAttribute('aria-label')).toContain('Título de grado');
    expect(boton.getAttribute('aria-label')).toContain('TIT-9');
    expect(raiz.querySelector('[data-testid="credencial-descargar-lic-1"]')).toBeNull();
    boton.click();

    expect(pedidos).toEqual([{ fileId: 'archivo-diploma', nombre: 'diploma-TIT-9' }]);
  });

  it('una descarga en curso anuncia el progreso y bloquea los demás respaldos', () => {
    const fixture = montar({
      formacion: [{ ...FORMACION, fileId: 'archivo-diploma' }],
      matriculas: [{ ...MATRICULA, fileId: 'archivo-matricula' }],
      permiteDescarga: true,
      descargando: 'archivo-diploma',
    });
    const pedidos: RespaldoCredencial[] = [];
    fixture.componentInstance.descargar.subscribe((pedido) => pedidos.push(pedido));
    const raiz = fixture.nativeElement as HTMLElement;
    const diploma = raiz.querySelector<HTMLButtonElement>('[data-testid="credencial-descargar-cr-1"]')!;
    const matricula = raiz.querySelector<HTMLButtonElement>('[data-testid="credencial-descargar-lic-1"]')!;

    expect(diploma.textContent).toContain('Descargando…');
    expect(diploma.getAttribute('aria-disabled')).toBe('true');
    expect(matricula.getAttribute('aria-disabled')).toBe('true');
    diploma.click();
    matricula.click();
    expect(pedidos).toEqual([]);

    fixture.componentRef.setInput('descargando', null);
    fixture.detectChanges();
    matricula.click();
    expect(pedidos).toEqual([{ fileId: 'archivo-matricula', nombre: 'matricula-LIC-3' }]);
  });

  it('el detalle de una fila densa conserva descarga y retiro permitido', () => {
    const datos = formaciones(6).map((fila, indice) => ({
      ...fila, ...(indice === 0 ? { fileId: 'archivo-diploma' } : {}),
    }));
    const fixture = montar({
      formacion: datos, permiteDescarga: true, retirables: new Set(['formacion-1']),
    });
    const pedidos: RespaldoCredencial[] = [];
    const retiros: FormacionVisible[] = [];
    fixture.componentInstance.descargar.subscribe((pedido) => pedidos.push(pedido));
    fixture.componentInstance.retirar.subscribe((pedido) => retiros.push(pedido));
    const bloque = grupo(fixture, 'education');
    bloque.querySelector<HTMLButtonElement>('[aria-expanded="false"]')!.click();
    fixture.detectChanges();
    const detalle = bloque.querySelector('.data-table__detail-row')!;

    detalle.querySelector<HTMLButtonElement>('[data-testid="credencial-descargar-formacion-1"]')!.click();
    detalle.querySelector<HTMLButtonElement>('[data-testid="formacion-retirar-formacion-1"]')!.click();

    expect(pedidos).toEqual([{ fileId: 'archivo-diploma', nombre: 'diploma-TIT-1' }]);
    expect(retiros).toEqual([datos[0]]);
    expect(bloque.querySelector('[data-testid="formacion-retirar-formacion-2"]')).toBeNull();
  });
});
