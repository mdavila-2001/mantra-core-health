import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import {
  BoMunicipalitiesCatalog,
  type RamaDepartamento,
} from '@core/data-access/terminology/bo-municipalities.service';

import { FiltroTerritorial, PARAM_CIUDAD, PARAM_DEPARTAMENTO } from './filtro-territorial';

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

  function crear(url: Record<string, string> = {}): FiltroTerritorial {
    parametros = new BehaviorSubject<Record<string, string>>(url);
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: { queryParams: parametros } },
        { provide: Router, useValue: { navigate: navegar } },
        { provide: BoMunicipalitiesCatalog, useValue: { listar, olvidar } },
      ],
    });
    return TestBed.runInInjectionContext(() => new FiltroTerritorial());
  }

  beforeEach(() => {
    navegar = vi.fn().mockResolvedValue(true);
    listar = vi.fn(() => of(RAMAS));
    olvidar = vi.fn();
  });

  it('sin departamento no elige nada y no recorta nada (AC-2.3-07)', () => {
    const lugar = crear();

    expect(lugar.departamentoElegido()).toBeNull();
    expect(lugar.ciudad()).toBeNull();
    // Ningún municipio suelto que parezca de algún departamento.
    expect(lugar.ciudades(FILAS)).toEqual([]);
    expect(lugar.recortar(FILAS)).toEqual(FILAS);
  });

  it('las opciones de municipio son sólo las del departamento elegido (AC-2.3-02)', () => {
    const lugar = crear({ [PARAM_DEPARTAMENTO]: CB });

    // Con el nombre del catálogo, el más cargado primero.
    expect(lugar.ciudades(FILAS)).toEqual(['Cochabamba', 'Quillacollo']);
    expect(lugar.recortar(FILAS).map((f) => f.city)).toEqual([
      'Cochabamba',
      'Cochabamba',
      'quillacollo',
    ]);
  });

  it('el municipio acota dentro del departamento, sin distinguir tildes ni mayúsculas', () => {
    const lugar = crear({ [PARAM_DEPARTAMENTO]: CB, [PARAM_CIUDAD]: 'QUILLACOLLO' });

    expect(lugar.ciudad()).toBe('Quillacollo');
    expect(lugar.recortar(FILAS).map((f) => f.city)).toEqual(['quillacollo']);
  });

  it('un municipio de otro departamento no forma una combinación (AC-2.3-03, AC-2.3-06)', () => {
    const lugar = crear({ [PARAM_DEPARTAMENTO]: CB, [PARAM_CIUDAD]: 'La Paz' });

    expect(lugar.ciudad()).toBeNull();
    // Se ve el departamento entero, no una lista vacía sin explicación.
    expect(lugar.recortar(FILAS)).toHaveLength(3);
  });

  it('un municipio sin departamento no se toma (AC-2.3-07)', () => {
    const lugar = crear({ [PARAM_CIUDAD]: 'Quillacollo' });

    expect(lugar.ciudad()).toBeNull();
    expect(lugar.recortar(FILAS)).toEqual(FILAS);
  });

  it('un departamento que no está en el catálogo no filtra', () => {
    const lugar = crear({
      [PARAM_DEPARTAMENTO]: 'geo:bo:department:XX',
      [PARAM_CIUDAD]: 'Cochabamba',
    });

    expect(lugar.departamentoElegido()).toBeNull();
    expect(lugar.ciudad()).toBeNull();
    expect(lugar.recortar(FILAS)).toEqual(FILAS);
  });

  it('no convierte la falta de ubicación en coincidencia (AC-2.3-05)', () => {
    const lugar = crear({ [PARAM_DEPARTAMENTO]: SC });

    // «San Pedro» es de Santa Cruz y de Pando: no se asigna a ninguno. «Santa
    // Cruz» no es un municipio. Sin ciudad, o en blanco, no se ubica.
    expect(lugar.recortar(FILAS)).toEqual([]);
    expect(lugar.sinUbicar(FILAS)).toBe(4);
    expect(lugar.cuentaPorDepartamento(FILAS).get(SC)).toBeUndefined();
    expect(lugar.cuentaPorDepartamento(FILAS).get(PD)).toBeUndefined();
  });

  it('cuenta por departamento sin aplicar el corte del propio mapa', () => {
    const lugar = crear({ [PARAM_DEPARTAMENTO]: LP });

    const cuenta = lugar.cuentaPorDepartamento(FILAS);
    expect(cuenta.get(CB)).toBe(3);
    expect(cuenta.get(LP)).toBe(1);
  });

  it('sigue a la URL: cambiar el parámetro cambia la elección', () => {
    const lugar = crear();

    parametros.next({ [PARAM_DEPARTAMENTO]: LP });

    expect(lugar.departamentoElegido()).toBe(LP);
    expect(lugar.nombreDelDepartamento()).toBe('La Paz');
  });

  it('elegir otro departamento suelta el municipio del anterior (AC-2.3-03)', () => {
    const lugar = crear({ [PARAM_DEPARTAMENTO]: CB, [PARAM_CIUDAD]: 'Quillacollo' });

    lugar.elegirDepartamento(LP);

    expect(navegar).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { [PARAM_DEPARTAMENTO]: LP, [PARAM_CIUDAD]: null },
        queryParamsHandling: 'merge',
      }),
    );
  });

  it('volver a todo el país quita los dos parámetros', () => {
    const lugar = crear({ [PARAM_DEPARTAMENTO]: CB });

    lugar.elegirDepartamento(null);

    expect(navegar).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { [PARAM_DEPARTAMENTO]: null, [PARAM_CIUDAD]: null },
      }),
    );
  });

  it('elegir un municipio lo escribe en la URL, y null vuelve a todo el departamento', () => {
    const lugar = crear({ [PARAM_DEPARTAMENTO]: CB });

    lugar.elegirCiudad('Quillacollo');
    expect(navegar).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { [PARAM_CIUDAD]: 'Quillacollo' } }),
    );

    lugar.elegirCiudad(null);
    expect(navegar).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { [PARAM_CIUDAD]: null } }),
    );
  });

  it('las opciones salen del catálogo: sin catálogo no hay departamentos (AC-2.3-04)', () => {
    listar = vi.fn(() => throwError(() => new Error('catálogo no sembrado')));
    const lugar = crear({ [PARAM_DEPARTAMENTO]: CB });

    expect(lugar.catalogoCaido()).toBe(true);
    expect(lugar.departamentos()).toEqual([]);
    expect(lugar.departamentoElegido()).toBeNull();
    // El directorio sigue sirviendo sin el filtro.
    expect(lugar.recortar(FILAS)).toEqual(FILAS);
  });

  it('reintentar olvida la caché y vuelve a leer el catálogo', () => {
    let falla = true;
    listar = vi.fn(() => (falla ? throwError(() => new Error('sin red')) : of(RAMAS)));
    const lugar = crear({ [PARAM_DEPARTAMENTO]: CB });
    expect(lugar.catalogoCaido()).toBe(true);

    falla = false;
    lugar.reintentar();

    expect(olvidar).toHaveBeenCalled();
    expect(lugar.catalogoCaido()).toBe(false);
    expect(lugar.departamentoElegido()).toBe(CB);
  });
});
