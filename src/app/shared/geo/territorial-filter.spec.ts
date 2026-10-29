import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import {
  BoMunicipalitiesCatalog,
  type RamaDepartamento,
} from '@core/data-access/terminology/bo-municipalities.service';

import { FilterTerritorial, PARAM_CITY, PARAM_DEPARTMENT } from './territorial-filter';

const CB = 'geo:bo:department:CB';
const LP = 'geo:bo:department:LP';
const SC = 'geo:bo:department:SC';
const PD = 'geo:bo:department:PD';

/**
 * Cuatro departamentos como los sirve el catálogo. «San Pedro» va en dos a
 * propósito: es uno de los siete nombres que el INE repite entre departamentos.
 */
const RAMAS: readonly RamaDepartamento[] = [
  {
    conceptId: CB,
    sigla: 'CB',
    nombre: 'Cochabamba',
    municipios: [
      { conceptId: 'm-cb-1', nombre: 'Cochabamba', ine: '030101' },
      { conceptId: 'm-cb-2', nombre: 'Quillacollo', ine: '030401' },
      { conceptId: 'm-cb-3', nombre: 'Tiquipaya', ine: '030402' },
    ],
  },
  {
    conceptId: LP,
    sigla: 'LP',
    nombre: 'La Paz',
    municipios: [
      { conceptId: 'm-lp-1', nombre: 'La Paz', ine: '020101' },
      { conceptId: 'm-lp-2', nombre: 'El Alto', ine: '020105' },
    ],
  },
  {
    conceptId: SC,
    sigla: 'SC',
    nombre: 'Santa Cruz',
    municipios: [
      { conceptId: 'm-sc-1', nombre: 'Santa Cruz de la Sierra', ine: '070101' },
      { conceptId: 'm-sc-2', nombre: 'San Pedro', ine: '071005' },
    ],
  },
  {
    conceptId: PD,
    sigla: 'PD',
    nombre: 'Pando',
    municipios: [
      { conceptId: 'm-pd-1', nombre: 'Cobija', ine: '090101' },
      { conceptId: 'm-pd-2', nombre: 'San Pedro', ine: '090202' },
    ],
  },
];

const fila = (city: string | null): { readonly city: string | null } => ({ city });

const FILAS = [
  fila('Cochabamba'),
  fila('Cochabamba'),
  fila('quillacollo'),
  fila('La Paz'),
  // Nombre que el catálogo repite entre Santa Cruz y Pando.
  fila('San Pedro'),
  // No es un municipio del catálogo: el municipio se llama «Santa Cruz de la Sierra».
  fila('Santa Cruz'),
  fila(null),
  fila('   '),
];

