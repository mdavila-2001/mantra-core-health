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
    http
      .expectOne((r) => r.url === '/community/topics')
      .flush({
        items: [
          {
            id: 'top-1',
            code: 'CARDIO',
            name: 'Cardiología',
            parentTopicId: null,
            specialtyConceptId: null,
          },
        ],
        count: 1,
        limit: 200,
      });
  };

  /**
   * Contesta la vitrina propia, que también se pide al montar (TP-3).
   *
   * Por defecto está completa: la mayoría de estas pruebas no hablan del
   * perfil, y montarlo incompleto les cambiaría el formulario por debajo.
   */
  const responderPerfil = (perfil: object = perfilCompleto()): void => {
    http.expectOne((r) => r.url === '/community/profiles/me').flush(perfil);
  };

  /** Una vitrina que sí puede presentar un grupo público. */
  const perfilCompleto = (overrides: Record<string, unknown> = {}) => ({
    id: 'pp-1',
    tenantId: 't-1',
    targetId: 'tg-1',
    slug: 'lucia-salas',
    displayName: 'Dra. Lucía Salas',
    avatarFileId: 'file-1',
    visibility: 'PUBLIC',
    statusConceptId: 'st-1',
    ...overrides,
  });

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
        // `displayName` lo lee `app-vitrina-minima`, que esta pantalla monta
        // cuando falta la vitrina: propone el enlace a partir del nombre.
        {
          provide: AuthService,
          useValue: { activeTenantId: tenantId, displayName: signal('Dra. Lucía Salas') },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sin organización elegida no pide el directorio', () => {
    tenantId.set(null);
    montar();
    responderTemas();
    responderPerfil();

    http.expectNone((r) => r.url === '/community/groups');
    expect(texto()).toContain('Elegí una organización');
  });

  it('pide el directorio de la organización activa y lo pinta', () => {
    montar();
    responderTemas();
    responderPerfil();

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
    responderPerfil();
    http.expectOne((r) => r.url === '/community/groups').flush(paginaVacia);
    fixture.detectChanges();

    expect(texto()).toContain('No hay grupos que coincidan');
  });

  it('buscar reinicia la paginación y manda el texto', () => {
    montar();
    responderTemas();
    responderPerfil();
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
    responderPerfil();
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
    responderPerfil();
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
    responderPerfil();
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

  /* -- TP-3 · regla 06: el perfil público con el que se crea ---------------- */

  /** El formulario de alta arranca cerrado; el aviso vive adentro. */
  const abrirAlta = (): void => {
    (fixture.componentInstance as unknown as { alternarAlta(): void }).alternarAlta();
    fixture.detectChanges();
  };

  /**
   * Deshabilitado y a la vista, no escondido: ocultarlo dejaría a la persona
   * sin saber que la opción existe ni por qué no la tiene.
   */
  it('con el perfil incompleto avisa qué falta para un grupo público', () => {
    montar();
    responderTemas();
    responderPerfil(perfilCompleto({ avatarFileId: undefined }));
    http.expectOne((r) => r.url === '/community/groups').flush(paginaVacia);
    fixture.detectChanges();
    abrirAlta();

    // El aviso dice qué falta y, desde el 13/09/2026, **ofrece resolverlo acá
    // mismo**: entre el 10 y el 13 derivaba a «quien administra tu
    // organización», que no tenía dónde hacerlo. La configuración sigue sin
    // volver al perfil, que es de donde el propietario la mandó sacar.
    expect(texto()).toContain('perfil público completo');
    expect(texto()).not.toContain('Pedíselo a quien administra tu organización');
    expect(texto()).toContain('Creá tu vitrina pública');
    expect(texto()).not.toContain('Configurar mi perfil público');
  });

  it('con el perfil completo no avisa nada', () => {
    montar();
    responderTemas();
    responderPerfil();
    http.expectOne((r) => r.url === '/community/groups').flush(paginaVacia);
    fixture.detectChanges();
    abrirAlta();

    expect(texto()).not.toContain('Configurar mi perfil público');
  });

  /** Sin vitrina configurada, tampoco se puede presentar un grupo público. */
  it('sin vitrina propia avisa igual', () => {
    montar();
    responderTemas();
    http.expectOne((r) => r.url === '/community/profiles/me').flush(null);
    http.expectOne((r) => r.url === '/community/groups').flush(paginaVacia);
    fixture.detectChanges();
    abrirAlta();

    // El aviso dice qué falta y, desde el 13/09/2026, **ofrece resolverlo acá
    // mismo**: entre el 10 y el 13 derivaba a «quien administra tu
    // organización», que no tenía dónde hacerlo. La configuración sigue sin
    // volver al perfil, que es de donde el propietario la mandó sacar.
    expect(texto()).toContain('perfil público completo');
    expect(texto()).not.toContain('Pedíselo a quien administra tu organización');
    expect(texto()).toContain('Creá tu vitrina pública');
    expect(texto()).not.toContain('Configurar mi perfil público');
  });

  /**
   * Que la lectura del perfil falle no es motivo para bloquear la opción: se
   * asume que puede, y si no, el servidor lo dirá.
   */
  it('si la lectura del perfil falla, la pantalla no bloquea nada de más', () => {
    montar();
    responderTemas();
    http.expectOne((r) => r.url === '/community/profiles/me').error(new ProgressEvent('error'));
    http.expectOne((r) => r.url === '/community/groups').flush(paginaVacia);
    fixture.detectChanges();
    abrirAlta();

    // Sin perfil resuelto se trata como incompleto, que es lo conservador:
    // ofrecer «público» y que falle sería peor que ofrecer sólo privado.
    // El aviso dice qué falta y, desde el 13/09/2026, **ofrece resolverlo acá
    // mismo**: entre el 10 y el 13 derivaba a «quien administra tu
    // organización», que no tenía dónde hacerlo. La configuración sigue sin
    // volver al perfil, que es de donde el propietario la mandó sacar.
    expect(texto()).toContain('perfil público completo');
    expect(texto()).not.toContain('Pedíselo a quien administra tu organización');
    expect(texto()).toContain('Creá tu vitrina pública');
    expect(texto()).not.toContain('Configurar mi perfil público');
  });
});
