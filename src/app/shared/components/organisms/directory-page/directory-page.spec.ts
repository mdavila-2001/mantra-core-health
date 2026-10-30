import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DirectoryPage } from './directory-page';

const CLAVE = 'alovida.directorio.vista';

describe('DirectoryPage · grilla o lista', () => {
  beforeEach(() => localStorage.removeItem(CLAVE));
  afterEach(() => localStorage.removeItem(CLAVE));

  function montar(entradas: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(DirectoryPage);
    for (const [nombre, valor] of Object.entries(entradas)) {
      fixture.componentRef.setInput(nombre, valor);
    }
    fixture.componentRef.setInput('titulo', 'Directorio');
    fixture.componentRef.setInput('subtitulo', 'Sub');
    fixture.componentRef.setInput('estado', { kind: 'ready', data: null });
    fixture.componentRef.setInput('sustantivo', { singular: 'cosa', plural: 'cosas' });
    fixture.componentRef.setInput('grupos', [
      { id: 'g', nombre: '', resultados: [{ id: '1', title: 'Uno', link: '/uno' }] },
    ]);
    fixture.detectChanges();
    return fixture;
  }

  const botones = (f: ReturnType<typeof montar>) =>
    Array.from<HTMLButtonElement>(f.nativeElement.querySelectorAll('.directorio__vista'));

  it('arranca en grilla y cambia a lista al pulsar, recordándolo', () => {
    const f = montar();
    const [grilla, lista] = botones(f);
    expect(grilla!.getAttribute('aria-pressed')).toBe('true');

    lista!.click();
    f.detectChanges();

    expect(lista!.getAttribute('aria-pressed')).toBe('true');
    expect(f.nativeElement.querySelector('.directorio__grilla--lista')).not.toBeNull();
    expect(f.nativeElement.querySelector('li.tarjeta-resultado--lista')).not.toBeNull();
    expect(localStorage.getItem(CLAVE)).toBe('lista');
  });

  it('respeta la vista guardada', () => {
    localStorage.setItem(CLAVE, 'lista');
    const f = montar();
    expect(botones(f)[1]!.getAttribute('aria-pressed')).toBe('true');
  });

  /* Propietario, 04/10/2026: el directorio de médicos abre en filas. */
  it('un directorio puede abrir en lista por defecto, con su propia memoria', () => {
    const claveMedicos = 'alovida.directorio.vista.medicos';
    localStorage.removeItem(claveMedicos);
    // Una grilla elegida en otro directorio no arrastra a éste.
    localStorage.setItem(CLAVE, 'grilla');
    const f = montar({ vistaPorDefecto: 'lista', claveDeVista: claveMedicos });
    f.detectChanges();

    expect(botones(f)[1]!.getAttribute('aria-pressed')).toBe('true');
    expect(f.nativeElement.querySelector('li.tarjeta-resultado--lista')).not.toBeNull();
    localStorage.removeItem(claveMedicos);
  });
});

