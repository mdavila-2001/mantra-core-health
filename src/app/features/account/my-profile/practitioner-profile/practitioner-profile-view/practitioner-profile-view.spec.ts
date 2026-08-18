import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AuthService } from '../../../../../core/auth/auth.service';
import { PractitionerProfileView } from './practitioner-profile-view';
import type { AfiliacionVisible, PerfilProfesionalVisible } from './practitioner-profile-view.types';

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
  actividadActual: [afiliacion({ id: 'af-2', organizacion: 'Sede Central Sopocachi', hasta: null, actual: true })],
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

  it('el dueño ve las 3 pestañas del carril 05', () => {
    const host = montar(PERFIL, true);

    const pestanas = Array.from(host.querySelectorAll('[role="tab"]')).map(
      (boton) => boton.textContent?.trim() ?? '',
    );
    expect(pestanas).toContain('Trayectoria');
    expect(pestanas).toContain('Credenciales y verificaciones');
    expect(pestanas).toContain('Vista previa del perfil público');
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
      formacion: PERFIL.formacion.map((f) => ({ ...f, fuenteVerificacion: undefined, sello: 'in-review' })),
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

  it('"Ver mi perfil público" selecciona la pestaña Preview, no navega afuera', () => {
    const host = montar(PERFIL, true);

    const boton = Array.from(host.querySelectorAll('button[app-button]')).find((b) =>
      b.textContent?.includes('Ver mi perfil público'),
    ) as HTMLButtonElement;
    expect(boton).toBeTruthy();
    boton.click();
    fixture.detectChanges();

    // La pestaña Preview queda activa: su panel deja de estar oculto.
    const panelPreview = Array.from(host.querySelectorAll('[role="tabpanel"]')).find((panel) =>
      panel.textContent?.includes('Así ve un paciente este perfil'),
    );
    expect(panelPreview?.hasAttribute('hidden')).toBe(false);
  });

  it('la vista previa reinstancia el MISMO componente con esPropio=false', () => {
    const host = montar(PERFIL, true);
    seleccionarPestana(host, 'Vista previa del perfil público');

    // `host` YA ES el `<app-practitioner-profile-view>` externo: buscar el
    // selector dentro de sus descendientes encuentra sin ambigüedad la
    // instancia anidada (la externa no puede ser descendiente de sí misma).
    const anidado = host.querySelector('app-practitioner-profile-view');
    expect(anidado).toBeTruthy();
    // El componente anidado no ofrece sus propias acciones de dueño.
    expect(anidado?.querySelectorAll('.profesional__acciones button[app-button]')).toHaveLength(0);
  });

  it('la vista previa no vuelve a ofrecer una pestaña Preview de sí misma', () => {
    const host = montar(PERFIL, true);
    seleccionarPestana(host, 'Vista previa del perfil público');

    const anidado = host.querySelector('app-practitioner-profile-view');
    expect(anidado).toBeTruthy();
    const pestanasAnidadas = Array.from(anidado?.querySelectorAll('[role="tab"]') ?? []).map(
      (boton) => boton.textContent?.trim() ?? '',
    );
    expect(pestanasAnidadas).not.toContain('Vista previa del perfil público');
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
});
