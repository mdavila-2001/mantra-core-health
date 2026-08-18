import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';

import { Groups } from './groups';
import { AuthService } from '../../core/auth/auth.service';

/**
 * Lo que estas pruebas fijan.
 *
 * Tres reglas que no se ven leyendo la plantilla: que **sin organización
 * elegida no se pide nada** —adivinarla mostraría los grupos de otra—, que los
 * filtros **no viajan cuando no se usaron** —el backend valida con
 * `forbidNonWhitelisted`— y que la dirección del grupo **se deriva del nombre**
 * sin obligar a nadie a saber qué es un slug.
 */
describe('Groups', () => {
  let fixture: ComponentFixture<Groups>;
  let http: HttpTestingController;

  const tenantId = signal<string | null>('t-1');
  const texto = (): string => fixture.nativeElement.textContent as string;

  const paginaVacia = { items: [], count: 0, limit: 20, nextCursor: null };

  const grupo = (id: string, nombre: string) => ({
    id,
    tenantId: 't-1',
    slug: nombre.toLowerCase(),
    name: nombre,
    description: null,
    visibilityConceptId: 'c-publico',
    groupTypeConceptId: 'c-general',
    ownerProfileId: null,
    coverFileId: null,
    memberCount: 4,
    statusConceptId: 'c-activo',
  });

  /** Contesta el listado de temas, que se pide siempre al montar. */
  const responderTemas = (): void => {
    http.expectOne((r) => r.url === '/community/topics').flush({
      items: [{ id: 'top-1', code: 'CARDIO', name: 'Cardiología', parentTopicId: null, specialtyConceptId: null }],
      count: 1,
      limit: 200,
    });
  };

  const montar = (): void => {
    fixture = TestBed.createComponent(Groups);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    tenantId.set('t-1');

    await TestBed.configureTestingModule({
      imports: [Groups],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { activeTenantId: tenantId } },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sin organización elegida no pide el directorio', () => {
    tenantId.set(null);
    montar();
    responderTemas();

    http.expectNone((r) => r.url === '/community/groups');
    expect(texto()).toContain('Elegí una organización');
  });

  it('pide el directorio de la organización activa y lo pinta', () => {
    montar();
    responderTemas();

    const req = http.expectOne((r) => r.url === '/community/groups');
    expect(req.request.params.get('tenantId')).toBe('t-1');
    // Sin filtros usados, no viajan: el backend los rechazaría con 400.
    expect(req.request.params.has('topicId')).toBe(false);
    expect(req.request.params.has('q')).toBe(false);
    req.flush({ ...paginaVacia, items: [grupo('g-1', 'Cardiología clínica')], count: 1 });
    fixture.detectChanges();

    expect(texto()).toContain('Cardiología clínica');
    expect(texto()).toContain('4 integrantes');
  });

  it('un directorio vacío es un estado, no un error', () => {
    montar();
    responderTemas();
    http.expectOne((r) => r.url === '/community/groups').flush(paginaVacia);
    fixture.detectChanges();

    expect(texto()).toContain('No hay grupos que coincidan');
  });

  it('buscar reinicia la paginación y manda el texto', () => {
    montar();
    responderTemas();
    http
      .expectOne((r) => r.url === '/community/groups')
      .flush({ ...paginaVacia, items: [grupo('g-1', 'Cardiología')], count: 1, nextCursor: 'c-2' });
    fixture.detectChanges();

    (fixture.componentInstance as unknown as { buscar(t: string): void }).buscar('cardio');
    fixture.detectChanges();

    const req = http.expectOne((r) => r.url === '/community/groups');
    expect(req.request.params.get('q')).toBe('cardio');
    // La búsqueda vuelve a la primera página: arrastrar el cursor de la lista
    // anterior devolvería el tramo equivocado del resultado nuevo.
    expect(req.request.params.has('cursor')).toBe(false);
    req.flush(paginaVacia);
    fixture.detectChanges();
  });

  it('el tema se alterna: volver a tocarlo lo quita', () => {
    montar();
    responderTemas();
    http.expectOne((r) => r.url === '/community/groups').flush(paginaVacia);
    fixture.detectChanges();

    const componente = fixture.componentInstance as unknown as {
      filtrarPorTema(id: string): void;
    };

    componente.filtrarPorTema('top-1');
    fixture.detectChanges();
    const conTema = http.expectOne((r) => r.url === '/community/groups');
    expect(conTema.request.params.get('topicId')).toBe('top-1');
    conTema.flush(paginaVacia);
    fixture.detectChanges();

    componente.filtrarPorTema('top-1');
    fixture.detectChanges();
    const sinTema = http.expectOne((r) => r.url === '/community/groups');
    expect(sinTema.request.params.has('topicId')).toBe(false);
    sinTema.flush(paginaVacia);
    fixture.detectChanges();
  });

  it('la dirección del grupo sale del nombre, sin tildes ni espacios', () => {
    montar();
    responderTemas();
    http.expectOne((r) => r.url === '/community/groups').flush(paginaVacia);
    fixture.detectChanges();

    const componente = fixture.componentInstance as unknown as {
      nombre: { set(v: string): void };
      slug(): string;
    };
    componente.nombre.set('  Cardiología Clínica del Sur  ');

    expect(componente.slug()).toBe('cardiologia-clinica-del-sur');
  });

  it('un slug repetido se explica, no se traga', () => {
    montar();
    responderTemas();
    http.expectOne((r) => r.url === '/community/groups').flush(paginaVacia);
    fixture.detectChanges();

    const componente = fixture.componentInstance as unknown as {
      nombre: { set(v: string): void };
      crear(): void;
    };
    componente.nombre.set('Cardiología');
    componente.crear();

    http
      .expectOne((r) => r.url === '/community/groups' && r.method === 'POST')
      .flush({}, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(texto()).toContain('Ya hay un grupo con esa dirección');
  });
});