describe('DirectoryPage · tope progresivo', () => {
  /** `cuantos` resultados repartidos en grupos de `porGrupo`. */
  function grupos(cuantos: number, porGrupo: number) {
    const lista = [];
    for (let inicio = 0; inicio < cuantos; inicio += porGrupo) {
      const resultados = [];
      for (let i = inicio; i < Math.min(inicio + porGrupo, cuantos); i++) {
        resultados.push({ id: String(i), title: `Resultado ${i}`, link: `/r/${i}` });
      }
      lista.push({ id: `g${inicio}`, nombre: `Grupo ${inicio}`, resultados });
    }
    return lista;
  }

  function montar(cuantos: number, porGrupo = cuantos) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(DirectoryPage);
    fixture.componentRef.setInput('titulo', 'Directorio de médicos');
    fixture.componentRef.setInput('subtitulo', 'Sub');
    fixture.componentRef.setInput('estado', { kind: 'ready', data: null });
    fixture.componentRef.setInput('sustantivo', { singular: 'médico', plural: 'médicos' });
    fixture.componentRef.setInput('grupos', grupos(cuantos, porGrupo));
    fixture.detectChanges();
    return fixture;
  }

  const tarjetas = (f: ReturnType<typeof montar>) =>
    f.nativeElement.querySelectorAll('li.tarjeta-resultado').length;
  const paginador = (f: ReturnType<typeof montar>): HTMLElement | null =>
    f.nativeElement.querySelector('app-pagination');
  const irA = (f: ReturnType<typeof montar>, etiqueta: string) => {
    f.nativeElement.querySelector(`button[aria-label="${etiqueta}"]`).click();
    f.detectChanges();
  };
  const cuenta = (f: ReturnType<typeof montar>) =>
    f.nativeElement.querySelector('.directorio__cuenta').textContent;

  /* La guía real tenía 804 y las dibujaba todas: 190 000 px de página. */
  it('dibuja una página de 24 y dice qué tramo es del total', () => {
    const f = montar(804);

    expect(tarjetas(f)).toBe(24);
    expect(cuenta(f)).toContain('1–24 de 804 médicos');
    expect(paginador(f)).not.toBeNull();
  });

  it('«Siguiente» cambia de página: reemplaza las tarjetas, no las acumula', () => {
    const f = montar(804);
    irA(f, 'Página siguiente');

    expect(tarjetas(f)).toBe(24);
    expect(cuenta(f)).toContain('25–48 de 804 médicos');
  });

  it('la última página trae sólo las que faltan', () => {
    const f = montar(30);
    irA(f, 'Página siguiente');

    expect(tarjetas(f)).toBe(6);
    expect(cuenta(f)).toContain('25–30 de 30 médicos');
  });

  it('con una sola página no hay paginador', () => {
    const f = montar(5);
    expect(tarjetas(f)).toBe(5);
    expect(paginador(f)).toBeNull();
  });

  it('cambiar los grupos vuelve a la primera página', () => {
    const f = montar(60);
    irA(f, 'Página siguiente');
    expect(cuenta(f)).toContain('25–48');

    f.componentRef.setInput('grupos', grupos(60, 60));
    f.detectChanges();
    expect(cuenta(f)).toContain('1–24 de 60');
  });

  // Marketplace (propietario, 23/10/2026): los grupos ya no cortan la grilla
  // en bandas; son una faceta de la columna con su cantidad.
  it('los grupos no cortan la grilla: son una faceta que acota', () => {
    const f = montar(40, 20);
    expect(f.nativeElement.querySelector('.directorio__rotulo')).toBeNull();
    expect(f.nativeElement.querySelectorAll('ul.directorio__grilla').length).toBe(1);

    const opciones = Array.from<HTMLButtonElement>(
      f.nativeElement.querySelectorAll('.mercado__opcion'),
    );
    expect(
      opciones.map((o) =>
        Array.from(o.querySelectorAll('span'))
          .map((span) => span.textContent!.trim())
          .join(' '),
      ),
    ).toEqual(['Ver todo', 'Grupo 0 20', 'Grupo 20 20']);

    opciones[2]!.click();
    f.detectChanges();
    expect(tarjetas(f)).toBe(20);
    expect(f.nativeElement.querySelector('.directorio__cuenta').textContent).toContain(
      '20 médicos',
    );
  });

  it('ordena por nombre al elegirlo en «Ordenar por»', () => {
    const f = montar(3);
    const select = f.nativeElement.querySelector('.mercado__orden select') as HTMLSelectElement;
    select.value = 'nombre-desc';
    select.dispatchEvent(new Event('change'));
    f.detectChanges();

    const titulos = Array.from<HTMLElement>(
      f.nativeElement.querySelectorAll('.tarjeta-resultado__titulo a'),
    ).map((a) => a.textContent!.trim());
    expect(titulos).toEqual(['Resultado 2', 'Resultado 1', 'Resultado 0']);
  });

  it('dice el rango cuando no entran todas: «1–24 de 804»', () => {
    const f = montar(804);
    expect(f.nativeElement.querySelector('.directorio__cuenta').textContent).toContain(
      '1–24 de 804 médicos',
    );
  });

  // Con reseñas en las tarjetas, el directorio ofrece ordenar por ellas.
  it('«Mejor puntuación» pone primero la nota más alta y al final las sin reseñas', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const f = TestBed.createComponent(DirectoryPage);
    f.componentRef.setInput('titulo', 'Directorio');
    f.componentRef.setInput('subtitulo', 'Sub');
    f.componentRef.setInput('estado', { kind: 'ready', data: null });
    f.componentRef.setInput('sustantivo', { singular: 'clínica', plural: 'clínicas' });
    f.componentRef.setInput('grupos', [
      {
        id: 'g',
        nombre: '',
        resultados: [
          { id: 'a', title: 'Sin nota', link: '/a' },
          { id: 'b', title: 'Tres siete', link: '/b', rating: { average: 3.7, count: 60 } },
          { id: 'c', title: 'Cuatro cinco', link: '/c', rating: { average: 4.5, count: 60 } },
        ],
      },
    ]);
    f.detectChanges();

    const select = f.nativeElement.querySelector('.mercado__orden select') as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toContain('Mejor puntuación');
    select.value = 'calificacion';
    select.dispatchEvent(new Event('change'));
    f.detectChanges();

    const titulos = Array.from<HTMLElement>(
      f.nativeElement.querySelectorAll('.tarjeta-resultado__titulo a'),
    ).map((a) => a.textContent!.trim());
    expect(titulos).toEqual(['Cuatro cinco', 'Tres siete', 'Sin nota']);
  });

  describe('órdenes por cifra y por reseñas', () => {
    function montarConCifras(entradas: Record<string, unknown> = {}) {
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      const f = TestBed.createComponent(DirectoryPage);
      f.componentRef.setInput('titulo', 'Directorio de médicos');
      f.componentRef.setInput('subtitulo', 'Sub');
      f.componentRef.setInput('estado', { kind: 'ready', data: null });
      f.componentRef.setInput('sustantivo', { singular: 'médico', plural: 'médicos' });
      for (const [nombre, valor] of Object.entries(entradas)) {
        f.componentRef.setInput(nombre, valor);
      }
      f.componentRef.setInput('grupos', [
        {
          id: 'g',
          nombre: '',
          resultados: [
            { id: 'a', title: 'Sin datos', link: '/a' },
            {
              id: 'b',
              title: 'Pocas consultas',
              link: '/b',
              stats: { encuentros: 3 },
              rating: { average: 4.9, count: 2 },
            },
            {
              id: 'c',
              title: 'Muchas consultas',
              link: '/c',
              stats: { encuentros: 120 },
              rating: { average: 4.1, count: 30 },
            },
            { id: 'd', title: 'Cero consultas', link: '/d', stats: { encuentros: 0 } },
          ],
        },
      ]);
      f.detectChanges();
      return f;
    }

    const select = (f: ReturnType<typeof montarConCifras>) =>
      f.nativeElement.querySelector('.mercado__orden select') as HTMLSelectElement;

    function ordenarPor(f: ReturnType<typeof montarConCifras>, valor: string): string[] {
      const s = select(f);
      s.value = valor;
      s.dispatchEvent(new Event('change'));
      f.detectChanges();
      return Array.from<HTMLElement>(
        f.nativeElement.querySelectorAll('.tarjeta-resultado__titulo a'),
      ).map((a) => a.textContent!.trim());
    }

    it('ofrece los criterios que declara el directorio, entre la nota y el nombre', () => {
      const f = montarConCifras({
        criteriosDeOrden: [{ clave: 'encuentros', etiqueta: 'Más encuentros atendidos' }],
      });
      expect([...select(f).options].map((o) => o.text.trim())).toEqual([
        'Predeterminado',
        'Mejor puntuación',
        'Más reseñas',
        'Más encuentros atendidos',
        'Nombre: de la A a la Z',
        'Nombre: de la Z a la A',
      ]);
    });

    it('un criterio ordena de mayor a menor y deja al final a quien no tiene el dato', () => {
      const f = montarConCifras({
        criteriosDeOrden: [{ clave: 'encuentros', etiqueta: 'Más encuentros atendidos' }],
      });
      expect(ordenarPor(f, 'cifra:encuentros')).toEqual([
        'Muchas consultas',
        'Pocas consultas',
        'Cero consultas',
        'Sin datos',
      ]);
    });

    it('«Más reseñas» manda por la cantidad, no por la nota', () => {
      const f = montarConCifras();
      expect(ordenarPor(f, 'resenas')).toEqual([
        'Muchas consultas',
        'Pocas consultas',
        'Sin datos',
        'Cero consultas',
      ]);
    });

    it('un valor que no es una opción no cambia el orden', () => {
      const f = montarConCifras();
      expect(ordenarPor(f, 'cifra:inventada')).toEqual([
        'Sin datos',
        'Pocas consultas',
        'Muchas consultas',
        'Cero consultas',
      ]);
    });
  });

  // La guía de médicos: nadie opinó todavía y el orden se ofrece igual.
  it('un directorio calificable ofrece la puntuación aunque nadie haya opinado', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const f = TestBed.createComponent(DirectoryPage);
    f.componentRef.setInput('titulo', 'Directorio');
    f.componentRef.setInput('subtitulo', 'Sub');
    f.componentRef.setInput('estado', { kind: 'ready', data: null });
    f.componentRef.setInput('sustantivo', { singular: 'médico', plural: 'médicos' });
    f.componentRef.setInput('grupos', [
      { id: 'g', nombre: '', resultados: [{ id: 'a', title: 'Sin nota', link: '/a' }] },
    ]);
    f.detectChanges();
    const opciones = () =>
      [
        ...(f.nativeElement.querySelector('.mercado__orden select') as HTMLSelectElement).options,
      ].map((o) => o.text.trim());
    expect(opciones()).not.toContain('Mejor puntuación');

    f.componentRef.setInput('calificable', true);
    f.detectChanges();
    expect(opciones()).toContain('Mejor puntuación');
    expect(opciones()).toContain('Más reseñas');
  });
});
