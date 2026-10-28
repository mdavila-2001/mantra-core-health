import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { NEVER, of } from 'rxjs';

import { ReverseGeocodingClient } from '../../../../core/data-access/geo/reverse-geocoding.client';
import { BoMunicipalitiesCatalog } from '../../../../core/data-access/terminology/bo-municipalities.service';
import type { BranchDraft } from '../../../../shared/utils/branch-import/branch-import';
import {
  BranchesEditor,
  MAX_SUCURSALES_POR_DEFECTO,
  faltaDeSucursal,
  sucursalesCompletas,
  type SucursalDeclarada,
} from './branches-editor';

const PUNTO = { lat: -17.7833, lng: -63.1821 };

function sucursal(parcial: Partial<SucursalDeclarada> = {}): SucursalDeclarada {
  return { id: 'sucursal-1', nombre: 'Equipetrol', direccion: 'Av. Equipetrol 1', gps: PUNTO, ...parcial };
}

function borrador(parcial: Partial<BranchDraft> = {}): BranchDraft {
  return {
    name: 'Norte',
    description: 'ignorada',
    locationUrl: 'https://maps.example/ignorada',
    address: 'Av. Banzer 2',
    code: '',
    coordinates: null,
    ...parcial,
  };
}

@Component({
  imports: [BranchesEditor],
  template: `<app-branches-editor
    prefijoTestId="t"
    [(sucursales)]="lista"
    [maximo]="maximo()"
    [mostrarFaltantes]="true"
  />`,
})
class Anfitrion {
  readonly lista = signal<readonly SucursalDeclarada[]>([]);
  readonly maximo = signal(MAX_SUCURSALES_POR_DEFECTO);
}

describe('faltaDeSucursal y sucursalesCompletas', () => {
  it('una sucursal con nombre y punto está completa', () => {
    expect(faltaDeSucursal(sucursal())).toBeNull();
  });

  it('sin nombre o sin punto dice qué falta', () => {
    expect(faltaDeSucursal(sucursal({ nombre: '  ' }))).toContain('nombre');
    expect(faltaDeSucursal(sucursal({ gps: null }))).toContain('mapa');
  });

  it('la lista vacía es válida (las sucursales son opcionales); una a medias, no; más del tope, no', () => {
    const validar = sucursalesCompletas(2);
    const con = (valor: readonly SucursalDeclarada[]) =>
      validar(new FormControl(valor, { nonNullable: true }));

    expect(con([])).toBeNull();
    expect(con([sucursal()])).toBeNull();
    expect(con([sucursal(), sucursal({ id: 'b', gps: null })])).toEqual({ sucursalIncompleta: true });
    expect(con([sucursal(), sucursal({ id: 'b' }), sucursal({ id: 'c' })])).toEqual({
      demasiadasSucursales: { maximo: 2 },
    });
  });
});

describe('BranchesEditor', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let raiz: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ReverseGeocodingClient, useValue: { streetAt: () => NEVER } },
        { provide: BoMunicipalitiesCatalog, useValue: { listar: () => of([]) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    raiz = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  const boton = (id: string) => raiz.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);
  const editor = () => fixture.debugElement.children[0]!.componentInstance as unknown as {
    agregar(): void;
    quitar(id: string): void;
    escribirNombre(id: string, nombre: string | number | null): void;
    fijarGps(id: string, gps: typeof PUNTO | null): void;
    escribirLocalidad(id: string, l: unknown): void;
    agregarEnLote(l: readonly BranchDraft[]): void;
    idsDe(id: string): { mapa: string; confirmar: string };
  };

  it('sin sucursales dice que no hace falta si atiende en un solo local', () => {
    expect(raiz.textContent).toContain('Si atiende en un solo local, no hace falta.');
  });

  it('«Agregar sucursal» suma una tarjeta con su propio mapa y devuelve la lista por la vía doble', async () => {
    boton('t-agregar-sucursal')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.lista()).toEqual([
      { id: 'sucursal-1', nombre: '', direccion: '', gps: null },
    ]);
    expect(raiz.querySelector('[data-testid="t-sucursal-1-map"]')).not.toBeNull();
  });

  it('se editan, se les pone el punto y se quitan sin renumerar las demás', () => {
    const e = editor();
    e.agregar();
    e.agregar();
    const [a, b] = fixture.componentInstance.lista();
    e.escribirNombre(a!.id, 'Equipetrol');
    e.fijarGps(a!.id, PUNTO);
    e.escribirLocalidad(a!.id, {
      punto: PUNTO, calle: 'Av. Equipetrol 1', calleSola: null, zona: null, municipioConceptId: null,
    });
    e.quitar(b!.id);

    expect(fixture.componentInstance.lista()).toEqual([
      { id: 'sucursal-1', nombre: 'Equipetrol', direccion: 'Av. Equipetrol 1', gps: PUNTO },
    ]);
    e.agregar();
    expect(fixture.componentInstance.lista().map((s) => s.id)).toEqual(['sucursal-1', 'sucursal-3']);
  });

  it('con punto la dirección nunca queda vacía: cae al punto mismo', () => {
    const e = editor();
    e.agregar();
    e.fijarGps('sucursal-1', PUNTO);

    expect(fixture.componentInstance.lista()[0]!.direccion).toBe('Punto GPS -17.78330, -63.18210');
  });

  it('cada sucursal tiene identificadores de mapa propios', () => {
    const e = editor();
    expect(e.idsDe('sucursal-1').mapa).not.toBe(e.idsDe('sucursal-2').mapa);
    expect(e.idsDe('sucursal-1').confirmar).toBe('t-sucursal-1-location-confirm');
  });

  it('muestra qué le falta a una sucursal a medias', async () => {
    editor().agregar();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(raiz.querySelector('[data-testid="t-sucursal-1-falta"]')?.textContent).toContain('nombre');
  });

  it('el lote suma nombre, dirección y punto, e ignora descripción y enlace', () => {
    editor().agregarEnLote([
      borrador({ coordinates: { latitude: -17.7, longitude: -63.1 } }),
      borrador({ name: 'Sur', address: '' }),
    ]);

    expect(fixture.componentInstance.lista()).toEqual([
      { id: 'sucursal-1', nombre: 'Norte', direccion: 'Av. Banzer 2', gps: { lat: -17.7, lng: -63.1 } },
      { id: 'sucursal-2', nombre: 'Sur', direccion: '', gps: null },
    ]);
  });

  it('el lote que pasa del tope se corta y lo dice; con el tope lleno no se puede agregar más', async () => {
    fixture.componentInstance.maximo.set(2);
    fixture.detectChanges();
    editor().agregarEnLote([borrador({ name: 'A' }), borrador({ name: 'B' }), borrador({ name: 'C' })]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.lista().map((s) => s.nombre)).toEqual(['A', 'B']);
    expect(raiz.querySelector('[data-testid="t-aviso-lote"]')?.textContent).toContain('Se agregaron 2 de 3');
    expect(raiz.querySelector('[data-testid="t-tope"]')?.textContent).toContain('máximo de 2');
    expect(boton('t-agregar-sucursal')!.getAttribute('aria-disabled')).toBe('true');

    editor().agregar();
    expect(fixture.componentInstance.lista()).toHaveLength(2);
  });
});
