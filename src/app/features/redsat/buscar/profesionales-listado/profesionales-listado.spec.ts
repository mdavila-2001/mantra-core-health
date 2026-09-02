import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError, type Observable } from 'rxjs';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import type {
  PublicPractitionerQuery,
  PublicSearchResult,
} from '@core/data-access/public-directory/public-directory.types';
import { MedicalSpecialtiesCatalog } from '@core/data-access/terminology/medical-specialties.service';
import type { ValueSetOption } from '@core/data-access/terminology/terminology.types';

import { agruparPorEspecialidad, BuscarProfesionalesListado } from './profesionales-listado';

describe('agruparPorEspecialidad', () => {
  const profesional = (
    displayName: string,
    headline: string | null,
  ): PublicSearchResult => ({
    kind: 'PRACTITIONER',
    slug: displayName.toLowerCase().replaceAll(' ', '-'),
    displayName,
    headline,
    city: null,
    avatarUrl: null,
    verified: true,
    ratingAverage: null,
    ratingCount: 0,
    coverUrl: null,
    address: null,
    location: null,
    hasPublishedAgenda: false,
    nextAvailableDate: null,
  });

  it('reúne y ordena los profesionales por su especialidad visible', () => {
    const grupos = agruparPorEspecialidad([
      profesional('Zoé Ríos', 'Cardiología'),
      profesional('Ana Díaz', 'Dermatología'),
      profesional('Álvaro Silva', 'Cardiología'),
    ]);

    expect(grupos.map((grupo) => grupo.especialidad)).toEqual(['Cardiología', 'Dermatología']);
    expect(grupos[0].tarjetas.map((tarjeta) => tarjeta.title)).toEqual(['Álvaro Silva', 'Zoé Ríos']);
  });

  it('conserva los perfiles sin especialidad bajo un bloque claro', () => {
    const grupos = agruparPorEspecialidad([profesional('Luz Pérez', null)]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].especialidad).toBe('Especialidad no informada');
  });

  it('no separa una especialidad por la organización escrita en el titular', () => {
    const grupos = agruparPorEspecialidad([
      profesional('Ana Díaz', 'Cardióloga · Hospital del Norte'),
      profesional('Luz Pérez', 'Cardióloga · Clínica Central'),
    ]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].especialidad).toBe('Cardióloga');
    expect(grupos[0].tarjetas).toHaveLength(2);
  });
});

/* ============================================================================
    El filtro por especialidad (AC-02-7, AC-02-8, AC-02-13, AC-02-14).
    ========================================================================== */

describe('BuscarProfesionalesListado · filtro por especialidad', () => {
  const CARDIOLOGIA: ValueSetOption = {
    conceptId: 'concepto-cardiologia',
    code: 'CARDIOLOGY',
    display: 'Cardiología',
    codeSystemVersionId: 'v1',
  };
  const PEDIATRIA: ValueSetOption = {
    conceptId: 'concepto-pediatria',
    code: 'PEDIATRICS',
    display: 'Pediatría',
    codeSystemVersionId: 'v1',
  };

  let pedidos: PublicPractitionerQuery[];
  let catalogo: { listar: () => Observable<readonly ValueSetOption[]> };

  function montar(url = '/buscar/profesionales'): Promise<RouterTestingHarness> {
    pedidos = [];

    const directorio = {
      searchPractitioners: (filtros: PublicPractitionerQuery) => {
        pedidos.push(filtros);
        return of({
          items: [],
          nextCursor: null,
          totalHint: null,
          generatedAt: new Date('2026-09-01T00:00:00Z'),
        });
      },
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'buscar/profesionales', component: BuscarProfesionalesListado },
        ]),
        { provide: PublicDirectoryClient, useValue: directorio },
        {
          provide: MedicalSpecialtiesCatalog,
          // `olvidar()` sólo limpia la caché del servicio real; el doble no
          // tiene caché, así que no hace nada a propósito.
          useValue: { ...catalogo, olvidar: (): void => undefined },
        },
      ],
    });

    return RouterTestingHarness.create(url);
  }

  function pantalla(harness: RouterTestingHarness): HTMLElement {
    return harness.routeDebugElement!.nativeElement as HTMLElement;
  }

  function select(harness: RouterTestingHarness): HTMLSelectElement | null {
    return pantalla(harness).querySelector<HTMLSelectElement>('#f-especialidad');
  }

  beforeEach(() => {
    catalogo = { listar: () => of([CARDIOLOGIA, PEDIATRIA]) };
  });

  it('las opciones salen del catálogo, no de una lista escrita en el componente', async () => {
    const harness = await montar();
    await harness.fixture.whenStable();

    const opciones = [...(select(harness)?.options ?? [])].map((o) => ({
      value: o.value,
      label: o.textContent?.trim(),
    }));

    expect(opciones).toEqual([
      { value: '', label: 'Todas las especialidades' },
      { value: 'concepto-cardiologia', label: 'Cardiología' },
      { value: 'concepto-pediatria', label: 'Pediatría' },
    ]);
  });

  it('lo que viaja al servidor es el conceptId, no el rótulo', async () => {
    const harness = await montar('/buscar/profesionales?specialty=concepto-cardiologia');
    await harness.fixture.whenStable();

    expect(pedidos.at(-1)?.specialty).toBe('concepto-cardiologia');
  });

  it('sin filtro no se manda el parámetro', async () => {
    const harness = await montar();
    await harness.fixture.whenStable();

    expect(pedidos.at(-1)?.specialty).toBeUndefined();
  });

  it('elegir una especialidad la escribe en la URL: el enlace se puede pegar', async () => {
    const harness = await montar();
    await harness.fixture.whenStable();

    const control = select(harness)!;
    control.value = 'concepto-pediatria';
    control.dispatchEvent(new Event('change'));
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(
      '/buscar/profesionales?specialty=concepto-pediatria',
    );
    expect(pedidos.at(-1)?.specialty).toBe('concepto-pediatria');
  });

  it('el desplegable refleja lo que dice la URL', async () => {
    const harness = await montar('/buscar/profesionales?specialty=concepto-pediatria');
    await harness.fixture.whenStable();

    expect(select(harness)?.value).toBe('concepto-pediatria');
  });

  it('un catálogo caído no bloquea el directorio y se puede reintentar (AC-02-14)', async () => {
    catalogo = { listar: () => throwError(() => new Error('catálogo no sembrado')) };
    const harness = await montar();
    await harness.fixture.whenStable();

    // La lista se pidió igual: el filtro es opcional.
    expect(pedidos.length).toBeGreaterThan(0);
    expect(select(harness)).toBeNull();

    const aviso = pantalla(harness).querySelector('[role="status"]');
    expect(aviso?.textContent).toContain('No pudimos leer el catálogo');
    expect(aviso?.querySelector('button')?.textContent?.trim()).toBe('Reintentar');
  });
});
