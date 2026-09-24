import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { BehaviorSubject } from 'rxjs';

import { PractitionersDirectory, type GrupoDeEspecialidad } from './practitioners-directory';

/**
 * La guía de profesionales (carril R2-1).
 *
 * El cliente pidió una **guía telefónica agrupada por especialidad**, y el
 * carril fija tres cosas que se cumplen literal o el punto no está hecho.
 * Estas pruebas son esas tres, más lo que degrada:
 *
 * 1. **Están todos**: se agota el cursor al abrir, sin escribir nada.
 * 2. **La especialidad es el encabezado**, y quien ejerce dos aparece en las
 *    dos — es lo que hace una guía.
 * 3. El buscador **filtra encima**, nunca es la puerta de entrada.
 */

const FILA = {
  profileId: 'per-1',
  practitionerCode: 'MED-1',
  displayName: 'Dra. Lucía Salas',
  professionalTitle: 'Cardióloga',
  verificationStatusConceptId: 'st-ok',
  verified: true,
  acceptsNewPatients: true,
  telehealthAvailable: false,
  specialties: [{ specialtyConceptId: 'esp-cardio', isPrimary: true }],
  workplaces: ['Clínica Foianini', 'Hospital San Juan de Dios'],
};

const OTRA = {
  ...FILA,
  profileId: 'per-2',
  practitionerCode: 'MED-2',
  displayName: 'Dr. Andrés Peña',
  professionalTitle: 'Pediatra',
  acceptsNewPatients: false,
  specialties: [{ specialtyConceptId: 'esp-pediatria', isPrimary: true }],
};

const CONCEPTOS = {
  items: [
    {
      conceptId: 'esp-cardio',
      code: 'CARDIOLOGY',
      display: 'Cardiología',
      codeSystemVersionId: 'csv-1',
    },
    {
      conceptId: 'esp-pediatria',
      code: 'PEDIATRICS',
      display: 'Pediatría',
      codeSystemVersionId: 'csv-1',
    },
  ],
  count: 2,
  limit: 200,
};

