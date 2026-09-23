import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { Communities } from './communities';

/**
 * Lo que estas pruebas fijan de Comunidades.
 *
 * 1. **La comunidad es un tema real.** Sale de `GET /community/topics` y sus
 *    grupos de `GET /community/groups?topicId=…`, que es la relación que el
 *    dominio ya guarda. Si alguien la reemplazara por una comunidad fija que
 *    envuelve todos los grupos, la primera prueba se cae.
 * 2. **Los grupos se piden por tema.** Una lectura por tema de la comunidad, y
 *    no un reparto en memoria de una lista plana —`GroupListItem` no trae
 *    `topicId`, así que ese reparto sería inventado—.
 * 3. **La navegación es por niveles dentro del modal.** Abrir un grupo no
 *    navega ni despliega nada debajo de su tarjeta, y «Volver» deshace un
 *    escalón.
 * 4. **Un fallo no se disfraza de vacío.** «No hay comunidades» sobre un error
 *    de red es la mentira que hace que nadie reintente.
 */

const TEMAS = {
  items: [
    { id: 't-cardio', code: 'CARDIO', name: 'Cardiología' },
    { id: 't-diabetes', code: 'DIABETES', name: 'Diabetes' },
    // Cuelga de Cardiología: una comunidad puede reunir más de un tema.
    { id: 't-arritmias', code: 'ARRITMIAS', name: 'Arritmias', parentTopicId: 't-cardio' },
  ],
  count: 3,
  limit: 50,
};

function paginaDeGrupos(items: readonly Record<string, unknown>[]): Record<string, unknown> {
  return { items, count: items.length, limit: 50, nextCursor: null };
}

const GRUPO_CARDIO = {
  id: 'g-1',
  slug: 'cardiologos',
  name: 'Cardiólogos de Bolivia',
  description: 'Casos y guías clínicas.',
  visibilityConceptId: 'v-private',
  groupTypeConceptId: 'gt-general',
  statusConceptId: 'st-active',
  memberCount: 48,
};

const GRUPO_ARRITMIAS = {
  id: 'g-2',
  slug: 'arritmias',
  name: 'Arritmias',
  visibilityConceptId: 'v-public',
  groupTypeConceptId: 'gt-general',
  statusConceptId: 'st-active',
  memberCount: 12,
};

