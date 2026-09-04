import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AuthService } from '../../../../../core/auth/auth.service';
import { PractitionerProfileView } from './practitioner-profile-view';
import type {
  AfiliacionVisible,
  PerfilProfesionalVisible,
} from './practitioner-profile-view.types';

/**
 * La vista del perfil profesional — presentacional pura (carriles R2-4 y 05).
 *
 * Se prueba con **datos fijos, sin `HttpTestingController` propio**: la vista
 * no inyecta ningún cliente. La única excepción es cuando `esPropio=true`,
 * porque ahí se embebe `<app-work-history>` (formulario de alta de
 * trayectoria) — que sí llama a la API — y hay que darle por dónde responder.
 *
 * Lo que se fija:
 *
 * 1. **Las 3 pestañas del carril 05**: Trayectoria, Credenciales y
 *    verificaciones, Vista previa (sólo para el dueño).
 * 2. **Declarado vs. verificado**: la pestaña Credenciales separa lo
 *    verificado de lo declarado, sin inventar un campo nuevo — lo deriva de
 *    lo que ya trae el perfil.
 * 3. **La vista previa es el MISMO componente**, en modo ajeno: no un mock
 *    aparte, y no vuelve a ofrecerse a sí misma dentro de sí misma.
 * 4. **Los casos vacíos hablan**: sin actividad actual, sin experiencia
 *    histórica, sin nada verificado — cada uno con su propio texto.
 * 5. **`esPropio` decide las acciones y el formulario de alta**; un visitante
 *    no ve ninguno de los dos.
 */

function afiliacion(over: Partial<AfiliacionVisible> = {}): AfiliacionVisible {
  return {
    id: 'af-1',
    organizacion: 'Hospital Obrero N.º 1',
    cargo: 'Médica de planta',
    area: '',
    desde: new Date('2012-01-01'),
    hasta: new Date('2016-01-01'),
    actual: false,
    ...over,
  };
}

const PERFIL: PerfilProfesionalVisible = {
  nombre: 'Dra. Lucía Salas',
  titulo: 'Médica cardióloga',
  especialidadPrincipal: 'Cardiología',
  codigo: 'MED-7',
  fotoUrl: null,
  verificacion: { label: 'Verificada', variant: 'approved' },
  estadoDePractica: 'En ejercicio',
  aceptaPacientesNuevos: true,
  telemedicina: true,
  bio: 'Quince años en cardiología clínica.',
  actividad: [
    { clave: 'encuentros', rotulo: 'Encuentros atendidos', valor: 12 },
    { clave: 'documentos', rotulo: 'Documentos publicados', valor: 2 },
  ],
  especialidades: [
    {
      id: 'sp-1',
      nombre: 'Cardiología',
      principal: true,
      certificada: true,
      alcance: '',
      desde: new Date('2015-03-01'),
      hasta: null,
      estado: 'Verificada',
      sello: 'approved',
    },
    {
      id: 'sp-2',
      nombre: 'Medicina interna',
      principal: false,
      certificada: false,
      alcance: '',
      desde: new Date('2015-03-01'),
      hasta: null,
      estado: 'Pendiente',
      sello: 'in-review',
    },
  ],
  formacion: [
    {
      id: 'cr-1',
      tipo: 'Título de grado',
      numero: 'TIT-9',
      institucion: 'UMSA',
      desde: new Date('2010-12-01'),
      hasta: null,
      estado: 'Verificada',
      sello: 'approved',
      vencida: false,
      fuenteVerificacion: 'https://registro-profesional.test/matriculas/LIC-3',
    },
  ],
  matriculas: [
    {
      id: 'li-1',
      jurisdiccion: 'Nacional',
      numero: 'LIC-3',
      autoridad: 'Colegio Médico',
      estado: 'Verificada',
      sello: 'approved',
      hasta: null,
    },
  ],
  idiomas: [{ id: 'idi-es', nombre: 'Español', nivel: '', interpreta: true }],
  // Sin datos personales por defecto: es la ficha de un colega, que es lo que
  // miran casi todas estas pruebas. Las que hablan del bloque lo declaran.
  datosPersonales: null,
  actividadActual: [
    afiliacion({ id: 'af-2', organizacion: 'Sede Central Sopocachi', hasta: null, actual: true }),
  ],
  experienciaHistorica: [afiliacion()],
  desde: new Date('2014-02-01'),
};

