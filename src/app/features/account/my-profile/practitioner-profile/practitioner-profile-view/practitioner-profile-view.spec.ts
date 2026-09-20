import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AuthService } from '../../../../../core/auth/auth.service';
import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { PESTANAS_DEL_PERFIL_MEDICO } from '../../pestanas-del-perfil-medico';
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
  // Y sin facturación, por lo mismo: el NIT de un colega no es de quien mira.
  facturacion: null,
  actividadActual: [
    afiliacion({ id: 'af-2', organizacion: 'Sede Central Sopocachi', hasta: null, actual: true }),
  ],
  experienciaHistorica: [afiliacion()],
  desde: new Date('2014-02-01'),
};

describe('PractitionerProfileView', () => {
  let fixture: ComponentFixture<PractitionerProfileView>;
  let http: HttpTestingController;
  /** `confirm()` resuelve a `true` salvo que una prueba lo cambie. */
  let confirmar = true;
  const dialogs = { confirm: vi.fn(async () => confirmar) };

  /**
   * Con `esPropio=true` se embebe `<app-work-history>`, que lee su historial al
   * iniciarse. Sin responderle, `http.verify()` fallaría en cualquier prueba
   * que monte la vista como dueño.
   *
   * **Una sola lectura, no dos.** Acá se respondía también
   * `/practitioners/prac-1/sites`, porque el bloque pedía los consultorios
   * aunque no fuera a dibujarlos. Desde el 13/09/2026 «Dónde atiendo» salió de
   * Trayectoria —la pestaña se monta con `secciones="historial"`— y esa
   * petición ya no se hace: pedir lo que no se dibuja era una llamada por
   * visita a una pantalla que no la usa.
   */
  function responderWorkHistory(): void {
    http.expectOne('/profiles/practitioners/me/affiliations').flush({ items: [], count: 0 });
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
        { provide: DialogService, useValue: dialogs },
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
    // Desde el rediseño del 2026-09-10 la ficha propia es la MISMA tarjeta del
    // paciente, así que el código no está en una portada: es un renglón más de
    // «Datos personales», con su rótulo al lado.
    const host = montar(PERFIL, true);
    const ficha = host.querySelector('[data-testid="mi-perfil-pestanas"]');

    expect(ficha?.textContent).toContain('Código profesional');
    expect(ficha?.textContent).toContain('MED-7');
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

  it('el dueño ve las seis pestañas del alta de médico, y ninguna vista previa', () => {
    // Pedido del cliente del 2026-09-10: la ficha del médico se muestra como la
    // del paciente —una tarjeta con pestañas— y sus pestañas son los pasos de
    // su propio registro. La vista previa del perfil público salió antes
    // (CORR-10) y no vuelve por esta puerta.
    // Con `facturacion` declarada: es la ficha PROPIA, y esa pestaña sólo
    // existe ahí. El fixture base la deja en `null` porque casi todas estas
    // pruebas miran la ficha de un colega.
    const host = montar({ ...PERFIL, facturacion: { nit: '', razonSocial: '' } }, true);

    const pestanas = Array.from(host.querySelectorAll('[role="tab"]')).map(
      (boton) => boton.textContent?.trim() ?? '',
    );
    expect(pestanas).toEqual([...PESTANAS_DEL_PERFIL_MEDICO]);
    expect(pestanas).not.toContain('Vista previa del perfil público');
  });

  it('el dueño ve la misma cabecera que el paciente: «Tus datos» y el lápiz', () => {
    const host = montar(PERFIL, true);

    expect(host.querySelector('.mi-perfil__cabecera')?.textContent).toContain('Tus datos');
    const lapiz = host.querySelector('[data-testid="mi-perfil-editar"]');
    expect(lapiz?.getAttribute('aria-label')).toBe('Editar');
  });

  it('el dueño ve «Sin registrar» en lo que no cargó: es su ficha, no la de un colega', () => {
    // En la ficha de otro, ocultar el renglón vacío es correcto. En la propia
    // es al revés: sin el renglón, el dueño no distingue «no lo tengo cargado»
    // de «la app no me lo muestra». Mismo criterio que la ficha del paciente.
    const host = montar({ ...PERFIL, titulo: '' }, true);
    const ficha = host.querySelector('[data-testid="mi-perfil-pestanas"]');

    expect(ficha?.textContent).toContain('Título profesional');
    expect(ficha?.textContent).toContain('Sin registrar');
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

  /* ---- ALV-009/formación: retirar un título pendiente ---------------------- */

  const FORMACION_PENDIENTE: PerfilProfesionalVisible['formacion'][number] = {
    id: 'cr-2',
    tipo: 'Diplomado',
    numero: 'DIP-1',
    institucion: '',
    desde: null,
    hasta: null,
    estado: 'Pendiente',
    sello: 'in-review',
    vencida: false,
  };

  it('el dueño ve «Retirar» sólo en un título pendiente, no en uno verificado', () => {
    const host = montar({ ...PERFIL, formacion: [...PERFIL.formacion, FORMACION_PENDIENTE] }, true);
    seleccionarPestana(host, 'Trayectoria');

    expect(host.querySelector('[data-testid="formacion-retirar-cr-1"]')).toBeNull();
    expect(host.querySelector('[data-testid="formacion-retirar-cr-2"]')).not.toBeNull();
  });

  it('un visitante no ve «Retirar» aunque el título esté pendiente', () => {
    const host = montar({ ...PERFIL, formacion: [FORMACION_PENDIENTE] }, false);

    expect(host.querySelector('[data-testid="formacion-retirar-cr-2"]')).toBeNull();
  });

  it('retirar confirma y hace un DELETE del título', async () => {
    confirmar = true;
    montar({ ...PERFIL, formacion: [FORMACION_PENDIENTE] }, true);

    await (
      fixture.componentInstance as unknown as {
        retirarCredencial: (e: unknown) => Promise<void>;
      }
    ).retirarCredencial(FORMACION_PENDIENTE);

    expect(dialogs.confirm).toHaveBeenCalled();
    const req = http.expectOne('/profiles/practitioners/me/credentials/cr-2');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('sin confirmar, no se manda ningún DELETE', async () => {
    confirmar = false;
    montar({ ...PERFIL, formacion: [FORMACION_PENDIENTE] }, true);

    await (
      fixture.componentInstance as unknown as {
        retirarCredencial: (e: unknown) => Promise<void>;
      }
    ).retirarCredencial(FORMACION_PENDIENTE);

    expect(dialogs.confirm).toHaveBeenCalled();
    http.expectNone('/profiles/practitioners/me/credentials/cr-2');
  });

  it('el dueño ve el formulario de alta de trayectoria embebido', () => {
    const host = montar(PERFIL, true);
    seleccionarPestana(host, 'Trayectoria');

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

    seleccionarPestana(host, 'Trayectoria');
    expect(host.querySelector('app-tab-help-block')).not.toBeNull();
    seleccionarPestana(host, 'Credenciales');
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

  /* -- Vista previa del perfil público ---------------------------------------
     Estaba: «"Ver cómo me ven" lleva a la vista previa de sólo lectura»
     (ALV-004, carril 05). El propietario pidió el 2026-09-10 sacar el perfil
     público «de todos lados», así que la prueba fija lo contrario — y lo fija,
     en vez de borrarse, para que volver a agregar el botón sin decidirlo no
     pase inadvertido. */

  it('la ficha propia NO ofrece «Ver cómo me ven»: el perfil público se sacó', () => {
    const host = montar(PERFIL, true);

    const enlace = Array.from(host.querySelectorAll('a[app-button]')).find((a) =>
      a.textContent?.includes('Ver cómo me ven'),
    );

    expect(enlace).toBeUndefined();
    expect(host.innerHTML).not.toContain('/my-account/preview');
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

  it('los tags se dicen con palabras, sin la disponibilidad para pacientes nuevos', () => {
    const host = montar();

    // El chip se pintaba en toda ficha —también en la de quien nunca tocó el
    // ajuste— y el valor por defecto anunciaba lo contrario de la realidad.
    expect(host.textContent).not.toContain('Acepta pacientes nuevos');
    expect(host.textContent).not.toContain('No toma pacientes nuevos');
    expect(host.textContent).toContain('Atiende por telemedicina');
    expect(host.textContent).toContain('Español · interpreta en consulta');
  });

  it('el dueño conserva sus contadores de actividad, ahora como pestaña', () => {
    // No sale del alta, pero ya se mostraba: tirarlo para «parecerse más al
    // paciente» habría sido perder un dato con la excusa de un rediseño.
    const host = montar(PERFIL, true);
    seleccionarPestana(host, 'Actividad');

    expect(host.textContent).toContain('Encuentros atendidos');
    expect(host.textContent).toContain('Son los registros que dejaste asentados con esta cuenta');
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
      // Los cuatro contactos que el registro pregunta por separado y la calle.
      // La ficha mostraba UN teléfono y UN correo con los cinco ya disponibles.
      celularPersonal: '+591 70099999',
      celularTrabajo: '+591 70088888',
      fijoTrabajo: '+591 3 3000000',
      correoPersonal: 'elena.personal@example.test',
      direccion: 'Av. Banzer 3er anillo',
      mapaDomicilio: null,
    };

    it('la ficha propia muestra los cinco contactos del registro, no uno de cada clase', () => {
      // Pedido del propietario: la ficha del médico tiene que mostrar los
      // mismos campos que su registro. Éstos faltaban aunque el dato viniera.
      const host = montar({ ...PERFIL, datosPersonales: DATOS });
      const texto = host.textContent ?? '';

      expect(texto).toContain('+591 70099999');
      expect(texto).toContain('+591 70088888');
      expect(texto).toContain('+591 3 3000000');
      expect(texto).toContain('elena.personal@example.test');
      expect(texto).toContain('Av. Banzer 3er anillo');
    });

    it('un contacto no declarado no dibuja su renglón', () => {
      // Cinco «—» seguidos se leen como una ficha rota, no como datos que
      // faltan.
      const host = montar({
        ...PERFIL,
        datosPersonales: { ...DATOS, celularTrabajo: '', fijoTrabajo: '', correoPersonal: '' },
      });
      const texto = host.textContent ?? '';

      expect(texto).not.toContain('Celular del trabajo');
      expect(texto).not.toContain('Fijo del trabajo');
      expect(texto).not.toContain('Correo personal');
      expect(texto).toContain('Celular personal');
    });

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
          celularPersonal: '',
          celularTrabajo: '',
          fijoTrabajo: '',
          correoPersonal: '',
          direccion: '',
          mapaDomicilio: null,
        },
      });

      expect(host.textContent ?? '').not.toContain('Tus datos');
    });
  });

  /**
   * **Todo lo de la persona, en UNA tarjeta con pestañas.**
   *
   * Antes se pidió que la filiación y la matrícula salieran de las pestañas y
   * subieran a una tarjeta propia, porque estaban repartidas en dos pestañas
   * distintas y ver quién es y con qué ejerce obligaba a saltar entre ellas.
   *
   * El pedido del 2026-09-10 lo reemplaza y no lo contradice: la ficha del
   * médico pasa a ser **la misma tarjeta del paciente**, y ahí la respuesta es
   * la pestaña por defecto. Los datos siguen sin costar navegación —«Datos
   * personales» es la primera— y la matrícula sigue siendo la COMPLETA en un
   * solo lugar, ahora dentro de «Credenciales». Lo que se conserva es la
   * exigencia: **una sola vez, y con su detalle**.
   */
  describe('la ficha propia es una sola tarjeta con pestañas', () => {
    const DATOS = {
      documento: '8812345',
      departamento: 'Santa Cruz',
      fechaNacimiento: new Date('1985-03-20'),
      edad: 41,
      telefono: '+591 70012345',
      correo: 'elena@example.test',
      domicilio: 'Santa Cruz de la Sierra',
      celularPersonal: '',
      celularTrabajo: '',
      fijoTrabajo: '',
      correoPersonal: '',
      direccion: '',
      mapaDomicilio: null,
    };

    it('el dueño lee sus datos sin tocar una pestaña: son la primera', () => {
      const host = montar({ ...PERFIL, datosPersonales: DATOS }, true);

      expect(host.textContent).toContain('Tus datos');
      expect(host.textContent).toContain('8812345');
    });

    it('todo cuelga de UNA tarjeta: ni portada ni bloques sueltos alrededor', () => {
      const host = montar({ ...PERFIL, datosPersonales: DATOS }, true);

      expect(host.querySelector('.profesional__portada')).toBeNull();
      expect(host.querySelectorAll('app-card')).toHaveLength(1);
    });

    it('la matrícula trae la vigencia: es el detalle, no un resumen', () => {
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
      seleccionarPestana(host, 'Credenciales');

      expect(host.textContent).toContain('LIC-3');
      expect(host.textContent).toContain('30/06/2030');
    });

    it('y no se repite: una sola lista de matrículas, sin sub-pestañas', () => {
      const host = montar(
        { ...PERFIL, datosPersonales: DATOS, facturacion: { nit: '', razonSocial: '' } },
        true,
      );
      // Sin abrirla no probaría nada: el panel de una pestaña inactiva no se
      // renderiza, así que sus sub-pestañas tampoco están en el DOM.
      seleccionarPestana(host, 'Credenciales');

      const pestanas = Array.from(host.querySelectorAll('[role="tab"]')).map(
        (boton) => boton.textContent?.trim() ?? '',
      );
      expect(pestanas).toEqual([...PESTANAS_DEL_PERFIL_MEDICO]);
      // El número, con su rótulo: a secas aparecería también dentro de la URL
      // de la fuente de verificación de la formación, que es otro dato.
      const texto = (host.textContent ?? '').replace(/\s+/g, ' ');
      expect(texto.match(/Matrícula LIC-3/g) ?? []).toHaveLength(1);
    });

    /* ---- la trayectoria como nodos (propietario, 13/09/2026) ------------- */

    it('la trayectoria propia son nodos, no las tarjetas de la ficha del paciente', () => {
      // «Prefiero que se vea como nodos, en lugar de estos cards horribles».
      // Las tres fases eran tres listas de `mi-perfil__item`, que es CSS
      // compartido con la ficha del paciente: por eso el dibujo nuevo estrena
      // clases propias en vez de retocar aquéllas.
      const host = montar({ ...PERFIL, datosPersonales: DATOS }, true);
      seleccionarPestana(host, 'Trayectoria');

      const fases = Array.from(host.querySelectorAll('.trayecto')).map((s) =>
        s.querySelector('.trayecto__titulo')?.textContent?.trim(),
      );
      expect(fases).toEqual(['Actividad actual', 'Experiencia histórica', 'Formación y títulos']);

      // Un nodo por hito, cada uno con su marca.
      const enCurso = host.querySelector('.trayecto--curso');
      expect(enCurso?.querySelectorAll('.trayecto__nodo')).toHaveLength(
        PERFIL.actividadActual.length,
      );
      expect(enCurso?.querySelectorAll('.trayecto__marca')).toHaveLength(
        PERFIL.actividadActual.length,
      );
      expect(enCurso?.textContent).toContain('Sede Central Sopocachi');
    });

    it('el nodo de un título toma el color de su sello', () => {
      // El anillo y el sello hablan del MISMO trámite: si el anillo fuera
      // siempre del color de la fase, un título rechazado se vería igual que
      // uno verificado hasta leer la etiqueta.
      const host = montar(
        {
          ...PERFIL,
          datosPersonales: DATOS,
          formacion: [
            { ...PERFIL.formacion[0], id: 'cr-9', sello: 'rejected', estado: 'Rechazado' },
          ],
        },
        true,
      );
      seleccionarPestana(host, 'Trayectoria');

      const nodo = host.querySelector('.trayecto--formacion .trayecto__nodo');
      expect(nodo?.classList.contains('trayecto__nodo--rejected')).toBe(true);
    });

    it('quien visita conserva su ficha de siempre, con sus sub-pestañas', () => {
      // La Guía de profesionales no cambió: este rediseño es el de la ficha
      // PROPIA. Sin `datosPersonales` no hay bloque de filiación, así que las
      // dos sub-pestañas siguen siendo el único lugar donde vive el detalle.
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

    it('sube, fija la foto profesional y la pinta', async () => {
      const host = montar(PERFIL, true);

      eligeFoto(host, archivoFoto());

      http.expectOne('/common/files/upload').flush({ id: 'file-1' });
      http.expectOne('/profiles/practitioners/prac-1/photo').flush(respuestaFoto('file-1'));
      // Sin vitrina: la propagación no dispara ningún pedido más.
      http.expectOne('/community/profiles/me').flush(null);
      http.expectOne('/common/files/file-1/content').flush(pngFalso());
      await esperarLaFoto(fixture, host);

      const img = host.querySelector('.mi-perfil__foto .avatar__image');
      // `data:` y no una ruta: la URL firmada del backend apunta a
      // `file://local/<sha>` y ningún navegador la carga. Ése era el defecto.
      expect(img?.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    });

    it('con vitrina existente, repite la foto como avatar sin perder lo ya declarado', async () => {
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

      http.expectOne('/common/files/file-1/content').flush(pngFalso());
      await esperarLaFoto(fixture, host);

      const img = host.querySelector('.mi-perfil__foto .avatar__image');
      // `data:` y no una ruta: la URL firmada del backend apunta a
      // `file://local/<sha>` y ningún navegador la carga. Ése era el defecto.
      expect(img?.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    });

    it('si falla la propagación a la vitrina, la foto profesional igual se pinta', async () => {
      // Best-effort: lo que ya se guardó arriba no debe perderse por un error
      // accesorio.
      const host = montar(PERFIL, true);

      eligeFoto(host, archivoFoto());

      http.expectOne('/common/files/upload').flush({ id: 'file-1' });
      http.expectOne('/profiles/practitioners/prac-1/photo').flush(respuestaFoto('file-1'));
      http.expectOne('/community/profiles/me').flush('boom', { status: 500, statusText: 'Error' });

      http.expectOne('/common/files/file-1/content').flush(pngFalso());
      await esperarLaFoto(fixture, host);

      const img = host.querySelector('.mi-perfil__foto .avatar__image');
      // `data:` y no una ruta: la URL firmada del backend apunta a
      // `file://local/<sha>` y ningún navegador la carga. Ése era el defecto.
      expect(img?.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
      // El fallo fue accesorio (la propagación a la vitrina): no queda como
      // mensaje de error de la subida, que sí funcionó.
      expect(host.textContent).not.toContain('No pudimos subir la foto');
    });

    it('un visitante no ve el control de foto: nadie le cambia la foto a nadie', () => {
      const host = montar(PERFIL, false);

      expect(host.querySelector('[data-testid="perfil-foto"]')).toBeNull();
    });
  });

  /**
   * Facturación (propietario, 19/09/2026).
   *
   * El médico emite comprobantes y la ficha no decía a nombre de quién salen.
   * Los dos datos van en un recuadro propio, no en la lista `dt`/`dd`: es lo
   * que se copia en una factura, y se consulta junto.
   */
  describe('el recuadro de facturación', () => {
    const FACTURA = { nit: '8812345011', razonSocial: 'Consultorio Dra. Rojas S.R.L.' };

    it('en la ficha propia muestra el NIT y a nombre de quién factura', () => {
      const host = montar({ ...PERFIL, facturacion: FACTURA }, true);
      seleccionarPestana(host, 'Facturación');

      expect(host.querySelector('[data-testid="perfil-factura-nit"]')?.textContent?.trim()).toBe(
        '8812345011',
      );
      expect(
        host.querySelector('[data-testid="perfil-factura-titular"]')?.textContent?.trim(),
      ).toBe('Consultorio Dra. Rojas S.R.L.');
    });

    it('los dos datos van en un recuadro propio, separado de la lista de datos', () => {
      // Si mañana alguien los devuelve a la lista `dt`/`dd` de la ficha, esto
      // se pone rojo: el pedido era justamente que fueran un recuadro aparte.
      const host = montar({ ...PERFIL, facturacion: FACTURA }, true);
      seleccionarPestana(host, 'Facturación');
      const recuadro = host.querySelector('[data-testid="perfil-factura-recuadro"]');

      expect(recuadro).not.toBeNull();
      expect(recuadro?.querySelector('[data-testid="perfil-factura-nit"]')).not.toBeNull();
      expect(recuadro?.querySelector('[data-testid="perfil-factura-titular"]')).not.toBeNull();
      expect(recuadro?.closest('dl')).toBeNull();
    });

    it('sin NIT dice dónde cargarlo, en vez de dejar el hueco', () => {
      const host = montar({ ...PERFIL, facturacion: { nit: '', razonSocial: '' } }, true);
      seleccionarPestana(host, 'Facturación');

      expect(host.querySelector('[data-testid="perfil-factura-nit"]')?.textContent).toContain(
        'Sin registrar',
      );
      expect(host.querySelector('[data-testid="perfil-factura-falta"]')?.textContent).toContain(
        'Editar tu info',
      );
    });

    it('en la ficha de OTRO no existe ni la pestaña: su NIT no es de quien mira', () => {
      const host = montar({ ...PERFIL, facturacion: null }, false);
      const rotulos = [...host.querySelectorAll('[role="tab"]')].map((b) => b.textContent?.trim());

      expect(rotulos).not.toContain('Facturación');
      expect(host.querySelector('[data-testid="perfil-facturacion"]')).toBeNull();
      expect(host.textContent).not.toContain('8812345011');
    });
  });
});

/**
 * Un PNG de un pixel, como Blob.
 *
 * La foto se resuelve bajando los bytes por `/content` y codificándolos: el
 * contenido da igual, lo que importa es que sea un Blob con tipo — de ahí sale
 * el `data:image/png` que termina en el `src`.
 */
function pngFalso(): Blob {
  return new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
}

/**
 * Espera a que la foto aterrice en el DOM.
 *
 * La codificación a `data:` la hace `FileReader`, que es asíncrono y **no**
 * pasa por los temporizadores de `fakeAsync`. Ceder un turno fijo alcanzaba a
 * veces y a veces no —dos de estas pruebas fallaban de forma intermitente—, así
 * que se sondea hasta que el `src` existe.
 */
async function esperarLaFoto(fixture: ComponentFixture<unknown>, host: HTMLElement): Promise<void> {
  for (let intento = 0; intento < 50; intento++) {
    await new Promise((listo) => setTimeout(listo, 0));
    fixture.detectChanges();
    if (host.querySelector('.mi-perfil__foto .avatar__image') !== null) return;
  }
}