describe('Communities', () => {
  let fixture: ComponentFixture<Communities>;
  let http: HttpTestingController;

  const texto = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function elementos(testId: string): readonly HTMLElement[] {
    return [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        `[data-testid="${testId}"]`,
      ),
    ];
  }

  /** `interno` para lo protegido: la plantilla lo usa, la prueba también. */
  function interno<T>(nombre: string): T {
    return (fixture.componentInstance as unknown as Record<string, T>)[nombre] as T;
  }

  beforeEach(async () => {
    // Sin organización activa la pantalla es una puerta y no un listado: los
    // grupos son de cada organización. Mismo doble que usa `groups.spec.ts`.
    const tenantId = signal<string | null>('t-1');

    await TestBed.configureTestingModule({
      imports: [Communities],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { activeTenantId: tenantId } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Communities);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  /** Responde el árbol de temas con el que se arman las comunidades. */
  function responderTemas(cuerpo: object = TEMAS): void {
    http.expectOne((r) => r.url.endsWith('/community/topics')).flush(cuerpo);
    fixture.detectChanges();
  }

  it('las comunidades son los temas raíz, con sus subtemas adentro', () => {
    responderTemas();

    const comunidades = elementos('comunidad');
    // Dos raíces —Cardiología y Diabetes—; «Arritmias» no es una comunidad
    // aparte: cuelga de Cardiología.
    expect(comunidades.length).toBe(2);
    expect(texto()).toContain('Cardiología');
    expect(texto()).toContain('Diabetes');
    expect(comunidades.map((c) => c.textContent ?? '').join(' ')).toContain('2 secciones');
  });

  it('los grupos de la comunidad se piden por cada tema suyo', () => {
    responderTemas();

    elementos('comunidad')[0]!.click();
    fixture.detectChanges();

    // Una lectura por tema de la comunidad: el propio y su hijo.
    const porTema = http.match((r) => r.url.endsWith('/community/groups'));
    expect(porTema.length).toBe(2);
    expect(porTema.map((r) => r.request.params.get('topicId')).sort()).toEqual([
      't-arritmias',
      't-cardio',
    ]);
    // Y siempre acotado a la organización activa.
    expect(porTema[0]!.request.params.get('tenantId')).toBe('t-1');

    porTema[0]!.flush(paginaDeGrupos([GRUPO_CARDIO]));
    porTema[1]!.flush(paginaDeGrupos([GRUPO_ARRITMIAS]));
    fixture.detectChanges();

    expect(elementos('comunidad-grupo').length).toBe(2);
    expect(texto()).toContain('Cardiólogos de Bolivia');
    expect(texto()).toContain('48 integrantes');
  });

  /**
   * Anuncios se distingue de las conversaciones, y hoy dice lo que falta en vez
   * de mostrar el muro de un grupo haciéndose pasar por un tablón.
   */
  it('la comunidad muestra Anuncios separado de sus grupos', () => {
    responderTemas();
    elementos('comunidad')[0]!.click();
    fixture.detectChanges();
    for (const pedido of http.match((r) => r.url.endsWith('/community/groups'))) {
      pedido.flush(paginaDeGrupos([GRUPO_CARDIO]));
    }
    fixture.detectChanges();

    expect(texto()).toContain('Anuncios');
    expect(texto()).toContain('todavía no tiene canal de anuncios');
    expect(texto()).toContain('Grupos');
  });

  it('un mismo grupo que llega por dos temas se lista una vez', () => {
    responderTemas();
    elementos('comunidad')[0]!.click();
    fixture.detectChanges();

    for (const pedido of http.match((r) => r.url.endsWith('/community/groups'))) {
      pedido.flush(paginaDeGrupos([GRUPO_CARDIO]));
    }
    fixture.detectChanges();

    expect(elementos('comunidad-grupo').length).toBe(1);
  });

  it('abrir un grupo baja un nivel, y volver sube uno solo', () => {
    responderTemas();
    elementos('comunidad')[0]!.click();
    fixture.detectChanges();
    for (const pedido of http.match((r) => r.url.endsWith('/community/groups'))) {
      pedido.flush(paginaDeGrupos([GRUPO_CARDIO]));
    }
    fixture.detectChanges();

    expect(fixture.componentInstance.nivel()).toBe('comunidad');

    elementos('comunidad-grupo')[0]!.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.nivel()).toBe('grupo');
    // La ficha del grupo la pide el componente embebido, que es el mismo de la
    // pantalla del grupo: su muro y sus permisos no se reescriben acá.
    expect(http.match((r) => r.url.includes('/community/groups/g-1')).length).toBeGreaterThan(0);

    fixture.componentInstance.volver();
    fixture.detectChanges();

    // Un escalón: vuelve a la comunidad, no al listado.
    expect(fixture.componentInstance.nivel()).toBe('comunidad');

    fixture.componentInstance.volver();
    fixture.detectChanges();
    expect(fixture.componentInstance.nivel()).toBe('comunidades');
  });

  it('una comunidad sin grupos lo dice, y no se le presta el de otra', () => {
    responderTemas();

    // Diabetes: la segunda raíz, sin subtemas y sin grupos.
    elementos('comunidad')[1]!.click();
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/community/groups')).flush(paginaDeGrupos([]));
    fixture.detectChanges();

    expect(texto()).toContain('todavía no tiene grupos');
    expect(elementos('comunidad-grupo').length).toBe(0);
  });

  it('sin comunidades el vacío es real, y no una comunidad de demostración', () => {
    responderTemas({ items: [], count: 0, limit: 50 });

    expect(texto()).toContain('Todavía no hay comunidades');
    expect(elementos('comunidad').length).toBe(0);
  });

  /** Un error de red no puede leerse como «no tenés comunidades». */
  it('si falla la lectura lo dice como un fallo, no como un vacío', () => {
    http
      .expectOne((r) => r.url.endsWith('/community/topics'))
      .flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(texto()).toContain('No pudimos cargar las comunidades');
  });

  it('la búsqueda filtra sobre lo que la sesión ya puede ver', () => {
    responderTemas();

    interno<{ set: (v: string) => void }>('busqueda').set('diab');
    fixture.detectChanges();

    const comunidades = elementos('comunidad');
    expect(comunidades.length).toBe(1);
    expect(comunidades[0]!.textContent).toContain('Diabetes');
  });
});