describe('PractitionerProfileView', () => {
  let fixture: ComponentFixture<PractitionerProfileView>;
  let http: HttpTestingController;

  /**
   * Con `esPropio=true` se embebe `<app-work-history layout="timeline">`, que
   * llama a la API propia apenas se construye. Sin responderle, `http.verify()`
   * fallaría en cualquier prueba que monte la vista como dueño.
   */
  function responderWorkHistory(): void {
    http.expectOne('/profiles/practitioners/me/affiliations').flush({ items: [], count: 0 });
    http.expectOne('/practitioners/prac-1/sites').flush({ items: [], count: 0 });
  }

  /**
   * La misma pantalla, con una sesión que **no** trae perfil profesional.
   *
   * Aparte de `montar` porque el proveedor de sesión se declara al configurar
   * el módulo y después ya no se puede cambiar.
   */
  function montarConSesionSinPerfil(): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { practitionerProfileId: signal(null), userId: signal('u-1') },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PractitionerProfileView);
    fixture.componentRef.setInput('perfil', PERFIL);
    fixture.componentRef.setInput('esPropio', true);
    fixture.componentRef.setInput('previewMode', false);
    fixture.detectChanges();
    // Sin perfil en la sesión, el historial laboral ni se pide: sus dos
    // lecturas cuelgan del id que no hay.
    for (const peticion of http.match(() => true)) {
      peticion.flush({ items: [], count: 0 });
    }
    fixture.detectChanges();
  }

  function montar(
    perfil: PerfilProfesionalVisible = PERFIL,
    esPropio = false,
    previewMode = false,
  ): HTMLElement {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { practitionerProfileId: signal('prac-1'), userId: signal('u-1') },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PractitionerProfileView);
    fixture.componentRef.setInput('perfil', perfil);
    fixture.componentRef.setInput('esPropio', esPropio);
    fixture.componentRef.setInput('previewMode', previewMode);
    fixture.detectChanges();
    if (esPropio && !previewMode) {
      responderWorkHistory();
      fixture.detectChanges();
    }
    return fixture.nativeElement as HTMLElement;
  }

  /** Selecciona una pestaña superior por su texto visible. */
  function seleccionarPestana(host: HTMLElement, texto: string): void {
    const boton = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
      (candidato) => candidato.textContent?.includes(texto),
    );
    if (boton === undefined) {
      throw new Error(`No hay pestaña con texto "${texto}"`);
    }
    boton.click();
    fixture.detectChanges();
  }

  afterEach(() => {
    http?.verify();
  });

  it('pinta la identidad completa en la portada', () => {
    const host = montar();

    const portada = host.querySelector('.profesional__portada');
    expect(portada?.textContent).toContain('Dra. Lucía Salas');
    expect(portada?.textContent).toContain('Médica cardióloga');
    expect(portada?.textContent).toContain('Cardiología');
    expect(portada?.textContent).toContain('En ejercicio');
    // La presentación y las especialidades como tags viven en la cabecera.
    expect(portada?.textContent).toContain('Quince años en cardiología clínica.');
  });

  /* -- Feedback de la analista · F-01 / F-12 -------------------------------- */

  it('quien abre la ficha desde la Guía no ve el código profesional', () => {
    // Es vocabulario de sistema: al paciente no le dice nada (F-01, «Código:
    // HRD-…»).
    const portada = montar().querySelector('.profesional__portada');

    expect(portada?.textContent).not.toContain('MED-7');
    expect(portada?.textContent).not.toContain('Código profesional');
  });

  it('el dueño sí ve su código profesional: le sirve ante quien administra', () => {
    const portada = montar(PERFIL, true).querySelector('.profesional__portada');

    expect(portada?.textContent).toContain('MED-7');
  });

  it('el pie no muestra identificadores: sólo desde cuándo está en la plataforma', () => {
    // F-12: al pie de las credenciales se veía «Perfil 87b6…» — un uuid crudo.
    // Fuera para todos: quien tenga que reportar un problema lo busca en la
    // consola de administración, no en la ficha.
    const host = montar();

    expect(host.querySelector('.profesional__ids')).toBeNull();
    expect(host.textContent).not.toMatch(/Perfil\s+[0-9a-f-]{8,}|Persona\s+[0-9a-f-]{8,}/i);
    // El mes lo decide el locale de la app y la zona horaria del runner; acá se
    // fija la frase, no el formato.
    expect(host.querySelector('.profesional__desde')?.textContent).toMatch(
      /En la plataforma desde \S+ 2014/,
    );
  });

  /** La jerarquía: la portada es la ÚNICA tarjeta elevada de la pantalla. */
  it('la portada es la única tarjeta elevada', () => {
    const host = montar();

    const elevadas = host.querySelectorAll('app-card.card--elevated');
    expect(elevadas).toHaveLength(1);
    expect(elevadas[0].classList.contains('profesional__portada')).toBe(true);
  });

  it('las especialidades aparecen como tags en la cabecera', () => {
    const host = montar();

    const disponibilidad = host.querySelector('.profesional__disponibilidad');
    expect(disponibilidad?.textContent).toContain('Cardiología');
    expect(disponibilidad?.textContent).toContain('Medicina interna');
  });

  /* -- Las 3 pestañas superiores (carril 05) -------------------------------- */

  it('las pestañas son dos: la vista previa tiene pantalla propia', () => {
    // Era una tercera pestaña que mostraba, en sólo lectura, lo mismo que
    // `/my-account/preview` — donde además se configura. Dos lugares para lo
    // mismo, y el de acá no dejaba tocar nada.
    const host = montar(PERFIL, true);

    const pestanas = Array.from(host.querySelectorAll('[role="tab"]')).map(
      (boton) => boton.textContent?.trim() ?? '',
    );
    expect(pestanas).toContain('Trayectoria');
    expect(pestanas).toContain('Credenciales y verificaciones');
    expect(pestanas).not.toContain('Vista previa del perfil público');
  });

  it('un visitante no ve la pestaña de vista previa', () => {
    const host = montar(PERFIL, false);

    const pestanas = Array.from(host.querySelectorAll('[role="tab"]')).map(
      (boton) => boton.textContent?.trim() ?? '',
    );
    expect(pestanas).not.toContain('Vista previa del perfil público');
  });

  /* -- Trayectoria (pestaña por defecto) ------------------------------------ */

  it('Trayectoria muestra actividad actual, experiencia histórica y formación', () => {
    const host = montar();

    const texto = host.textContent ?? '';
    expect(texto).toContain('Sede Central Sopocachi');
    expect(texto).toContain('Hospital Obrero N.º 1');
    expect(texto).toContain('UMSA');
  });

  it('sin actividad actual ni experiencia histórica, cada bloque lo dice', () => {
    const host = montar({ ...PERFIL, actividadActual: [], experienciaHistorica: [] });

    expect(host.textContent).toContain('No hay actividad actual registrada');
    expect(host.textContent).toContain('No hay experiencia histórica registrada');
  });

  it('sin formación el caso vacío habla', () => {
    const host = montar({ ...PERFIL, formacion: [] });

    expect(host.textContent).toContain('Todavía no hay credenciales cargadas');
  });

  it('el dueño ve el formulario de alta de trayectoria embebido', () => {
    const host = montar(PERFIL, true);

    expect(host.textContent).toContain('Agregar un vínculo');
    // No debe repetir su propio listado plano: ya está la línea de tiempo arriba.
    expect(host.querySelectorAll('.historial__lista')).toHaveLength(0);
  });

  it('un visitante no ve el formulario de alta', () => {
    const host = montar(PERFIL, false);

    expect(host.textContent).not.toContain('Agregar un vínculo');
  });

  /* -- I-D (F-31): la ayuda es de quien arma su perfil, no de quien lo mira -- */

  it('el dueño ve la ayuda de cada pestaña', () => {
    const host = montar(PERFIL, true);

    expect(host.querySelector('app-tab-help-block')).not.toBeNull();
    seleccionarPestana(host, 'Credenciales y verificaciones');
    expect(host.textContent).toContain('Declarar no exige verificación previa');
  });

  it('un visitante no ve ninguna ayuda: le hablaba al dueño y a quien prueba', () => {
    // Un paciente en la ficha de la Guía leía «en desarrollo/pruebas se puede
    // usar todo el perfil sin esperar el trámite» (barrido del 18/08/2026).
    const host = montar(PERFIL, false);

    expect(host.querySelector('app-tab-help-block')).toBeNull();
    seleccionarPestana(host, 'Credenciales y verificaciones');
    expect(host.querySelector('app-tab-help-block')).toBeNull();
    expect(host.textContent).not.toContain('en desarrollo/pruebas');
  });

  it('la vista previa tampoco la muestra: imita lo que ve el visitante', () => {
    const host = montar(PERFIL, true, true);

    expect(host.querySelector('app-tab-help-block')).toBeNull();
  });

  /* -- Credenciales y verificaciones ----------------------------------------- */

  it('agrupa especialidades, formación y matrículas en declarado vs. verificado', () => {
    const host = montar();
    seleccionarPestana(host, 'Credenciales y verificaciones');

    const verificado = Array.from(host.querySelectorAll('.profesional__seguimiento-grupo'))[0];
    const declarado = Array.from(host.querySelectorAll('.profesional__seguimiento-grupo'))[1];

    // Verificado (3): la formación con fuente, la especialidad principal y la
    // matrícula, las tres con sello "approved".
    expect(verificado.textContent).toContain('Verificado (3)');
    expect(verificado.textContent).toContain('Título de grado');
    expect(verificado.textContent).toContain('Cardiología');
    expect(verificado.textContent).toContain('Nacional');
    // Declarado (1): la especialidad "en revisión".
    expect(declarado.textContent).toContain('Declarado (1)');
    expect(declarado.textContent).toContain('Medicina interna');
  });

  it('muestra la fuente de verificación cuando existe', () => {
    const host = montar();
    seleccionarPestana(host, 'Credenciales y verificaciones');

    expect(host.textContent).toContain('https://registro-profesional.test/matriculas/LIC-3');
  });

  it('sin nada verificado, el bloque lo dice', () => {
    const host = montar({
      ...PERFIL,
      formacion: PERFIL.formacion.map((f) => ({
        ...f,
        fuenteVerificacion: undefined,
        sello: 'in-review',
      })),
      especialidades: PERFIL.especialidades.map((e) => ({ ...e, sello: 'in-review' })),
      matriculas: PERFIL.matriculas.map((m) => ({ ...m, sello: 'in-review' })),
    });
    seleccionarPestana(host, 'Credenciales y verificaciones');

    expect(host.textContent).toContain('Todavía no hay nada verificado');
  });

  it('conserva las sub-pestañas de Especialidades y Matrículas dentro de Credenciales', () => {
    const host = montar();
    seleccionarPestana(host, 'Credenciales y verificaciones');

    const subPestanas = Array.from(host.querySelectorAll('[role="tab"]')).map(
      (boton) => boton.textContent?.trim() ?? '',
    );
    expect(subPestanas.some((texto) => texto.includes('Especialidades ('))).toBe(true);
    expect(subPestanas.some((texto) => texto.includes('Matrículas ('))).toBe(true);
  });

  /* -- Vista previa del perfil público (carril 05) --------------------------- */

  it('"Ver mi perfil público" lleva a la vitrina, que es una pantalla propia', () => {
    const host = montar(PERFIL, true);

    const enlace = Array.from(host.querySelectorAll('a[app-button]')).find((a) =>
      a.textContent?.includes('Ver mi perfil público'),
    ) as HTMLAnchorElement;

    expect(enlace).toBeTruthy();
    expect(enlace.getAttribute('href')).toContain('/my-account/preview');
  });

  it('en previewMode no muestra sus propias acciones de dueño aunque esPropio venga en true', () => {
    const host = montar(PERFIL, true, true);

    expect(host.querySelectorAll('.profesional__acciones button[app-button]')).toHaveLength(0);
    const pestanas = Array.from(host.querySelectorAll('[role="tab"]')).map(
      (boton) => boton.textContent?.trim() ?? '',
    );
    expect(pestanas).not.toContain('Vista previa del perfil público');
  });

  /* -- Actividad y disponibilidad -------------------------------------------- */

  it('la disponibilidad se dice con palabras', () => {
    const host = montar();

    expect(host.textContent).toContain('Acepta pacientes nuevos');
    expect(host.textContent).toContain('Atiende por telemedicina');
    expect(host.textContent).toContain('Español · interpreta en consulta');
  });

  it('esPropio rotula la actividad en segunda persona', () => {
    const host = montar(PERFIL, true);
    expect(host.textContent).toContain('Tu actividad en la plataforma');
  });

  it('un visitante ve la actividad en tercera persona', () => {
    const host = montar(PERFIL, false);
    expect(host.textContent).toContain('Actividad en la plataforma');
    expect(host.textContent).not.toContain('Tu actividad');
  });

  /* -- Casos vacíos ----------------------------------------------------------- */

  it('sin especialidades el caso vacío habla', () => {
    const host = montar({ ...PERFIL, especialidades: [] });
    seleccionarPestana(host, 'Credenciales y verificaciones');

    expect(host.textContent).toContain('Todavía no hay especialidades registradas');
  });

  it('sin biografía no queda la presentación vacía', () => {
    const host = montar({ ...PERFIL, bio: '' });

    expect(host.querySelector('.profesional__bio')).toBeNull();
  });

  /**
   * «Tus datos» — sólo en la ficha propia.
   *
   * La ficha del profesional mostraba su matrícula y su trayectoria, pero no el
   * documento con el que se registró ni su fecha de nacimiento. Lo reportó
   * Itzan en la revisión del túnel: la API los devolvía y la pantalla no los
   * dibujaba.
   */
  describe('los datos personales', () => {
    const DATOS = {
      documento: '8812345',
      departamento: 'Santa Cruz',
      fechaNacimiento: new Date('1985-03-20'),
      edad: 41,
      telefono: '+591 70012345',
      correo: 'elena@example.test',
      domicilio: 'Santa Cruz de la Sierra',
    };

    it('en la ficha propia se ven documento, edad, teléfono y domicilio', () => {
      const host = montar({ ...PERFIL, datosPersonales: DATOS });
      const texto = host.textContent ?? '';

      expect(texto).toContain('8812345');
      expect(texto).toContain('Santa Cruz');
      expect(texto).toContain('41 años');
      expect(texto).toContain('+591 70012345');
      expect(texto).toContain('elena@example.test');
    });

    it('en la ficha de OTRO no se ven: su documento no es de quien mira', () => {
      const host = montar({ ...PERFIL, datosPersonales: null });
      const texto = host.textContent ?? '';

      expect(texto).not.toContain('Tus datos');
      expect(texto).not.toContain('8812345');
    });

    it('lo que no declaró no se dibuja: nada de «Sin registrar»', () => {
      const host = montar({
        ...PERFIL,
        datosPersonales: {
          documento: '',
          departamento: '',
          fechaNacimiento: null,
          edad: null,
          telefono: '',
          correo: '',
          domicilio: '',
        },
      });

      expect(host.textContent ?? '').not.toContain('Tus datos');
    });
  });

  /**
   * **Todo lo de la persona, junto y arriba.**
   *
   * Justin lo pidió con estas palabras: la matrícula estaba en la pestaña
   * «Credenciales» y los datos en «Trayectoria», así que ver quién es y con qué
   * ejerce obligaba a saltar de pestaña y a bajar. Ahora los dos van en una
   * tarjeta pegada al nombre, y —lo que hace que el arreglo sirva— la matrícula
   * de arriba es la COMPLETA: si abajo quedara el detalle real, habría que ir
   * igual y no habríamos arreglado nada.
   */
  describe('la filiación vive fuera de las pestañas', () => {
    const DATOS = {
      documento: '8812345',
      departamento: 'Santa Cruz',
      fechaNacimiento: new Date('1985-03-20'),
      edad: 41,
      telefono: '+591 70012345',
      correo: 'elena@example.test',
      domicilio: 'Santa Cruz de la Sierra',
    };

    /** Con las pestañas arrancadas, lo que queda es lo que se ve sin navegar. */
    function textoFueraDeLasPestanas(host: HTMLElement): string {
      const copia = host.cloneNode(true) as HTMLElement;
      copia.querySelectorAll('app-tabs').forEach((tabs) => tabs.remove());
      return copia.textContent ?? '';
    }

    it('el dueño lee sus datos y su matrícula sin tocar una pestaña', () => {
      const host = montar({ ...PERFIL, datosPersonales: DATOS }, true);
      const visible = textoFueraDeLasPestanas(host);

      expect(visible).toContain('Tus datos');
      expect(visible).toContain('8812345');
      expect(visible).toContain('Tu habilitación');
      expect(visible).toContain('LIC-3');
    });

    it('la matrícula de arriba trae la vigencia: es el detalle, no un resumen', () => {
      const host = montar(
        {
          ...PERFIL,
          datosPersonales: DATOS,
          // Componentes locales, no `new Date('2030-06-30')`: eso es medianoche
          // UTC y al oeste de Greenwich el pipe la dibujaría como el 29. Es lo
          // mismo que hace `maybeDateOnly` en el mapper real.
          matriculas: [{ ...PERFIL.matriculas[0], hasta: new Date(2030, 5, 30) }],
        },
        true,
      );

      expect(textoFueraDeLasPestanas(host)).toContain('30/06/2030');
    });

    it('y entonces abajo ya no se repite: sin sub-pestaña «Matrículas»', () => {
      const host = montar({ ...PERFIL, datosPersonales: DATOS }, true);
      // Sin abrirla no probaría nada: el panel de una pestaña inactiva no se
      // renderiza, así que sus sub-pestañas tampoco están en el DOM.
      seleccionarPestana(host, 'Credenciales y verificaciones');

      const pestanas = Array.from(host.querySelectorAll('[role="tab"]')).map(
        (boton) => boton.textContent?.trim() ?? '',
      );
      expect(pestanas.some((etiqueta) => etiqueta.startsWith('Matrículas'))).toBe(false);
      // Tampoco queda un tabset de UNA pestaña: la lista de especialidades pasa
      // a ser un encabezado suelto, que es un rótulo y no un control que elige.
      expect(pestanas.some((etiqueta) => etiqueta.startsWith('Especialidades'))).toBe(false);
      expect(host.textContent).toContain('Especialidades (');
    });

    it('quien visita SÍ conserva las sub-pestañas: no tiene tarjeta arriba', () => {
      // Sin `datosPersonales` no hay bloque de filiación, así que las dos
      // sub-pestañas siguen siendo el único lugar donde vive el detalle.
      const host = montar({ ...PERFIL, datosPersonales: null });
      seleccionarPestana(host, 'Credenciales y verificaciones');

      const pestanas = Array.from(host.querySelectorAll('[role="tab"]')).map(
        (boton) => boton.textContent?.trim() ?? '',
      );
      expect(pestanas.some((etiqueta) => etiqueta.startsWith('Matrículas'))).toBe(true);
      expect(pestanas.some((etiqueta) => etiqueta.startsWith('Especialidades'))).toBe(true);
    });
  });

  /* -- La foto del dueño: sube, fija y — si hay vitrina — la repite (carril 05) */

  describe('alElegirFoto', () => {
    /** PNG mínimo: el tipo es lo único que el handler necesita. */
    function archivoFoto(): File {
      return new File(['x'], 'foto.png', { type: 'image/png' });
    }

    /**
     * Respuesta mínima válida de `PUT /profiles/practitioners/:id/photo`.
     *
     * `traducirPerfilPropio` llama `.map()` sobre `specialties`, `credentials`,
     * `licenses` y `affiliations`: sin esos cuatro arreglos —aunque sea
     * vacíos— la traducción revienta antes de que el flujo llegue a
     * `propagarAVitrina`, y el pedido a `/community/profiles/me` nunca sale.
     */
    function respuestaFoto(photoFileId: string) {
      return {
        profileId: 'prac-1',
        photoFileId,
        createdAt: new Date().toISOString(),
        specialties: [],
        credentials: [],
        licenses: [],
        affiliations: [],
      };
    }

    /**
     * El caso que rompía en producción: la cuenta entra, ve su perfil y el
     * botón de la foto, elige un PNG… y no pasa nada. El handler se iba en
     * silencio cuando la sesión no traía perfil profesional —pasa de verdad:
     * una persona duplicada cuya cuenta quedó atada al registro sin perfil no
     * lleva el claim `hpid`— y desde afuera se lee como «no acepta PNG».
     */
    it('sin perfil profesional en la sesión lo DICE, en vez de no hacer nada', () => {
      TestBed.resetTestingModule();
      montarConSesionSinPerfil();
      const host = fixture.nativeElement as HTMLElement;

      eligeFoto(host, archivoFoto());

      // Ni una petición: no hay dónde guardarla. Pero la persona se entera.
      http.expectNone((r) => r.url === '/common/files/upload');
      expect(host.textContent).toContain('no está asociada a un perfil profesional');
    });

    /** Simula elegir un archivo en el input de foto y dispara `change`. */
    function eligeFoto(host: HTMLElement, archivo: File): void {
      const input = host.querySelector<HTMLInputElement>('[data-testid="perfil-foto"]');
      if (input === null) {
        throw new Error('No está el input de la foto — ¿esPropio=false?');
      }
      Object.defineProperty(input, 'files', { value: [archivo], configurable: true });
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    }

    it('sube, fija la foto profesional y la pinta', () => {
      const host = montar(PERFIL, true);

      eligeFoto(host, archivoFoto());

      http.expectOne('/common/files/upload').flush({ id: 'file-1' });
      http.expectOne('/profiles/practitioners/prac-1/photo').flush(respuestaFoto('file-1'));
      // Sin vitrina: la propagación no dispara ningún pedido más.
      http.expectOne('/community/profiles/me').flush(null);
      http
        .expectOne('/common/files/file-1/download-url')
        .flush({ url: '/media/file-1', expiresAt: new Date().toISOString() });
      fixture.detectChanges();

      const img = host.querySelector('.profesional__foto .avatar__image');
      expect(img?.getAttribute('src')).toBe('/media/file-1');
    });

    it('con vitrina existente, repite la foto como avatar sin perder lo ya declarado', () => {
      const host = montar(PERFIL, true);

      eligeFoto(host, archivoFoto());

      http.expectOne('/common/files/upload').flush({ id: 'file-1' });
      http.expectOne('/profiles/practitioners/prac-1/photo').flush(respuestaFoto('file-1'));

      http.expectOne('/community/profiles/me').flush({
        id: 'vit-1',
        tenantId: 'ten-1',
        targetId: 'prac-1',
        slug: 'dra-lucia-salas',
        displayName: 'Dra. Lucía Salas',
        headline: 'Cardióloga',
        biography: 'Bio',
        acceptsReviews: true,
        visibility: 'PUBLIC',
        statusConceptId: 'st-1',
      });

      const puesta = http.expectOne('/community/profiles/me');
      expect(puesta.request.method).toBe('PUT');
      expect(puesta.request.body).toEqual({
        tenantId: 'ten-1',
        slug: 'dra-lucia-salas',
        displayName: 'Dra. Lucía Salas',
        headline: 'Cardióloga',
        biography: 'Bio',
        acceptsReviews: true,
        avatarFileId: 'file-1',
      });
      puesta.flush({
        id: 'vit-1',
        tenantId: 'ten-1',
        targetId: 'prac-1',
        slug: 'dra-lucia-salas',
        displayName: 'Dra. Lucía Salas',
        visibility: 'PUBLIC',
        statusConceptId: 'st-1',
        avatarFileId: 'file-1',
      });

      http
        .expectOne('/common/files/file-1/download-url')
        .flush({ url: '/media/file-1', expiresAt: new Date().toISOString() });
      fixture.detectChanges();

      const img = host.querySelector('.profesional__foto .avatar__image');
      expect(img?.getAttribute('src')).toBe('/media/file-1');
    });

    it('si falla la propagación a la vitrina, la foto profesional igual se pinta', () => {
      // Best-effort: lo que ya se guardó arriba no debe perderse por un error
      // accesorio.
      const host = montar(PERFIL, true);

      eligeFoto(host, archivoFoto());

      http.expectOne('/common/files/upload').flush({ id: 'file-1' });
      http.expectOne('/profiles/practitioners/prac-1/photo').flush(respuestaFoto('file-1'));
      http.expectOne('/community/profiles/me').flush('boom', { status: 500, statusText: 'Error' });

      http
        .expectOne('/common/files/file-1/download-url')
        .flush({ url: '/media/file-1', expiresAt: new Date().toISOString() });
      fixture.detectChanges();

      const img = host.querySelector('.profesional__foto .avatar__image');
      expect(img?.getAttribute('src')).toBe('/media/file-1');
      // El fallo fue accesorio (la propagación a la vitrina): no queda como
      // mensaje de error de la subida, que sí funcionó.
      expect(host.textContent).not.toContain('No pudimos subir la foto');
    });

    it('un visitante no ve el control de foto: nadie le cambia la foto a nadie', () => {
      const host = montar(PERFIL, false);

      expect(host.querySelector('[data-testid="perfil-foto"]')).toBeNull();
    });
  });
});