describe('FiltroTerritorial', () => {
  let parametros: BehaviorSubject<Record<string, string>>;
  let navegar: ReturnType<typeof vi.fn>;
  let listar: ReturnType<typeof vi.fn>;
  let olvidar: ReturnType<typeof vi.fn>;

  function crear(url: Record<string, string> = {}): FilterTerritorial {
    parametros = new BehaviorSubject<Record<string, string>>(url);
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: { queryParams: parametros } },
        { provide: Router, useValue: { navigate: navegar } },
        { provide: BoMunicipalitiesCatalog, useValue: { listar, olvidar } },
      ],
    });
    return TestBed.runInInjectionContext(() => new FilterTerritorial());
  }

  beforeEach(() => {
    navegar = vi.fn().mockResolvedValue(true);
    listar = vi.fn(() => of(RAMAS));
    olvidar = vi.fn();
  });

  it('sin departamento no elige nada y no recorta nada (AC-2.3-07)', () => {
    const lugar = crear();

    expect(lugar.chosenDepartment()).toBeNull();
    expect(lugar.city()).toBeNull();
    // Ningún municipio suelto que parezca de algún departamento.
    expect(lugar.cities(FILAS)).toEqual([]);
    expect(lugar.crop(FILAS)).toEqual(FILAS);
  });

  it('las opciones de municipio son sólo las del departamento elegido (AC-2.3-02)', () => {
    const lugar = crear({ [PARAM_DEPARTMENT]: CB });

    // Con el nombre del catálogo, el más cargado primero.
    expect(lugar.cities(FILAS)).toEqual(['Cochabamba', 'Quillacollo']);
    expect(lugar.crop(FILAS).map((f) => f.city)).toEqual([
      'Cochabamba',
      'Cochabamba',
      'quillacollo',
    ]);
  });

  it('el municipio acota dentro del departamento, sin distinguir tildes ni mayúsculas', () => {
    const lugar = crear({ [PARAM_DEPARTMENT]: CB, [PARAM_CITY]: 'QUILLACOLLO' });

    expect(lugar.city()).toBe('Quillacollo');
    expect(lugar.crop(FILAS).map((f) => f.city)).toEqual(['quillacollo']);
  });

  it('un municipio de otro departamento no forma una combinación (AC-2.3-03, AC-2.3-06)', () => {
    const lugar = crear({ [PARAM_DEPARTMENT]: CB, [PARAM_CITY]: 'La Paz' });

    expect(lugar.city()).toBeNull();
    // Se ve el departamento entero, no una lista vacía sin explicación.
    expect(lugar.crop(FILAS)).toHaveLength(3);
  });

  it('un municipio sin departamento no se toma (AC-2.3-07)', () => {
    const lugar = crear({ [PARAM_CITY]: 'Quillacollo' });

    expect(lugar.city()).toBeNull();
    expect(lugar.crop(FILAS)).toEqual(FILAS);
  });

  it('un departamento que no está en el catálogo no filtra', () => {
    const lugar = crear({
      [PARAM_DEPARTMENT]: 'geo:bo:department:XX',
      [PARAM_CITY]: 'Cochabamba',
    });

    expect(lugar.chosenDepartment()).toBeNull();
    expect(lugar.city()).toBeNull();
    expect(lugar.crop(FILAS)).toEqual(FILAS);
  });

  it('no convierte la falta de ubicación en coincidencia (AC-2.3-05)', () => {
    const lugar = crear({ [PARAM_DEPARTMENT]: SC });

    // «San Pedro» es de Santa Cruz y de Pando: no se asigna a ninguno. «Santa
    // Cruz» no es un municipio. Sin ciudad, o en blanco, no se ubica.
    expect(lugar.crop(FILAS)).toEqual([]);
    expect(lugar.withoutLocate(FILAS)).toBe(4);
    expect(lugar.accountByDepartment(FILAS).get(SC)).toBeUndefined();
    expect(lugar.accountByDepartment(FILAS).get(PD)).toBeUndefined();
  });

  it('cuenta por departamento sin aplicar el corte del propio mapa', () => {
    const lugar = crear({ [PARAM_DEPARTMENT]: LP });

    const cuenta = lugar.accountByDepartment(FILAS);
    expect(cuenta.get(CB)).toBe(3);
    expect(cuenta.get(LP)).toBe(1);
  });

  it('sigue a la URL: cambiar el parámetro cambia la elección', () => {
    const lugar = crear();

    parametros.next({ [PARAM_DEPARTMENT]: LP });

    expect(lugar.chosenDepartment()).toBe(LP);
    expect(lugar.departmentName()).toBe('La Paz');
  });

  it('elegir otro departamento suelta el municipio del anterior (AC-2.3-03)', () => {
    const lugar = crear({ [PARAM_DEPARTMENT]: CB, [PARAM_CITY]: 'Quillacollo' });

    lugar.chooseDepartment(LP);

    expect(navegar).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { [PARAM_DEPARTMENT]: LP, [PARAM_CITY]: null },
        queryParamsHandling: 'merge',
      }),
    );
  });

  it('volver a todo el país quita los dos parámetros', () => {
    const lugar = crear({ [PARAM_DEPARTMENT]: CB });

    lugar.chooseDepartment(null);

    expect(navegar).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { [PARAM_DEPARTMENT]: null, [PARAM_CITY]: null },
      }),
    );
  });

  it('elegir un municipio lo escribe en la URL, y null vuelve a todo el departamento', () => {
    const lugar = crear({ [PARAM_DEPARTMENT]: CB });

    lugar.chooseCity('Quillacollo');
    expect(navegar).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { [PARAM_CITY]: 'Quillacollo' } }),
    );

    lugar.chooseCity(null);
    expect(navegar).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { [PARAM_CITY]: null } }),
    );
  });

  it('las opciones salen del catálogo: sin catálogo no hay departamentos (AC-2.3-04)', () => {
    listar = vi.fn(() => throwError(() => new Error('catálogo no sembrado')));
    const lugar = crear({ [PARAM_DEPARTMENT]: CB });

    expect(lugar.catalogoCaido()).toBe(true);
    expect(lugar.departments()).toEqual([]);
    expect(lugar.chosenDepartment()).toBeNull();
    // El directorio sigue sirviendo sin el filtro.
    expect(lugar.crop(FILAS)).toEqual(FILAS);
  });

  it('reintentar olvida la caché y vuelve a leer el catálogo', () => {
    let falla = true;
    listar = vi.fn(() => (falla ? throwError(() => new Error('sin red')) : of(RAMAS)));
    const lugar = crear({ [PARAM_DEPARTMENT]: CB });
    expect(lugar.catalogoCaido()).toBe(true);

    falla = false;
    lugar.retry();

    expect(olvidar).toHaveBeenCalled();
    expect(lugar.catalogoCaido()).toBe(false);
    expect(lugar.chosenDepartment()).toBe(CB);
  });
});