describe('PractitionersDirectory', () => {
  let componente: PractitionersDirectory;
  let http: HttpTestingController;
  let router: Router;
  /**
   * Los parámetros de la URL, empujables desde la prueba.
   *
   * La pantalla decide portada o lista mirando `?especialidad=`, así que el
   * parámetro es una entrada del componente tanto como sus inputs: se declara
   * al configurar el módulo —después ya no se puede— y cada prueba empuja el
   * suyo antes de montar.
   */
  let parametros: BehaviorSubject<Record<string, string>>;

  beforeEach(() => {
    parametros = new BehaviorSubject<Record<string, string>>({});
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParams: parametros } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  function montar(): void {
    // `detectChanges` y no sólo `createComponent`: la lectura la dispara un
    // `effect` sobre el parámetro de la URL —para que cambiar de especialidad
    // recargue sin recrear la pantalla—, y los efectos no corren hasta la
    // primera detección.
    const fixture = TestBed.createComponent(PractitionersDirectory);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  /**
   * Monta la pantalla **dentro de una especialidad**, que es donde vive la
   * lista. Sin `?especialidad=` la pantalla es la portada y no pide la guía:
   * ésa es justamente la diferencia que introdujo el grid.
   */
  function montarEnEspecialidad(id = 'esp-cardio'): void {
    parametros.next({ especialidad: id });
    montar();
  }

  /** Responde el recuento que dibuja la portada. */
  function responderRecuento(
    items: { specialtyConceptId: string; practitionerCount: number }[],
    practitionerTotal = items.reduce((s, i) => s + i.practitionerCount, 0),
    withoutSpecialtyCount = 0,
  ): void {
    http
      .expectOne((r) => r.url === '/profiles/practitioners/specialty-counts')
      .flush({ items, practitionerTotal, withoutSpecialtyCount });
  }

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  /**
   * Una señal escribible del componente.
   *
   * Aparte de `interno` porque aquél **liga** lo que devuelve, y una señal es
   * una función: `bind()` produce una copia sin `.set`.
   */
  function senal<T>(nombre: string): { (): T; set(valor: T): void } {
    return (componente as unknown as Record<string, { (): T; set(valor: T): void }>)[nombre];
  }

  function grupos(): readonly GrupoDeEspecialidad[] {
    return interno<() => readonly GrupoDeEspecialidad[]>('grupos')();
  }

  /**
   * Cuántos profesionales quedan tras filtrar.
   *
   * Se cuenta acá y ya no en el componente: el contador se mudó al patrón común
   * de directorio (A7 del plan de UX), y dejar en la pantalla un `computed` que
   * sólo usan las pruebas es peor que sumarlo en dos líneas.
   */
  function total(): number {
    return grupos().reduce((suma, grupo) => suma + grupo.profesionales.length, 0);
  }

  /** Responde una página de la guía y después el catálogo. */
  function responder(items: object[], nextCursor: string | null = null): void {
    http
      .expectOne((r) => r.url === '/profiles/practitioners')
      .flush({ items, count: items.length, limit: 50, nextCursor });
  }

  function responderConceptos(conceptos: object = CONCEPTOS): void {
    http.expectOne((r) => r.url === '/terminology/concepts').flush(conceptos);
  }

  /* -- 0 · La portada de especialidades ------------------------------------ */

  /**
   * El pedido de la bitácora: «un grid de especialidades que al darle click
   * despliega la lista de doctores». Lo que estas pruebas fijan es el ahorro
   * que lo justifica —la portada NO trae la guía— y que las tarjetas no
   * prometan lo que no hay.
   */
  describe('portada de especialidades', () => {
    it('sin especialidad elegida dibuja las tarjetas y NO pide la guía', () => {
      montar();

      responderRecuento([
        { specialtyConceptId: 'esp-cardio', practitionerCount: 12 },
        { specialtyConceptId: 'esp-pediatria', practitionerCount: 1 },
      ]);
      responderConceptos();

      // Lo que esta pantalla vino a evitar: paginar la guía entera para contar.
      http.expectNone((r) => r.url === '/profiles/practitioners');

      const tarjetas = interno<() => readonly { nombre: string; cantidad: number }[]>('tarjetas')();
      expect(tarjetas).toEqual([
        { conceptId: 'esp-cardio', nombre: 'Cardiología', cantidad: 12 },
        { conceptId: 'esp-pediatria', nombre: 'Pediatría', cantidad: 1 },
      ]);
    });

    it('el total no es la suma de las tarjetas: quien ejerce dos cuenta una vez', () => {
      montar();

      // 12 + 1 = 13 tarjetas, pero hay 10 personas: tres ejercen las dos.
      responderRecuento(
        [
          { specialtyConceptId: 'esp-cardio', practitionerCount: 12 },
          { specialtyConceptId: 'esp-pediatria', practitionerCount: 1 },
        ],
        10,
      );
      responderConceptos();

      expect(interno<() => number>('totalDeProfesionales')()).toBe(10);
    });

    /**
     * El defecto que introdujo la portada: la guía se recorre por especialidad,
     * y quien se registra solo nace SIN ninguna. Sin esta tarjeta, los médicos
     * con cuenta —los que atienden por la app— quedaban inalcanzables.
     */
    it('ofrece una tarjeta para los que no declaran especialidad', () => {
      montar();
      responderRecuento([{ specialtyConceptId: 'esp-cardio', practitionerCount: 12 }], 20, 8);
      responderConceptos();

      const tarjetas =
        interno<() => readonly { conceptId: string; cantidad: number }[]>('tarjetas')();
      const sinEspecialidad = tarjetas.at(-1);
      expect(sinEspecialidad).toEqual({
        conceptId: 'sin-especialidad',
        nombre: 'Sin especialidad declarada',
        cantidad: 8,
      });
    });

    it('sin nadie sin especialidad, esa tarjeta no aparece', () => {
      montar();
      responderRecuento([{ specialtyConceptId: 'esp-cardio', practitionerCount: 12 }], 12, 0);
      responderConceptos();

      const tarjetas = interno<() => readonly { conceptId: string }[]>('tarjetas')();
      expect(tarjetas.map((t) => t.conceptId)).toEqual(['esp-cardio']);
    });

    it('esa tarjeta pide el complemento al servidor, no una especialidad', () => {
      montarEnEspecialidad('sin-especialidad');

      const peticion = http.expectOne((r) => r.url === '/profiles/practitioners');
      expect(peticion.request.params.get('withoutSpecialty')).toBe('true');
      expect(peticion.request.params.has('specialtyConceptId')).toBe(false);
      peticion.flush({ items: [FILA], count: 1, limit: 50, nextCursor: null });
      responderConceptos();
    });

    it('abre una especialidad una sola vez ante cuatro activaciones rápidas', () => {
      montar();
      responderRecuento([{ specialtyConceptId: 'esp-cardio', practitionerCount: 12 }]);
      responderConceptos();
      const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const evento = new MouseEvent('click', { bubbles: true, cancelable: true });
      const abrir = interno<(evento: MouseEvent, conceptId: string) => void>('abrirEspecialidad');

      for (let indice = 0; indice < 4; indice += 1) {
        abrir(evento, 'esp-cardio');
      }

      expect(evento.defaultPrevented).toBe(true);
      expect(navegar).toHaveBeenCalledTimes(1);
    });

    it('con especialidad en la URL no dibuja la portada: va derecho a la lista', () => {
      montarEnEspecialidad('esp-cardio');

      // Ni una lectura del recuento: la portada no se muestra.
      http.expectNone((r) => r.url === '/profiles/practitioners/specialty-counts');
      responder([FILA]);
      responderConceptos();

      expect(interno<() => boolean>('enPortada')()).toBe(false);
    });

    /**
     * La mitad del ahorro: dentro de una especialidad se piden SUS
     * profesionales, no los de toda la red para después filtrar en memoria.
     */
    it('la lista de una especialidad la acota el servidor', () => {
      montarEnEspecialidad('esp-cardio');

      const peticion = http.expectOne((r) => r.url === '/profiles/practitioners');
      expect(peticion.request.params.get('specialtyConceptId')).toBe('esp-cardio');
      peticion.flush({ items: [FILA], count: 1, limit: 50, nextCursor: null });
      responderConceptos();
    });
  });

  /**
   * Fila 30 de la bitácora: «cada uno con los botones de REVISAR
   * DISPONIBILIDAD». El título ya lleva a la ficha; esto tiene que llevar a los
   * horarios, que es donde se compara a dos profesionales.
   */
  it('cada tarjeta ofrece revisar la disponibilidad, anclada en los horarios', () => {
    montarEnEspecialidad();
    responder([FILA]);
    responderConceptos();

    const tarjeta = grupos()[0].profesionales[0];
    expect(tarjeta.action).toEqual({
      label: 'Revisar disponibilidad',
      link: '/directory/per-1',
      fragment: 'horarios',
    });
    // Mismo destino que el título, distinta altura: sin el ancla serían dos
    // enlaces al mismo lugar.
    expect(tarjeta.action?.link).toBe(tarjeta.link);
  });

  /**
   * La guía lista el padrón entero —un perfil nace pendiente por diseño, y
   * verificarlo exige que una autoridad valide la matrícula—, así que el sello
   * es lo único que distingue a quien probó lo que declara.
   */
  it('marca al verificado y no estampa nada al que todavía no lo está', () => {
    montarEnEspecialidad();
    responder([FILA, { ...OTRA, verified: false }]);
    responderConceptos();

    const todos = grupos().flatMap((g) => g.profesionales);
    const conSello = todos.find((p) => p.id === 'per-1');
    const sinSello = todos.find((p) => p.id === 'per-2');

    expect(conSello?.seals?.map((s) => s.label)).toContain('Matrícula verificada');
    // Al pendiente no se le estampa «sin verificar»: eso diría de él algo que
    // no es suyo, y el padrón lo publica igual.
    expect(sinSello?.seals?.map((s) => s.label) ?? []).not.toContain('Matrícula verificada');
    expect(sinSello?.seals?.map((s) => s.label).join(' ') ?? '').not.toContain('verificar');
  });

  it('la tarjeta dice dónde atiende, y resume cuando son muchas', () => {
    montarEnEspecialidad();
    responder([
      FILA,
      {
        ...OTRA,
        workplaces: ['Clínica A', 'Clínica B', 'Clínica C', 'Hospital D'],
      },
    ]);
    responderConceptos();

    const todos = grupos().flatMap((g) => g.profesionales);
    const conDos = todos.find((p) => p.id === 'per-1');
    const conCuatro = todos.find((p) => p.id === 'per-2');

    expect(conDos?.meta?.map((m) => m.text).join(' | ')).toContain(
      'Clínica Foianini · Hospital San Juan de Dios',
    );
    // Con más de dos, la tarjeta nombra dos y CUENTA el resto: si las listara
    // todas dejaría de poder compararse de un vistazo.
    const texto = conCuatro?.meta?.map((m) => m.text).join(' | ') ?? '';
    expect(texto).toContain('Clínica A · Clínica B · y 2 sedes más');
    expect(texto).not.toContain('Hospital D');
  });

  /* -- 1 · Están todos, sin escribir nada ---------------------------------- */

  it('carga la guía al abrir, sin que nadie escriba nada', () => {
    montarEnEspecialidad();
    responder([FILA, OTRA]);
    responderConceptos();

    expect(grupos()).toHaveLength(2);
    expect(total()).toBe(2);
  });

  /**
   * «Todos los doctores» significa agotar el cursor: con una sola página la
   * guía mostraría los primeros cincuenta y nada más.
   */
  it('agota el cursor: sigue pidiendo mientras haya páginas', () => {
    montarEnEspecialidad();
    responder([FILA], 'cursor-2');
    responder([OTRA], null);
    responderConceptos();

    expect(total()).toBe(2);
  });

  // ALV-013: una misma persona, una sola tarjeta — aunque el servidor la
  // devuelva en dos páginas (cursor reutilizado, fila que cambió de orden).
  it('si la misma persona viene en dos páginas, la pinta una sola vez', () => {
    montarEnEspecialidad();
    responder([FILA], 'cursor-2');
    responder([FILA], null);
    responderConceptos();

    expect(total()).toBe(1);
  });

  /* -- 2 · La especialidad es el encabezado -------------------------------- */

  it('agrupa por especialidad con su nombre traducido', () => {
    montarEnEspecialidad();
    responder([FILA, OTRA]);
    responderConceptos();

    const nombres = grupos().map((g) => g.nombre);
    // Alfabético: una guía se hojea, no se ordena por cuántos tiene cada una.
    expect(nombres).toEqual(['Cardiología', 'Pediatría']);
  });

  /**
   * F-25 (18/08/2026): tres tarjetas de la Guía mostraban como subtítulo el
   * nombre de OTRO profesional. El dato cruzado lo arregla FX-4 en el seeder;
   * este es el guardia de la vista, que no depende de eso.
   */
  it('una tarjeta nunca muestra el nombre de otro como subtítulo (F-25)', () => {
    montarEnEspecialidad();
    responder([
      {
        ...FILA,
        displayName: 'Ana Lucía Flores',
        professionalTitle: 'Dr. Andrés Peña — Pediatría',
      },
      OTRA,
    ]);
    responderConceptos();

    const tarjetas = grupos().flatMap((g: GrupoDeEspecialidad) => g.profesionales);
    const cruzada = tarjetas.find((t) => t.title === 'Ana Lucía Flores');

    expect(cruzada, 'la tarjeta cruzada debería estar en la guía').toBeDefined();
    // Sin subtítulo: más pobre, pero no miente sobre quién es quién. Se
    // comprueba que NO esté el nombre ajeno en ninguna parte visible de la
    // tarjeta —ni en el subtítulo ni en las líneas de contexto—, y no que la
    // tarjeta se quede vacía: desde que dice dónde atiende, «sin meta» y «sin
    // subtítulo» dejaron de ser lo mismo.
    const visible = [cruzada?.subtitle ?? '', ...(cruzada?.meta ?? []).map((m) => m.text)].join(
      ' | ',
    );
    expect(visible).not.toContain('Andrés Peña');
    // Y el resto conserva el suyo, que es legítimo. Va en `subtitle` y ya no en
    // la primera línea de `meta`: es qué es esta persona, no un dato de
    // contexto, y la tarjeta lo pinta pegado al nombre.
    const sana = tarjetas.find((t) => t.title === 'Dr. Andrés Peña');
    expect(sana?.subtitle).toBe('Pediatra');
  });

  /** Quien ejerce dos especialidades figura bajo las dos. */
  it('un profesional con dos especialidades aparece en las dos', () => {
    montarEnEspecialidad();
    responder([
      {
        ...FILA,
        specialties: [
          { specialtyConceptId: 'esp-cardio', isPrimary: true },
          { specialtyConceptId: 'esp-pediatria', isPrimary: false },
        ],
      },
    ]);
    responderConceptos();

    expect(grupos()).toHaveLength(2);
    for (const grupo of grupos()) {
      expect(grupo.profesionales.map((p) => p.id)).toContain('per-1');
    }
  });

  /** Sin especialidad declarada existe igual: va a un grupo propio, al final. */
  it('quien no declara especialidad va a un grupo propio al final', () => {
    montarEnEspecialidad();
    responder([FILA, { ...OTRA, specialties: [] }]);
    responderConceptos();

    const ultimo = grupos().at(-1);
    expect(ultimo?.conceptId).toBe('sin-especialidad');
    expect(ultimo?.profesionales.map((p) => p.id)).toEqual(['per-2']);
  });

  /** El catálogo caído deja los encabezados sin nombre, no la guía sin gente. */
  it('un fallo del catálogo no deja a nadie fuera de la guía', () => {
    montarEnEspecialidad();
    responder([FILA]);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .error(new ProgressEvent('error'), { status: 500, statusText: 'Server Error' });

    expect(total()).toBe(1);
    expect(grupos()[0].nombre).toBe('Sin especialidad registrada');
  });

  /* -- 3 · El buscador filtra encima --------------------------------------- */

  it('el buscador filtra la guía ya cargada, por nombre', () => {
    montarEnEspecialidad();
    responder([FILA, OTRA]);
    responderConceptos();

    senal<string>('filtro').set('lucía');

    expect(grupos()).toHaveLength(1);
    expect(grupos()[0].profesionales[0].title).toBe('Dra. Lucía Salas');
  });

  /**
   * F-19/F-27: la especialidad es el encabezado de la grilla, y buscarla tiene
   * que traer a quienes la ejercen aunque su nombre no la mencione.
   */
  it('el buscador también encuentra por especialidad, con el grupo entero', () => {
    montarEnEspecialidad();
    responder([FILA, OTRA]);
    responderConceptos();

    senal<string>('filtro').set('cardio');

    const encontrados = grupos();
    expect(encontrados).toHaveLength(1);
    expect(encontrados[0].nombre).toBe('Cardiología');
    expect(encontrados[0].profesionales).toHaveLength(1);
  });

  it('el buscador también encuentra por el título profesional', () => {
    montarEnEspecialidad();
    responder([FILA, OTRA]);
    responderConceptos();

    senal<string>('filtro').set('pediatra');

    expect(total()).toBe(1);
  });

  it('el buscador encuentra por ESPECIALIDAD, que es el encabezado y no un dato de la tarjeta', () => {
    montarEnEspecialidad();
    responder([FILA, OTRA]);
    responderConceptos();

    // El placeholder promete buscar por especialidad. Antes no la miraba: la
    // especialidad es el encabezado del grupo, no una línea de la tarjeta, así
    // que «pediatría» sólo encontraba a quien lo tuviera en el título libre.
    senal<string>('filtro').set('pediatría');

    expect(grupos()).toHaveLength(1);
    expect(grupos()[0].nombre).toBe('Pediatría');
    expect(grupos()[0].profesionales).toHaveLength(1);
  });

  it('el buscador ignora las tildes: nadie las escribe', () => {
    montarEnEspecialidad();
    responder([FILA, OTRA]);
    responderConceptos();

    senal<string>('filtro').set('cardiologia');

    expect(grupos()).toHaveLength(1);
    expect(grupos()[0].nombre).toBe('Cardiología');
  });

  it('el grupo que casa entra ENTERO, aunque nadie coincida por nombre', () => {
    montarEnEspecialidad();
    // Dos cardiólogos con nombres que no tienen nada que ver con «cardio».
    responder([FILA, { ...FILA, profileId: 'per-3', displayName: 'Dr. Juan Vera' }]);
    responderConceptos();

    senal<string>('filtro').set('cardio');

    expect(total()).toBe(2);
  });

  it('el código interno del profesional no se muestra ni filtra: el paciente no lo conoce', () => {
    // Feedback de la analista (F-01, 18/08/2026): las tarjetas decían
    // «Código MED-…». Es un identificador de sistema; la Guía es sólo del
    // paciente y no hay a quién mostrárselo por rol. El DTO lo sigue trayendo.
    montarEnEspecialidad();
    responder([FILA, OTRA]);
    responderConceptos();

    const lineas = grupos().flatMap((g) => g.profesionales.flatMap((p) => p.meta ?? []));
    expect(lineas.some((linea) => /MED-|Código/.test(linea.text))).toBe(false);

    senal<string>('filtro').set('med-1');
    expect(total()).toBe(0);
  });

  /**
   * Sin coincidencias NO es lo mismo que sin guía: el estado vacío tiene que
   * poder decir cuál de los dos es.
   */
  it('distingue «el filtro no encontró» de «no hay guía»', () => {
    montarEnEspecialidad();
    responder([FILA]);
    responderConceptos();

    // Ahora devuelve **el texto** en vez de un booleano: el patrón común de
    // directorio muestra lo que se le pase, y quién sabe qué decir es la
    // pantalla que sabe qué se estaba buscando. `null` = no es ese caso.
    expect(interno<() => string | null>('sinCoincidencias')()).toBeNull();

    senal<string>('filtro').set('nadie con este nombre');

    expect(interno<() => string | null>('sinCoincidencias')()).toContain('nadie con este nombre');
  });

  /* -- La traducción a la tarjeta ------------------------------------------ */

  it('la tarjeta no estampa la disponibilidad para pacientes nuevos', () => {
    montarEnEspecialidad();
    responder([FILA, OTRA]);
    responderConceptos();

    const sellos = (etiqueta: string) =>
      grupos()
        .flatMap((g) => g.profesionales)
        .flatMap((p) => p.seals ?? [])
        .some((s) => s.label === etiqueta);

    // El sello salía en TODA tarjeta, y en la de quien nunca tocó el ajuste
    // anunciaba «No toma pacientes nuevos» de gente que sí los toma.
    expect(sellos('Acepta pacientes nuevos')).toBe(false);
    expect(sellos('No toma pacientes nuevos')).toBe(false);
    // Los sellos que sí distinguen siguen en pie.
    expect(sellos('Matrícula verificada')).toBe(true);
  });

  it('el clic lleva a la ficha del profesional', () => {
    montarEnEspecialidad();
    responder([FILA]);
    responderConceptos();

    expect(grupos()[0].profesionales[0].link).toBe('/directory/per-1');
  });
});
