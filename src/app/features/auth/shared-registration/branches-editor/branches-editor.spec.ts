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
  faltaDeNombre,
  faltaDeSucursal,
  sucursalesCompletas,
  sucursalesConIdsUnicos,
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
  template: `@if (visible()) {
    <app-branches-editor
      prefijoTestId="t"
      [(sucursales)]="lista"
      [maximo]="maximo()"
      [mostrarFaltantes]="mostrarFaltantes()"
    />
  }`,
})
class Anfitrion {
  /** El formulario paginado destruye el editor al cambiar de página: esto lo imita. */
  readonly visible = signal(true);
  readonly mostrarFaltantes = signal(true);
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

describe('el nombre de una sucursal: 200 como el contrato, no 300', () => {
  it('200 pasa y 201 no, con un mensaje que dice el tope', () => {
    expect(faltaDeNombre(sucursal({ nombre: 'N'.repeat(200) }))).toBeNull();
    expect(faltaDeNombre(sucursal({ nombre: ` ${'N'.repeat(200)} ` }))).toBeNull();
    expect(faltaDeNombre(sucursal({ nombre: 'N'.repeat(201) }))).toBe(
      'El nombre no puede pasar de 200 caracteres.',
    );
  });

  it('una lista con un nombre de 201 no es válida; con 200, sí', () => {
    const validar = sucursalesCompletas();
    const con = (valor: readonly SucursalDeclarada[]) =>
      validar(new FormControl(valor, { nonNullable: true }));

    expect(con([sucursal({ nombre: 'N'.repeat(200) })])).toBeNull();
    expect(con([sucursal({ nombre: 'N'.repeat(201) })])).toEqual({ sucursalIncompleta: true });
  });
});

describe('sucursalesConIdsUnicos (borradores viejos con ids repetidos)', () => {
  it('sin repetidos devuelve la misma lista, sin copiarla', () => {
    const lista = [sucursal({ id: 'sucursal-1' }), sucursal({ id: 'sucursal-2' })];

    expect(sucursalesConIdsUnicos(lista)).toBe(lista);
  });

  it('el repetido toma el siguiente número libre y la primera conserva el suyo', () => {
    const lista = [
      sucursal({ id: 'sucursal-1', nombre: 'A' }),
      sucursal({ id: 'sucursal-1', nombre: 'B' }),
      sucursal({ id: 'sucursal-3', nombre: 'C' }),
      sucursal({ id: 'sucursal-1', nombre: 'D' }),
    ];

    const unica = sucursalesConIdsUnicos(lista);

    expect(unica.map((s) => s.id)).toEqual(['sucursal-1', 'sucursal-4', 'sucursal-3', 'sucursal-5']);
    expect(unica.map((s) => s.nombre)).toEqual(['A', 'B', 'C', 'D']);
    expect(lista[1]!.id).toBe('sucursal-1');
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

  it('muestra qué le falta a una sucursal a medias, junto al nombre y junto al mapa, con el error del campo', async () => {
    editor().agregar();
    fixture.detectChanges();
    await fixture.whenStable();

    const errores = Array.from(
      raiz.querySelectorAll('[data-testid="t-sucursal-1"] .form-field-error'),
    ).map((e) => e.textContent?.trim());
    // El nombre va dentro del bloque de lo deducido (primero en el DOM); el del mapa, al cierre del selector.
    expect(errores).toEqual([
      'Escriba el nombre de la sucursal.',
      'Marque la sucursal en el mapa y confirme la dirección.',
    ]);
    // Ya no es un `<p role="alert">` suelto: el campo del nombre queda marcado inválido.
    expect(raiz.querySelector('[data-testid="t-sucursal-1"] .status-error')).not.toBeNull();
    expect(raiz.querySelector('[data-testid="t-sucursal-1-falta"]')).toBeNull();
  });

  it('al quitar una sucursal el foco pasa a la que ocupa su lugar, y sin ninguna, a «Agregar sucursal»', async () => {
    const e = editor();
    e.agregar();
    e.agregar();
    fixture.detectChanges();
    await fixture.whenStable();

    e.quitar('sucursal-1');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(boton('t-quitar-sucursal-2'));

    e.quitar('sucursal-2');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(boton('t-agregar-sucursal'));
  });

  it('el aviso del lote no promete la dirección del archivo: la deduce el punto', () => {
    editor().agregarEnLote([borrador()]);
    fixture.detectChanges();

    const aviso = raiz.querySelector('[data-testid="t-aviso-lote"]')?.textContent ?? '';
    expect(aviso).toContain('el nombre y el punto');
    expect(aviso).not.toContain('la dirección y el punto');
  });

  it('un nombre de 201 caracteres no se corta en silencio: se conserva y dice que se pasó, sin esperar a avanzar', async () => {
    editor().agregar();
    editor().escribirNombre('sucursal-1', 'N'.repeat(201));
    fixture.componentInstance.mostrarFaltantes.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.lista()[0]!.nombre).toHaveLength(201);
    expect(raiz.textContent).toContain('El nombre no puede pasar de 200 caracteres.');
  });

  it('un nombre de 200 caracteres no dice nada', async () => {
    editor().agregar();
    editor().escribirNombre('sucursal-1', 'N'.repeat(200));
    fixture.componentInstance.mostrarFaltantes.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(raiz.textContent).not.toContain('no puede pasar de');
  });

  it('el lote no corta el nombre de una fila: la marca inválida (201) y deja pasar la de 200', () => {
    editor().agregarEnLote([borrador({ name: 'N'.repeat(201) }), borrador({ name: 'M'.repeat(200) })]);
    const lista = fixture.componentInstance.lista();

    expect(lista[0]!.nombre).toHaveLength(201);
    expect(lista[1]!.nombre).toHaveLength(200);
    expect(faltaDeNombre(lista[0]!)).not.toBeNull();
    expect(faltaDeNombre(lista[1]!)).toBeNull();
  });

  it('el diálogo de carga en lote dice el tope real del alta (50), no el del archivo (300)', async () => {
    boton('t-subir-sucursales')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const texto = raiz.textContent ?? '';
    expect(texto).toContain('Hasta 50 sucursales en total');
    expect(texto).not.toContain('Hasta 300 sucursales por archivo');
  });

  it('el nombre va dentro del bloque de lo deducido, como primer campo de su rejilla, aun sin punto', async () => {
    editor().agregar();
    fixture.detectChanges();
    await fixture.whenStable();

    const bloque = raiz.querySelector('[data-testid="t-sucursal-1-map-deducido"]');
    expect(bloque).not.toBeNull();
    expect(bloque!.classList.contains('registro__deducido--tres')).toBe(true);
    expect(bloque!.querySelector('[data-testid="t-sucursal-1-nombre"]')).not.toBeNull();
    expect(bloque!.firstElementChild!.querySelector('[data-testid="t-sucursal-1-nombre"]')).not.toBeNull();
  });

  describe('ids únicos aunque el editor se destruya y se recree', () => {
    /** Imita el cambio de página del formulario paginado: el editor muere y vuelve con la lista guardada. */
    async function recrearEditor(): Promise<void> {
      fixture.componentInstance.visible.set(false);
      fixture.detectChanges();
      fixture.componentInstance.visible.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
    }

    const ids = () => fixture.componentInstance.lista().map((s) => s.id);

    it('crear dos, recrear el editor con esa lista y agregar no repite ids', async () => {
      editor().agregar();
      editor().agregar();
      await recrearEditor();
      editor().agregar();

      expect(ids()).toEqual(['sucursal-1', 'sucursal-2', 'sucursal-3']);
      expect(new Set(ids()).size).toBe(3);
    });

    it('editar la nueva no toca a las anteriores', async () => {
      editor().agregar();
      editor().agregar();
      await recrearEditor();
      editor().agregar();
      editor().escribirNombre('sucursal-3', 'Nueva');

      expect(fixture.componentInstance.lista().map((s) => s.nombre)).toEqual(['', '', 'Nueva']);
      editor().quitar('sucursal-3');
      expect(ids()).toEqual(['sucursal-1', 'sucursal-2']);
    });

    it('al restaurar un borrador la lista llega hecha: agregar y cargar en lote parten del mayor id', async () => {
      fixture.componentInstance.lista.set([
        sucursal({ id: 'sucursal-1', nombre: 'A' }),
        sucursal({ id: 'sucursal-2', nombre: 'B' }),
      ]);
      await recrearEditor();
      editor().agregar();
      editor().agregarEnLote([borrador({ name: 'C' }), borrador({ name: 'D' })]);

      expect(ids()).toEqual(['sucursal-1', 'sucursal-2', 'sucursal-3', 'sucursal-4', 'sucursal-5']);
      expect(new Set(ids()).size).toBe(5);
    });

    it('un borrador con ids salteados sigue de su mayor número', async () => {
      fixture.componentInstance.lista.set([sucursal({ id: 'sucursal-7' })]);
      await recrearEditor();
      editor().agregar();

      expect(ids()).toEqual(['sucursal-7', 'sucursal-8']);
    });
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
