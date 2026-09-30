import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { NAV_ICON_NAMES } from '../../../shared/components/atoms/nav-icon/nav-icon.types';
import { ESPECIALIDADES_ODONTOLOGICAS, RegisterPractitioner } from './register-practitioner';
import { ESPECIALIDAD } from '../../../core/mock/fixtures/conceptos';
import { RefreshTokenStorage } from '../../../core/auth/refresh-token.storage';
import type { BirthSexCode } from '../../../core/data-access/iam/iam.types';
import { SystemContextClient } from '../../../core/data-access/system-context/system-context.client';
import { mockBackendInterceptor } from '../../../core/mock/mock-backend.interceptor';

const RESPUESTA_PRO = {
  userId: 'u',
  personId: 'p',
  practitionerProfileId: 'pp',
  practitionerCode: 'PRO-1',
};

class AlmacenFalso {
  value: string | null = null;
  read(): string | null {
    return this.value;
  }
  write(token: string): void {
    this.value = token;
  }
  clear(): void {
    this.value = null;
  }
}

/** Un concepto de `VS_BO_MUNICIPALITY`: Sacaba, código INE 031001. */
const MUNICIPIO_SACABA = 'ee4f2681-6c58-5f4c-8f83-8d19de56099a';

/**
 * Un archivo del nombre, tipo y peso pedidos.
 *
 * La pantalla recibe los archivos ya elegidos desde `app-file-input`
 * (`(filesChange)`), así que las pruebas entran por ahí y no por un evento
 * `change` armado a mano.
 */
function archivoDe(nombre: string, tipo: string, bytes: number): File {
  const archivo = new File(['x'], nombre, { type: tipo });
  Object.defineProperty(archivo, 'size', { value: bytes });
  return archivo;
}

/** Las tres peticiones de catálogo que dispara el constructor. */
const CATALOGO = '/terminology/value-sets?code=VS_BO_DEPARTMENT';
const CATALOGO_MUNICIPIOS = '/terminology/value-sets?code=VS_BO_MUNICIPALITY';
const CATALOGO_ESPECIALIDADES = '/terminology/value-sets?code=VS_MEDICAL_SPECIALTY';

describe('RegisterPractitioner', () => {
  let fixture: ComponentFixture<RegisterPractitioner>;
  let component: RegisterPractitioner;
  let http: HttpTestingController;
  let navegaciones: string[];

  /**
   * Monta la pantalla.
   *
   * Sin `ActivatedRoute` falso: cada alta tiene su URL y su componente desde
   * que el alta de profesional se separó de la de paciente, así que el tipo de
   * cuenta ya no viaja como dato de ruta ni se lee desde acá.
   */
  async function montar(): Promise<void> {
    navegaciones = [];
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [RegisterPractitioner],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Router real: la plantilla tiene `routerLink` y necesita su contexto.
        provideRouter([]),
        { provide: RefreshTokenStorage, useClass: AlmacenFalso },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    router.navigateByUrl = ((url: string) => {
      navegaciones.push(String(url));
      return Promise.resolve(true);
    }) as Router['navigateByUrl'];

    fixture = TestBed.createComponent(RegisterPractitioner);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await montar();
  });

  afterEach(() => {
    // Los tres catálogos los pide el constructor, así que aparecen en TODAS las
    // pruebas. Las que no hablan de ellos los dan por atendidos acá, para que
    // `verify()` siga vigilando las peticiones que cada prueba sí afirma.
    //
    // Sólo `/terminology/`: el de aseguradoras es del alta de paciente y esta
    // pantalla no lo pide. Se saltean las canceladas: el árbol de municipios es
    // un `forkJoin` de dos lecturas, así que responder la primera con un
    // catálogo vacío la hace fallar y eso cancela la otra en el acto. Volcar una
    // petición ya cancelada es un error de `HttpTestingController`, no un fallo
    // de la pantalla.
    for (const pendiente of http.match((r) => r.url.startsWith('/terminology/'))) {
      if (pendiente.cancelled) continue;
      pendiente.flush({ items: [] });
    }
    // Y el de tipos de título (1.6), que el constructor pide por campo destino.
    // Mismo criterio que los tres de arriba: las pruebas que no hablan de él lo
    // dan por atendido acá para que `verify()` siga sirviendo.
    for (const pendiente of http.match((r) => r.url.startsWith('/system-context/'))) {
      if (pendiente.cancelled) continue;
      pendiente.flush({ options: [] });
    }
    http.verify();
  });

  function completarProfesional(
    extra: Partial<
      Record<
        | 'professionalTitle'
        | 'phone'
        | 'mobilePhone'
        | 'workMobilePhone'
        | 'workLandline'
        | 'personalEmail'
        | 'email'
        | 'middleName'
        | 'thirdName'
        | 'motherLastName'
        | 'nationalId'
        | 'regulatoryAuthority'
        | 'professionalTitleUniversity'
        | 'professionalTitleCountry'
        | 'professionalTitleCity'
        | 'profilePhotoBase64'
        | 'sexAtBirth',
        string | null
      >
    > & { birthDate?: Date | null; especialidadesExtra?: readonly string[] } = {},
  ): void {
    component.formProfesional.setValue({
      name: 'Ana',
      middleName: extra.middleName ?? '',
      thirdName: extra.thirdName ?? '',
      lastName: 'Paz',
      motherLastName: extra.motherLastName ?? '',
      nationalId: extra.nationalId ?? '1234567',
      // `email` es el de TRABAJO, que dejó de ser el de acceso y es opcional;
      // el de acceso es `personalEmail`, obligatorio, de acá abajo.
      email: extra.email ?? '',
      password: 'secreto12',
      licenseNumber: 'MP-12345',
      sedesLicenseNumber: 'T.I. 538/14',
      homeAddressLines: '',
      workAddressLines: '',
      officeName: '',
      officeAddressLines: '',
      regulatoryAuthority: extra.regulatoryAuthority ?? '',
      // Obligatorio desde que dejó de ser «(opcional)»: es lo que dice qué
      // clase de profesional es, y de él dependen el colegio y las
      // especialidades. Las pruebas que lo ejercen lo pisan por `extra`.
      professionalTitle: extra.professionalTitle ?? 'Médico / Médica',
      // Dónde estudió la profesión con la que ejerce. Los tres son opcionales,
      // así que por defecto van vacíos; las pruebas que los ejercen los pisan.
      professionalTitleUniversity: extra.professionalTitleUniversity ?? '',
      professionalTitleCountry: extra.professionalTitleCountry ?? '',
      professionalTitleCity: extra.professionalTitleCity ?? '',
      phone: extra.phone ?? '',
      mobilePhone: extra.mobilePhone ?? '+591 70011111',
      workMobilePhone: extra.workMobilePhone ?? '',
      workLandline: extra.workLandline ?? '',
      // La identidad de acceso: obligatorio, así que tiene valor por defecto.
      personalEmail: extra.personalEmail ?? 'ana.paz@gmail.test',
      // Obligatoria desde que la fecha de nacimiento dejó de ser opcional:
      // mismo criterio que `sexAtBirth` de acá abajo — un valor por defecto
      // para que las pruebas a las que no les importa sigan mandando el
      // formulario, y `extra` para las que sí lo prueban.
      birthDate: extra.birthDate === undefined ? new Date(1985, 4, 12) : extra.birthDate,
      // Ahora obligatorio (AC-05-7): por defecto 'FEMALE' para que las
      // pruebas que no le importa este campo sigan completando y mandando el
      // formulario; las que sí lo prueban lo pasan por `extra` o lo pisan
      // directo en `formProfesional.controls.sexAtBirth`.
      sexAtBirth:
        extra.sexAtBirth === undefined ? 'FEMALE' : (extra.sexAtBirth as BirthSexCode | null),
      licenseIssueDate: null,
      issuerAdministrativeAreaConceptId: 'dep-1',
      profilePhotoBase64: extra.profilePhotoBase64 ?? null,
    });
    // Las especialidades agregadas no son controles: viven en una señal, igual
    // que los nombres extra.
    component.especialidadesExtra.set(extra.especialidadesExtra ?? []);
  }

  /**
   * El alta declarada, campo por campo.
   *
   * Se serializa lo que la pantalla DECIDE —qué se pregunta, en qué orden, con
   * qué rótulo y con qué control—, sin las `options`, que salen del catálogo y
   * cambian con lo que responda la red.
   */
  function estructuraDeclarada() {
    return component.paginasProfesional().map((pagina) => ({
      clave: pagina.clave ?? null,
      titulo: pagina.titulo,
      hint: pagina.hint ?? null,
      campos: pagina.campos.map((campo) => ({
        key: campo.key,
        control: campo.control,
        label: campo.label,
        required: campo.required ?? false,
        testId: campo.testId ?? null,
        ancho: campo.ancho ?? 'completo',
        hint: campo.hint ?? null,
        placeholder: campo.placeholder ?? null,
        autocomplete: campo.autocomplete ?? null,
        icono: campo.icono ?? null,
        mensajeDeError: campo.mensajeDeError ?? null,
      })),
    }));
  }

  /**
   * **El orden del recorrido, y qué pide cada bloque (AC-05-1, AC-05-2).**
   *
   * Acá vivía un volcado literal de las seis páginas, capturado corriendo el
   * componente **antes** de que el alta de profesional saliera de
   * `register-patient`: era la red de seguridad de esa mudanza, y su propio
   * comentario decía que «cuando la tarjeta 05 reordene los campos, este
   * literal se actualiza a propósito y ese diff es la revisión del
   * reordenamiento». Esto es ese momento.
   *
   * Lo que lo reemplaza no comprueba menos, comprueba **otra cosa**: el volcado
   * fijaba que nada hubiera cambiado; estas pruebas fijan lo que el propietario
   * pidió que fuera cierto —el orden de los bloques, qué campos trae cada uno,
   * el tope de cuatro y los tres bloques que NO se preguntan porque no tienen
   * dónde guardarse—. Un volcado literal de nueve páginas se actualiza pegando
   * lo que salga, y entonces deja de revisar nada.
   */
  describe('el recorrido del alta', () => {
    /** Los campos de una página, por su clave. */
    function camposDe(clave: string): readonly string[] | undefined {
      return component
        .paginasProfesional()
        .find((pagina) => pagina.clave === clave)
        ?.campos.map((campo) => campo.key);
    }

    it('presenta los bloques en el orden pedido (AC-05-1)', () => {
      expect(component.paginasProfesional().map((pagina) => pagina.clave)).toEqual([
        'name',
        'document',
        'profile',
        'personal-contact',
        'access',
        'residence',
        'workplace-location',
        // El consultorio propio es una sede del profesional, separada de la
        // dirección laboral que se declara arriba.
        'own-office',
        // El título profesional va ANTES de la habilitación: de él dependen el
        // colegio que se ofrece ahí y la lista de especialidades. Preguntarlo
        // después dejaba las dos cosas eligiéndose a ciegas.
        'practice',
        'credentials',
        // Los respaldos van pegados a la habilitación que respaldan, y los
        // demás títulos justo después: es el orden del registro de procesos.
        'credential-files',
        'academic-titles',
        'specialties',
        // La contraseña cierra el alta, sola: dejó de compartir página con los
        // teléfonos del consultorio y el correo de trabajo.
        'password',
      ]);
    });

    it('cada bloque trae los campos que le tocan, en su orden', () => {
      expect(camposDe('name')).toEqual(['name', 'lastName', 'motherLastName']);
      expect(camposDe('document')).toEqual(['nationalId', 'issuerAdministrativeAreaConceptId']);
      // AC-05-7: el sexo entra al formulario, y va antes de la fecha de
      // nacimiento, como pide el orden.
      // La ocupación se quitó del alta de profesional: lo que dice qué clase de
      // profesional es, es el TÍTULO, y se pregunta en su propia página. En el
      // alta de paciente la ocupación sigue, que es donde tiene sentido.
      expect(camposDe('profile')).toEqual(['sexAtBirth', 'birthDate']);
      // Los cinco contactos que pide el registro, repartidos en dos páginas: lo
      // privado por un lado y lo del trabajo junto al acceso, que es el correo
      // laboral (AC-05-6). La contraseña ya no vive acá: tiene página propia al
      // final, porque no es un dato de contacto ni es opcional como los dos
      // teléfonos con los que compartía pantalla.
      expect(camposDe('personal-contact')).toEqual(['mobilePhone', 'personalEmail']);
      expect(camposDe('access')).toEqual(['workMobilePhone', 'workLandline', 'email']);
      // Las mismas tres piezas que el alta de paciente: la localidad, la calle
      // y el punto del mapa. Era sólo la localidad mientras el DTO del
      // profesional no tuvo dónde poner las otras dos.
      expect(camposDe('residence')).toEqual(['municipio', 'homeAddressLines', 'gpsDomicilio']);
      expect(camposDe('workplace-location')).toEqual(['workAddressLines', 'gpsTrabajo']);
      // El consultorio propio: cuatro campos, todos opcionales. Es un calco del
      // lugar de trabajo del alta de paciente, con el nombre que le da el
      // dominio — quien ejerce puede atender en varios lugares, y éste es el
      // único que no depende de que otro lo acepte.
      expect(camposDe('own-office')).toEqual([
        'officeName',
        'municipioConsultorio',
        'officeAddressLines',
        'gpsConsultorio',
      ]);
      expect(camposDe('credentials')).toEqual([
        'licenseNumber',
        'sedesLicenseNumber',
        'regulatoryAuthority',
        'licenseIssueDate',
      ]);
      expect(camposDe('practice')).toEqual([
        'profilePhotoBase64',
        'professionalTitle',
        // Universidad, país y ciudad entran como UN campo proyectado, igual
        // que los tres nombres: son tres casillas y la página ya está en el
        // tope de cuatro.
        'professionalTitleEducation',
        'professionalTitleFile',
      ]);
      expect(camposDe('specialties')).toEqual(['especialidadesExtra']);
      expect(camposDe('password')).toEqual(['password']);
      expect(camposDe('credential-files')).toEqual(['credentialAttachments']);
      expect(camposDe('academic-titles')).toEqual(['academicTitles']);
    });

    /**
     * Lo que el orden pide y esta pantalla **no** pregunta, porque no tiene
     * dónde guardarse: segundo teléfono y segundo correo (AC-05-6), la **zona**
     * (AC-05-8), la organización (AC-05-9/-10/-11), las tres matrículas por
     * separado (AC-05-5), universidad y otros títulos (AC-05-13).
     *
     * La prueba está para que aparezcan **con su destino**, no de contrabando:
     * el día que alguien agregue el campo sin la columna, esto se pone rojo y
     * dice cuál.
     */
    it('no pregunta lo que no tiene dónde guardarse', () => {
      const claves = component
        .paginasProfesional()
        .flatMap((pagina) => pagina.campos.map((campo) => campo.key));

      for (const ausente of [
        'workPhone',
        'workEmail',
        'homeZone',
        // `homeAddressLines` **salió de esta lista el 08/09/2026**, y con el
        // GPS. No porque la columna haya aparecido: `common.addresses` ya la
        // tenía, y el alta de paciente escribe ahí desde siempre. Lo que
        // faltaba era que el DTO del profesional la recibiera, y eso es una
        // línea de `RegisterPractitionerDto` copiada del de paciente —anotada
        // en `PENDIENTES-BACKEND.md` como condición para el pase a `dev`—.
        //
        // La zona sigue acá porque de ella sí no hay columna para nadie.
        'organizationName',
        'healthFacilityConceptId',
        'ministryLicenseNumber',
        // `sedesLicenseNumber` salió de esta lista: ya tiene destino. Nace como
        // una segunda fila de `profiles.jurisdiction_authorizations` con
        // jurisdicción SEDES — Santa Cruz, al lado de la matrícula nacional.
        // El del colegio profesional sigue sin columna propia.
        'collegeLicenseNumber',
        'issuingInstitutionText',
        'otherCredentials',
      ]) {
        expect(claves, `«${ausente}» no tiene dónde guardarse todavía`).not.toContain(ausente);
      }
    });

    it('cada página declara su ícono', () => {
      for (const pagina of component.paginasProfesional()) {
        expect(pagina.icon, `«${pagina.titulo}» no declara ícono`).toBeDefined();
      }
    });

    /**
     * AC-05-16: sin habilitación no hay alta, y se dice **en el campo**, antes
     * del envío. Los dos números siguen siendo los únicos obligatorios del
     * recorrido además del correo y la contraseña.
     */
    it('la habilitación sigue siendo obligatoria y lo dice en el campo', () => {
      const habilitacion = component
        .paginasProfesional()
        .find((pagina) => pagina.clave === 'credentials');

      const obligatorios = habilitacion?.campos
        .filter((campo) => campo.required === true)
        .map((campo) => campo.key);
      expect(obligatorios).toEqual(['licenseNumber', 'sedesLicenseNumber']);
      for (const campo of habilitacion?.campos ?? []) {
        if (campo.required !== true) continue;
        expect(campo.mensajeDeError, `«${campo.key}» no dice por qué hace falta`).toBeTruthy();
      }
    });
  });

  /**
   * Lo que esta pantalla **declara**, frente a lo que le llega de la red.
   *
   * El rótulo, el control, el ancho y el glifo los decide la pantalla; las
   * `options` salen del catálogo y cambian con lo que responda la API, así que
   * no se fijan acá. Los dos casos que importan:
   *
   * - un rótulo vacío es siempre un campo **proyectado**: el motor le reserva
   *   el sitio y esta pantalla pone adentro lo que el motor no sabe dibujar;
   * - un glifo sale siempre del **set cerrado** del nav. Un nombre fuera del
   *   set no falla: dibuja el ícono neutro y calla, que es el peor fallo
   *   posible —se ve bien y miente—.
   */
  it('declara rótulo y control por campo, y sus glifos salen del set del nav', () => {
    const campos = estructuraDeclarada().flatMap((pagina) => pagina.campos);
    expect(campos.length).toBeGreaterThan(0);

    for (const campo of campos) {
      if (campo.label === '') {
        expect(campo.control, `«${campo.key}» no tiene rótulo y no es proyectado`).toBe('custom');
      }
      if (campo.icono === null) continue;
      expect(NAV_ICON_NAMES, `«${campo.key}» usa un glifo que no está en el set`).toContain(
        campo.icono,
      );
    }
  });

  it('tiene catorce páginas, ninguna de más de cuatro preguntas', () => {
    // Catorce y no menos porque el límite es de **campos por página**, no de
    // páginas: apretar el orden pedido en menos pasos es lo que este motor vino
    // a deshacer (AC-05-2, `MAX_CAMPOS_POR_PAGINA`). Las últimas cuatro son la
    // de contactos privados —separada de la del acceso al dejar de mezclar el
    // número personal con el del consultorio—, las dos de respaldos y títulos
    // —que no caben en la de habilitación, ya llena— y la contraseña, que
    // cierra el alta sola.
    //
    // La página laboral separa dirección/GPS de casa y sede propia, conforme a
    // MED-03. El consultorio propio (08/09/2026) conserva su página porque sus cuatro campos
    // no caben en la de residencia, que ya tiene tres, y meterlos ahí además
    // mezclaría dos lugares distintos en una pregunta.
    const paginas = component.paginasProfesional();

    expect(paginas.length).toBe(14);
    for (const pagina of paginas) {
      expect(
        pagina.campos.length,
        `«${pagina.titulo}» pide ${pagina.campos.length}`,
      ).toBeLessThanOrEqual(4);
    }
  });

  it('cada campo escribe en un control que existe', () => {
    for (const pagina of component.paginasProfesional()) {
      for (const campo of pagina.campos) {
        if (campo.control === 'custom') continue;
        expect(
          component.formProfesional.get(campo.key),
          `el campo «${campo.key}» no existe en el formulario`,
        ).not.toBeNull();
      }
    }
  });

  /**
   * Las especialidades EN el alta — registro del cliente, módulo Médico §1.4.2
   * y §1.4.4.
   *
   * Lo que fijan: que el catálogo completo no se filtra por profesión, que el
   * colegio cambia solo sin pisar una elección explícita, y que los conceptos
   * VIAJAN en el cuerpo — el cliente lo arma nombre por nombre y descarta en
   * silencio lo que no nombra.
   */
  describe('las especialidades del alta', () => {
    /** Responde el catálogo con dos médicas y dos odontológicas. */
    function catalogoDeEspecialidades(): void {
      http.expectOne(CATALOGO_ESPECIALIDADES).flush({
        items: [{ id: 'vs-esp', internalCode: 'VS_MEDICAL_SPECIALTY', name: 'Especialidades' }],
      });
      http.expectOne('/terminology/value-sets/vs-esp/$expand?limit=200').flush({
        items: [
          { conceptId: 'e-cardio', code: 'CARDIOLOGIA', display: 'Cardiología' },
          { conceptId: 'e-pedia', code: 'PEDIATRIA', display: 'Pediatría' },
          { conceptId: 'e-endo', code: 'ENDODONCIA', display: 'Endodoncia' },
          { conceptId: 'e-orto', code: 'ORTODONCIA', display: 'Ortodoncia' },
        ],
        count: 4,
        limit: 200,
        nextCursor: null,
      });
    }

    /**
     * Lo que se ofrece para elegir especialidad. Hasta el 23/09/2026 se leía
     * del desplegable «Especialidad principal» de la página; ese desplegable
     * se retiró (D-01) y ahora se elige sólo en las casillas, que llaman a
     * este mismo método en la plantilla. Las pruebas de abajo fijan que la
     * lista es el catálogo completo para cualquier profesión (L0174).
     */
    function opcionesDeLaPagina(): readonly { value: string; label: string }[] {
      return (
        component as unknown as {
          allSpecialtyOptions: () => readonly { value: string; label: string }[];
        }
      ).allSpecialtyOptions();
    }

    /**
     * **El orden real, que es el que fallaba.**
     *
     * L0174 especifica que la lista de especialidades no se filtra por
     * profesión. La lista debe conservar todas sus opciones antes y después
     * de elegir el título profesional.
     */
    it('conserva el catálogo completo si el título se elige después de leerlo', () => {
      catalogoDeEspecialidades();
      // Se leen una vez, como al pintar el paso: acá el título está vacío y
      // corresponde ofrecer todo.
      expect(opcionesDeLaPagina().map((o) => o.value)).toEqual([
        'e-cardio',
        'e-pedia',
        'e-endo',
        'e-orto',
      ]);

      component.formProfesional.controls.professionalTitle.setValue('Odontólogo / Odontóloga');
      fixture.detectChanges();

      expect(opcionesDeLaPagina().map((o) => o.value)).toEqual([
        'e-cardio',
        'e-pedia',
        'e-endo',
        'e-orto',
      ]);
    });

    it('un odontólogo ve también las especialidades médicas del catálogo', () => {
      catalogoDeEspecialidades();
      component.formProfesional.controls.professionalTitle.setValue('Odontólogo / Odontóloga');
      fixture.detectChanges();

      const valores = opcionesDeLaPagina().map((o) => o.value);
      expect(valores).toEqual(['e-cardio', 'e-pedia', 'e-endo', 'e-orto']);
    });

    it('un médico ve también las especialidades odontológicas del catálogo', () => {
      catalogoDeEspecialidades();
      component.formProfesional.controls.professionalTitle.setValue('Médico / Médica');
      fixture.detectChanges();

      const valores = opcionesDeLaPagina().map((o) => o.value);
      expect(valores).toEqual(['e-cardio', 'e-pedia', 'e-endo', 'e-orto']);
    });

    it('el título profesional se busca con lupa, y sigue siendo lista cerrada', () => {
      // El campo era un `select` nativo con las doce opciones cargadas y sin
      // búsqueda visible, al lado de Ocupación, que sí la tenía. Dos campos
      // vecinos con el mismo trabajo comportándose distinto era la queja.
      const campo = component
        .paginasProfesional()
        .flatMap((pagina) => pagina.campos)
        .find((c) => c.key === 'professionalTitle');

      expect(campo?.control).toBe('custom');
      // Doce, y las doce disponibles sin escribir nada: la lupa acota, no
      // esconde.
      expect(component.titulosProfesionalesFiltrados()).toHaveLength(12);
    });

    it('la lupa filtra en local, sin pedirle nada al servidor', () => {
      component.busquedaTituloProfesional.set('odont');
      const filtradas = component.titulosProfesionalesFiltrados();

      expect(filtradas.length).toBeGreaterThan(0);
      expect(filtradas.every((o) => o.label.toLowerCase().includes('odont'))).toBe(true);
      // Ninguna petición NUEVA: quedan las cuatro lecturas de catálogo que el
      // componente hace al nacer —departamentos, municipios, especialidades y
      // los tipos de título (1.6)— y nada más. Fueron cuatro, tres al quitarse
      // la ocupación, y vuelven a ser cuatro desde que los títulos viajan. La
      // lista de títulos profesionales sigue siendo cerrada y en memoria; si
      // esto empezara a consultar, el número subiría acá antes que en producción.
      expect(http.match(() => true).map((p) => p.request.url)).toEqual([
        '/terminology/value-sets',
        '/terminology/value-sets',
        '/terminology/value-sets',
        '/system-context/dynamic-enums',
      ]);

      // Y sin texto vuelven las doce: escribir y borrar no deja el campo vacío.
      component.busquedaTituloProfesional.set('');
      expect(component.titulosProfesionalesFiltrados()).toHaveLength(12);
    });

    it('elegir en la lupa escribe en el control, y arrastra colegio y especialidades', () => {
      // Lo que esta prueba protege es la CADENA. Si la lupa guardara el título
      // en un estado propio, el campo se vería bien y el colegio dejaría de
      // acomodarse solo: un fallo silencioso, en un formulario de ocho pasos.
      catalogoDeEspecialidades();
      const titulo = component.formProfesional.controls.professionalTitle;
      const autoridad = component.formProfesional.controls.regulatoryAuthority;

      component.elegirTituloProfesional({
        value: 'Odontólogo / Odontóloga',
        label: 'Odontólogo / Odontóloga',
      });

      expect(titulo.value).toBe('Odontólogo / Odontóloga');
      expect(autoridad.value).toBe('Colegio de Odontólogos de Bolivia');
      expect(opcionesDeLaPagina().map((o) => o.label)).toEqual([
        'Cardiología',
        'Pediatría',
        'Endodoncia',
        'Ortodoncia',
      ]);
      // Y el rótulo vuelve al regresar al paso, que es para lo que existe.
      expect(component.tituloProfesionalSeleccionado()?.label).toBe('Odontólogo / Odontóloga');
    });

    it('limpiar la lupa deja el título vacío, no un valor colgado', () => {
      catalogoDeEspecialidades();
      const titulo = component.formProfesional.controls.professionalTitle;
      component.elegirTituloProfesional({ value: 'Médico / Médica', label: 'Médico / Médica' });

      component.elegirTituloProfesional(null);

      expect(titulo.value).toBe('');
      expect(component.tituloProfesionalSeleccionado()).toBeNull();
    });

    it('el colegio cambia solo al elegir la profesión', () => {
      catalogoDeEspecialidades();
      const autoridad = component.formProfesional.controls.regulatoryAuthority;

      component.formProfesional.controls.professionalTitle.setValue('Odontólogo / Odontóloga');
      expect(autoridad.value).toBe('Colegio de Odontólogos de Bolivia');

      component.formProfesional.controls.professionalTitle.setValue('Médico / Médica');
      expect(autoridad.value).toBe('Colegio Médico de Bolivia');
    });

    it('pero NO pisa una autoridad elegida a mano', () => {
      // El automatismo es una ayuda, no una regla: quien eligió SEDES sabe
      // por qué, y verlo cambiar solo sería peor que no tener automatismo.
      catalogoDeEspecialidades();
      const autoridad = component.formProfesional.controls.regulatoryAuthority;
      autoridad.setValue('Servicio Departamental de Salud (SEDES)');

      component.formProfesional.controls.professionalTitle.setValue('Médico / Médica');

      expect(autoridad.value).toBe('Servicio Departamental de Salud (SEDES)');
    });

    it('no pregunta cuál es la especialidad principal: todas son iguales (D-01)', () => {
      catalogoDeEspecialidades();

      expect(Object.keys(component.formProfesional.controls)).not.toContain('specialtyPrimary');
      const rotulos = component
        .paginasProfesional()
        .flatMap((pagina) => [
          pagina.titulo,
          pagina.hint ?? '',
          ...pagina.campos.map((c) => c.label),
        ]);
      expect(rotulos.filter((rotulo) => /principal/i.test(rotulo))).toEqual([]);
    });

    it('las especialidades elegidas VIAJAN en el cuerpo, en orden', () => {
      catalogoDeEspecialidades();
      completarProfesional({
        professionalTitle: 'Médico / Médica',
        especialidadesExtra: ['e-cardio', 'e-pedia'],
      });
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.specialtyConceptIds).toEqual(['e-cardio', 'e-pedia']);
      req.flush(RESPUESTA_PRO);
    });

    it('sin especialidades el cuerpo no las menciona', () => {
      catalogoDeEspecialidades();
      completarProfesional();
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.specialtyConceptIds).toBeUndefined();
      req.flush(RESPUESTA_PRO);
    });

    it('permite una especialidad principal y tres adicionales', () => {
      catalogoDeEspecialidades();
      completarProfesional({
        professionalTitle: 'Médico / Médica',
        especialidadesExtra: ['e-cardio', 'e-pedia', 'e-endo', 'e-orto'],
      });
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.specialtyConceptIds).toEqual([
        'e-cardio',
        'e-pedia',
        'e-endo',
        'e-orto',
      ]);
      req.flush(RESPUESTA_PRO);
    });

    it('no permite sumar una quinta especialidad: el techo de L0174 es cuatro, sin principal (D-01)', () => {
      component.especialidadesExtra.set(['e-cardio', 'e-pedia', 'e-endo', 'e-orto']);

      component.agregarEspecialidad();

      expect(component.especialidadesExtra()).toEqual(['e-cardio', 'e-pedia', 'e-endo', 'e-orto']);
    });

    it('agregar suma una casilla vacía, y quitar saca la que se señala', () => {
      catalogoDeEspecialidades();
      completarProfesional({ especialidadesExtra: [] });

      component.agregarEspecialidad();
      component.agregarEspecialidad();
      expect(component.especialidadesExtra()).toEqual(['', '']);

      component.elegirEspecialidadExtra(0, 'e-pedia');
      component.elegirEspecialidadExtra(1, 'e-endo');
      component.quitarEspecialidad(0);

      expect(component.especialidadesExtra()).toEqual(['e-endo']);
    });

    it('una casilla agregada y vacía no viaja en el cuerpo', () => {
      catalogoDeEspecialidades();
      completarProfesional({
        professionalTitle: 'Médico / Médica',
        especialidadesExtra: ['e-cardio', ''],
      });
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.specialtyConceptIds).toEqual(['e-cardio']);
      req.flush(RESPUESTA_PRO);
    });

    it('cambiar de profesión conserva la especialidad elegida: el catálogo es el mismo (L0174)', () => {
      catalogoDeEspecialidades();
      completarProfesional({ especialidadesExtra: ['e-endo'] });

      component.formProfesional.controls.professionalTitle.setValue('Médico / Médica');

      expect(component.especialidadesExtra()).toEqual(['e-endo']);
    });

    it('elegir la misma dos veces declara una', () => {
      catalogoDeEspecialidades();
      completarProfesional({
        professionalTitle: 'Médico / Médica',
        especialidadesExtra: ['e-cardio', 'e-cardio'],
      });
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.specialtyConceptIds).toEqual(['e-cardio']);
      req.flush(RESPUESTA_PRO);
    });
  });

  describe('rótulos dinámicos de matrícula y colegio según profesión (M-1.4.3)', () => {
    function campoCredencial(key: 'licenseNumber' | 'sedesLicenseNumber') {
      const pagina = component.paginasProfesional().find((p) => p.clave === 'credentials');
      return pagina?.campos.find((c) => c.key === key);
    }

    it('por defecto muestra el rótulo general de matrícula, y el del SEDES fijo', () => {
      expect(campoCredencial('licenseNumber')?.label).toBe('Matrícula profesional');
      expect(campoCredencial('sedesLicenseNumber')?.label).toBe('Registro del SEDES');
    });

    it('al seleccionar Odontólogo cambia a Matrícula de Odontólogo', () => {
      component.formProfesional.controls.professionalTitle.setValue('Odontólogo / Odontóloga');
      fixture.detectChanges();

      expect(campoCredencial('licenseNumber')?.label).toBe('Matrícula de Odontólogo');
      expect(campoCredencial('licenseNumber')?.placeholder).toBe('ODO-12345');
    });

    it('al seleccionar Médico cambia a Matrícula Profesional (Médico)', () => {
      component.formProfesional.controls.professionalTitle.setValue('Médico / Médica');
      fixture.detectChanges();

      expect(campoCredencial('licenseNumber')?.label).toBe('Matrícula Profesional (Médico)');
      expect(campoCredencial('licenseNumber')?.placeholder).toBe('MP-12345');
    });

    /**
     * El SEDES habilita por departamento, no por profesión: su rótulo es el
     * mismo para el odontólogo y para el médico. Antes esta casilla decía
     * «Registro del Colegio» y su contenido terminaba archivado como título de
     * grado — de ahí el «Título universitario · T.I. 538/14» del padrón real.
     */
    it('el rótulo del SEDES no cambia con la profesión', () => {
      for (const profesion of ['Odontólogo / Odontóloga', 'Médico / Médica']) {
        component.formProfesional.controls.professionalTitle.setValue(profesion);
        fixture.detectChanges();
        expect(campoCredencial('sedesLicenseNumber')?.label).toBe('Registro del SEDES');
      }
    });

    it('al cambiar de profesión los rótulos se actualizan reactivamente', () => {
      component.formProfesional.controls.professionalTitle.setValue('Odontólogo / Odontóloga');
      fixture.detectChanges();
      expect(campoCredencial('licenseNumber')?.label).toBe('Matrícula de Odontólogo');

      component.formProfesional.controls.professionalTitle.setValue(
        'Médico especialista / Médica especialista',
      );
      fixture.detectChanges();
      expect(campoCredencial('licenseNumber')?.label).toBe('Matrícula Profesional (Médico)');

      component.formProfesional.controls.professionalTitle.setValue(
        'Licenciado / Licenciada en Nutrición',
      );
      fixture.detectChanges();
      expect(campoCredencial('licenseNumber')?.label).toBe('Matrícula profesional');
      expect(campoCredencial('sedesLicenseNumber')?.label).toBe('Registro del SEDES');
    });
  });

  it('va a otro endpoint que el alta de paciente y manda los seis campos obligatorios', () => {
    completarProfesional();
    component.submit();

    const req = http.expectOne('/iam/auth/register-practitioner');
    expect(req.request.method).toBe('POST');
    // El identificador de acceso es el correo PERSONAL, no el documento ni el
    // de trabajo: viaja en el `email` del DTO, que es el campo de login. El
    // nombre va en partes, igual que en el alta de paciente. Sexo, fecha de
    // nacimiento y título profesional son obligatorios: los dos primeros son
    // dato clínico y el tercero dice qué clase de profesional es, así que los
    // tres forman parte del alta mínima.
    expect(req.request.body).toEqual({
      name: 'Ana',
      lastName: 'Paz',
      nationalId: '1234567',
      email: 'ana.paz@gmail.test',
      // Sin correo institucional, `personalEmail === email`: le dice a la API que
      // es el único y que no lo guarde también como de trabajo (ID-12).
      personalEmail: 'ana.paz@gmail.test',
      password: 'secreto12',
      licenseNumber: 'MP-12345',
      sedesLicenseNumber: 'T.I. 538/14',
      sexAtBirth: 'FEMALE',
      birthDate: '1985-05-12',
      professionalTitle: 'Médico / Médica',
      // No lo escribió nadie: lo pone la pantalla al elegir el título, que es
      // lo que promete su ayuda («el colegio se acomoda solo»). Que aparezca
      // acá es la prueba de que ese automatismo sigue vivo.
      regulatoryAuthority: 'Colegio Médico de Bolivia',
      // Los dos que pasaron a obligatorios con el documento y el contacto
      // privado.
      issuerAdministrativeAreaConceptId: 'dep-1',
      mobilePhone: '+591 70011111',
    });

    req.flush(RESPUESTA_PRO);
  });

  it('sin cédula el formulario no se puede enviar', () => {
    completarProfesional({ nationalId: '' });

    expect(component.formProfesional.controls.nationalId.invalid).toBe(true);

    component.submit();
    http.expectNone('/iam/auth/register-practitioner');
  });

  it('sin departamento de emisión el formulario no se puede enviar', () => {
    completarProfesional();
    component.formProfesional.controls.issuerAdministrativeAreaConceptId.setValue(null);

    expect(component.formProfesional.controls.issuerAdministrativeAreaConceptId.invalid).toBe(true);

    component.submit();
    http.expectNone('/iam/auth/register-practitioner');
  });

  it('sin celular personal el formulario no se puede enviar', () => {
    completarProfesional({ mobilePhone: '' });

    expect(component.formProfesional.controls.mobilePhone.invalid).toBe(true);

    component.submit();
    http.expectNone('/iam/auth/register-practitioner');
  });

  it('sin correo personal el formulario no se puede enviar', () => {
    completarProfesional({ personalEmail: '' });

    expect(component.formProfesional.controls.personalEmail.invalid).toBe(true);

    component.submit();
    http.expectNone('/iam/auth/register-practitioner');
  });

  it('si se ingresa un documento de identidad con formato inválido, el control se invalida', () => {
    completarProfesional({ nationalId: 'CI Con Espacios!' });
    expect(component.formProfesional.controls.nationalId.invalid).toBe(true);
  });

  it('agrega segundo nombre y apellido materno solo si se completaron', () => {
    completarProfesional({ middleName: 'Lucía', motherLastName: 'Rojas' });
    component.submit();

    const req = http.expectOne('/iam/auth/register-practitioner');
    expect(req.request.body.middleName).toBe('Lucía');
    expect(req.request.body.motherLastName).toBe('Rojas');

    req.flush(RESPUESTA_PRO);
  });

  it('manda el tercer nombre concatenado en middleName cuando se completó', () => {
    completarProfesional({ middleName: 'María', thirdName: 'Eugenia', motherLastName: 'Rojas' });
    component.submit();

    const req = http.expectOne('/iam/auth/register-practitioner');
    expect(req.request.body.middleName).toBe('María Eugenia');
    expect(req.request.body.motherLastName).toBe('Rojas');

    req.flush(RESPUESTA_PRO);
  });

  it('manda los nombres agregados dentro de middleName', () => {
    completarProfesional({ middleName: 'María', thirdName: 'Eugenia' });
    component.agregarNombre();
    component.agregarNombre();
    component.agregarNombre();
    component.escribirNombreExtra(0, 'Fernanda');
    // La del medio queda vacía a propósito: no debe dejar un doble espacio.
    component.escribirNombreExtra(2, 'Belén');
    component.submit();

    const req = http.expectOne('/iam/auth/register-practitioner');
    expect(req.request.body.middleName).toBe('María Eugenia Fernanda Belén');

    req.flush(RESPUESTA_PRO);
  });

  it('quitar una casilla agregada saca ese nombre y deja los otros', () => {
    component.agregarNombre();
    component.agregarNombre();
    component.escribirNombreExtra(0, 'Fernanda');
    component.escribirNombreExtra(1, 'Belén');

    component.quitarNombre(0);

    expect(component.nombresExtra()).toEqual(['Belén']);
  });

  it('agrega título y teléfono solo si se completaron', () => {
    completarProfesional({
      professionalTitle: 'Cardiología',
      workMobilePhone: '+591 70012345',
    });
    component.submit();

    const req = http.expectOne('/iam/auth/register-practitioner');
    expect(req.request.body.professionalTitle).toBe('Cardiología');
    expect(req.request.body.workMobilePhone).toBe('+591 70012345');

    req.flush(RESPUESTA_PRO);
  });

  it('manda los cuatro contactos por separado, cada uno con su nombre', () => {
    completarProfesional({
      mobilePhone: '+591 70011111',
      workMobilePhone: '+591 70022222',
      workLandline: '+591 33456789',
      personalEmail: 'ana.paz@gmail.test',
      email: 'ana@hospital.test',
    });
    component.submit();

    const req = http.expectOne('/iam/auth/register-practitioner');
    expect(req.request.body.mobilePhone).toBe('+591 70011111');
    expect(req.request.body.workMobilePhone).toBe('+591 70022222');
    expect(req.request.body.workLandline).toBe('+591 33456789');
    // El de acceso es el PERSONAL, y por eso ocupa el `email` del DTO, que es
    // el campo de login. El institucional viaja aparte, en `workEmail`.
    expect(req.request.body.email).toBe('ana.paz@gmail.test');
    expect(req.request.body.workEmail).toBe('ana@hospital.test');
    // El personal viaja también como `personalEmail`: con `workEmail` la API ya
    // sabe cuál es cuál, y sin él lo necesita para no inventar un correo de
    // trabajo (ID-12).
    expect(req.request.body.personalEmail).toBe('ana.paz@gmail.test');

    req.flush(RESPUESTA_PRO);
  });

  it('manda la dirección y el GPS del trabajo separados del domicilio y del consultorio propio', () => {
    completarProfesional();
    component.formProfesional.patchValue({
      homeAddressLines: 'Casa, Calle Norte 10',
      workAddressLines: 'Hospital Central, Av. Principal 200',
    });
    component.gpsDomicilio.set({ lat: -16.5, lng: -68.11 });
    component.gpsTrabajo.set({ lat: -17.78, lng: -63.18 });

    component.submit();

    const req = http.expectOne('/iam/auth/register-practitioner');
    expect(req.request.body.homeAddressLines).toBe('Casa, Calle Norte 10');
    expect(req.request.body.homeLatitude).toBe(-16.5);
    expect(req.request.body.homeLongitude).toBe(-68.11);
    expect(req.request.body.workAddressLines).toBe('Hospital Central, Av. Principal 200');
    expect(req.request.body.workLatitude).toBe(-17.78);
    expect(req.request.body.workLongitude).toBe(-63.18);
    expect(req.request.body.ownSite).toBeUndefined();

    req.flush(RESPUESTA_PRO);
  });

  /**
   * Títulos y respaldos. **Sólo estado de pantalla**: en esta rama el archivo
   * no se sube a ningún lado y nada de esto viaja en el alta. Lo que se fija
   * acá es el comportamiento visible —agregar varios del mismo tipo, que el
   * adjunto quede pegado a SU título, y que un archivo inválido se rechace—,
   * que es lo que hay que conservar cuando esto se conecte de verdad.
   */
  describe('títulos y respaldos (sólo pantalla)', () => {
    /* ---- El paso, por el DOM ------------------------------------------------
       El motor sólo pinta la página actual y no deja saltar por el índice a un
       paso nunca visitado, así que a «Tus títulos» se llega como la persona:
       «Siguiente» de a uno. Con el paso en pantalla, lo que se prueba son las
       casillas y los botones de verdad, no los métodos que hay detrás. */

    /** El aviso que se lee en pantalla, si hay alguno. */
    function avisoVisible(): string | null {
      fixture.detectChanges();
      const alerta: HTMLElement | null = fixture.nativeElement.querySelector(
        '[data-testid="registro-error"]',
      );
      return alerta === null ? null : (alerta.textContent?.trim() ?? '');
    }

    /** Lleva la pantalla hasta el paso «Tus títulos», «Siguiente» de a uno. */
    function irAlPasoDeTitulos(): void {
      fixture.detectChanges();
      for (let pagina = 0; pagina < 12; pagina += 1) {
        if (fixture.nativeElement.querySelector('.registro-titulos') !== null) return;
        const continuar: HTMLButtonElement | null = fixture.nativeElement.querySelector(
          '[data-testid="paginated-form-continuar"]',
        );
        if (continuar === null) break;
        continuar.click();
        fixture.detectChanges();
      }
      throw new Error('No se llegó al paso «Tus títulos»');
    }

    /** Un elemento del paso por su `data-testid`, o nada. */
    function enElPaso<T extends HTMLElement>(testId: string): T | null {
      fixture.detectChanges();
      return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
    }

    /** La casilla del número de la fila, en el DOM del paso. */
    function casillaDeNumero(id: string): HTMLInputElement {
      const casilla = enElPaso<HTMLInputElement>(`registro-pro-titulo-numero-${id}`);
      if (casilla === null) throw new Error('La fila no está en el DOM');
      return casilla;
    }

    /** Escribe en una casilla como lo hace el teclado: valor + evento `input`. */
    function escribirEnCasilla(testId: string, valor: string): void {
      const casilla = enElPaso<HTMLInputElement>(testId);
      if (casilla === null) throw new Error(`No está la casilla ${testId}`);
      casilla.value = valor;
      casilla.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
    }

    /** Pulsa un botón del paso. */
    function pulsar(testId: string): void {
      const boton = enElPaso<HTMLButtonElement>(testId);
      if (boton === null) throw new Error(`No está el botón ${testId}`);
      boton.click();
      fixture.detectChanges();
    }

    it('permite cargar más de un título del mismo tipo', () => {
      component.agregarTitulo('UNIVERSITARIO');
      component.agregarTitulo('UNIVERSITARIO');
      component.agregarTitulo('MAESTRIA');

      expect(component.titulosDe('UNIVERSITARIO')).toHaveLength(2);
      expect(component.titulosDe('MAESTRIA')).toHaveLength(1);
      expect(component.titulosDe('DOCTORADO')).toHaveLength(0);
    });

    it('el adjunto queda pegado al título al que se le cargó, no a otro', () => {
      component.agregarTitulo('DIPLOMADO');
      component.agregarTitulo('DIPLOMADO');
      const [primero, segundo] = component.titulosDe('DIPLOMADO');

      component.updateTitleFiles(segundo.id, [archivoDe('gestion.pdf', 'application/pdf', 1024)]);

      const despues = component.titulosDe('DIPLOMADO');
      expect(despues.find((t) => t.id === primero.id)?.archivo).toBeNull();
      expect(despues.find((t) => t.id === segundo.id)?.archivo).toBe('gestion.pdf');
    });

    it('quitar un título se lleva su adjunto y deja los otros', () => {
      component.agregarTitulo('DOCTORADO');
      component.agregarTitulo('DOCTORADO');
      const [primero, segundo] = component.titulosDe('DOCTORADO');
      component.updateTitleFiles(primero.id, [archivoDe('tesis.pdf', 'application/pdf', 2048)]);

      component.quitarTitulo(primero.id);

      expect(component.titulosDe('DOCTORADO').map((t) => t.id)).toEqual([segundo.id]);
    });

    // Las dos pruebas que ejercían el rechazo por formato y por peso desde esta
    // pantalla se retiraron con el código que las sostenía: sus dos métodos no
    // los llamaba ninguna plantilla desde que los adjuntos pasaron a
    // `app-file-input`. Quien rechaza hoy es esa molécula, y esa regla se
    // prueba en su propio spec (`file-input.spec.ts`).

    it('los dos respaldos de la habilitación son independientes', () => {
      component.updateSupportFiles('license', [
        archivoDe('matricula.pdf', 'application/pdf', 1024),
      ]);
      component.updateSupportFiles('sedes', [archivoDe('sedes.jpg', 'image/jpeg', 2048)]);

      expect(component.respaldoMatricula()?.archivo).toBe('matricula.pdf');
      expect(component.respaldoSedes()?.archivo).toBe('sedes.jpg');

      component.updateSupportFiles('license', []);

      expect(component.respaldoMatricula()).toBeNull();
      expect(component.respaldoSedes()?.archivo).toBe('sedes.jpg');
    });

    it('una segunda profesión guarda su universidad, su país y su ciudad', () => {
      component.agregarTitulo('UNIVERSITARIO');
      const [profesion] = component.titulosDe('UNIVERSITARIO');

      component.escribirDatoDeTitulo(profesion.id, 'nombre', 'Derecho');
      component.escribirDatoDeTitulo(
        profesion.id,
        'universidad',
        'Universidad Gabriel René Moreno',
      );
      component.escribirDatoDeTitulo(profesion.id, 'pais', 'Bolivia');
      component.escribirDatoDeTitulo(profesion.id, 'ciudad', 'Santa Cruz de la Sierra');

      const [despues] = component.titulosDe('UNIVERSITARIO');
      expect(despues.nombre).toBe('Derecho');
      expect(despues.universidad).toBe('Universidad Gabriel René Moreno');
      expect(despues.pais).toBe('Bolivia');
      expect(despues.ciudad).toBe('Santa Cruz de la Sierra');
    });

    /**
     * El pedido del propietario, entero: «hay doctores que aparte de ser
     * doctores han estudiado otra profesión … cada uno con su respectiva
     * universidad, lugar de estudio y pdf de su diploma».
     */
    it('dos profesiones distintas no se pisan: cada una con su universidad y su diploma', () => {
      component.agregarTitulo('UNIVERSITARIO');
      component.agregarTitulo('UNIVERSITARIO');
      const [primera, segunda] = component.titulosDe('UNIVERSITARIO');

      component.escribirDatoDeTitulo(primera.id, 'nombre', 'Medicina');
      component.escribirDatoDeTitulo(primera.id, 'universidad', 'Universidad Mayor de San Andrés');
      component.escribirDatoDeTitulo(primera.id, 'ciudad', 'La Paz');
      component.updateTitleFiles(primera.id, [archivoDe('medicina.pdf', 'application/pdf', 1024)]);

      component.escribirDatoDeTitulo(segunda.id, 'nombre', 'Ingeniería de Sistemas');
      component.escribirDatoDeTitulo(segunda.id, 'universidad', 'Universidad Privada Boliviana');
      component.escribirDatoDeTitulo(segunda.id, 'ciudad', 'Cochabamba');
      component.updateTitleFiles(segunda.id, [archivoDe('sistemas.pdf', 'application/pdf', 2048)]);

      const [a, b] = component.titulosDe('UNIVERSITARIO');
      expect([a.nombre, a.universidad, a.ciudad, a.archivo]).toEqual([
        'Medicina',
        'Universidad Mayor de San Andrés',
        'La Paz',
        'medicina.pdf',
      ]);
      expect([b.nombre, b.universidad, b.ciudad, b.archivo]).toEqual([
        'Ingeniería de Sistemas',
        'Universidad Privada Boliviana',
        'Cochabamba',
        'sistemas.pdf',
      ]);
    });

    it('ninguna profesión extra es obligatoria: el alta se manda sin cargar ninguna', () => {
      expect(component.titulosDe('UNIVERSITARIO')).toHaveLength(0);

      completarProfesional();
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      req.flush(RESPUESTA_PRO);
      expect(component.registered()).toBe(true);
    });

    it('quitar una profesión se lleva su universidad y deja intacta la otra', () => {
      component.agregarTitulo('UNIVERSITARIO');
      component.agregarTitulo('UNIVERSITARIO');
      const [primera, segunda] = component.titulosDe('UNIVERSITARIO');
      component.escribirDatoDeTitulo(primera.id, 'universidad', 'La que se va');
      component.escribirDatoDeTitulo(segunda.id, 'universidad', 'La que queda');

      component.quitarTitulo(primera.id);

      const quedan = component.titulosDe('UNIVERSITARIO');
      expect(quedan).toHaveLength(1);
      expect(quedan[0].universidad).toBe('La que queda');
    });

    it('el título con el que ejerce lleva su universidad y su lugar de estudio', () => {
      component.escribirEstudio('professionalTitleUniversity', 'Universidad Mayor de San Simón');
      component.escribirEstudio('professionalTitleCountry', 'Bolivia');
      component.escribirEstudio('professionalTitleCity', 'Cochabamba');

      expect(component.valorDeEstudio('professionalTitleUniversity')).toBe(
        'Universidad Mayor de San Simón',
      );
      expect(component.valorDeEstudio('professionalTitleCountry')).toBe('Bolivia');
      expect(component.valorDeEstudio('professionalTitleCity')).toBe('Cochabamba');
    });

    /**
     * Responde el catálogo de tipos de título, que el constructor pide por
     * campo destino. Sin él resuelto, una fila con número no se puede mandar:
     * el contrato exige el concepto y la pantalla no lo inventa.
     */
    function catalogoDeTiposDeTitulo(): void {
      http
        .expectOne((r) => r.url.startsWith('/system-context/dynamic-enums'))
        .flush({
          code: 'professional-credential-type',
          name: 'Tipo de credencial profesional',
          definitionId: 'def-1',
          valueSetId: 'vs-cred',
          options: [
            { conceptId: 'c-degree', code: 'CREDENTIAL_TYPE_DEGREE', label: 'Academic degree' },
            { conceptId: 'c-diploma', code: 'CREDENTIAL_TYPE_DIPLOMA', label: 'Diploma course' },
            { conceptId: 'c-master', code: 'CREDENTIAL_TYPE_MASTER', label: "Master's degree" },
          ],
        });
    }

    it('los títulos declarados VIAJAN en el alta, uno por fila', () => {
      catalogoDeTiposDeTitulo();
      component.agregarTitulo('UNIVERSITARIO');
      component.agregarTitulo('MAESTRIA');
      const [profesion] = component.titulosDe('UNIVERSITARIO');
      const [maestria] = component.titulosDe('MAESTRIA');
      component.escribirDatoDeTitulo(profesion.id, 'numero', 'TIT-1');
      component.escribirDatoDeTitulo(
        profesion.id,
        'universidad',
        'Universidad Mayor de San Andrés',
      );
      component.escribirDatoDeTitulo(maestria.id, 'numero', 'MAE-9');

      completarProfesional();
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.credentials).toEqual([
        {
          credentialTypeConceptId: 'c-degree',
          number: 'TIT-1',
          issuingInstitutionText: 'Universidad Mayor de San Andrés',
        },
        { credentialTypeConceptId: 'c-master', number: 'MAE-9' },
      ]);
      req.flush(RESPUESTA_PRO);
    });

    it('la universidad del título principal viaja en la fila universitaria que ya tiene número (ID-10)', () => {
      catalogoDeTiposDeTitulo();
      component.agregarTitulo('UNIVERSITARIO');
      const [profesion] = component.titulosDe('UNIVERSITARIO');
      component.escribirDatoDeTitulo(profesion.id, 'numero', 'TIT-1');
      completarProfesional({ professionalTitleUniversity: 'Universidad Mayor de San Andrés' });
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.credentials).toEqual([
        {
          credentialTypeConceptId: 'c-degree',
          number: 'TIT-1',
          issuingInstitutionText: 'Universidad Mayor de San Andrés',
        },
      ]);
      req.flush(RESPUESTA_PRO);
    });

    it('con la universidad del título principal y ninguna fila que la lleve, el alta se frena y lo dice', () => {
      catalogoDeTiposDeTitulo();
      completarProfesional({ professionalTitleUniversity: 'Universidad Mayor de San Andrés' });
      component.submit();

      http.expectNone('/iam/auth/register-practitioner');
      expect(component.errorMessage()).toContain('La universidad de tu título principal');
    });

    it('una universidad distinta en la fila no se pisa: la del título principal necesita su propia fila', () => {
      catalogoDeTiposDeTitulo();
      component.agregarTitulo('UNIVERSITARIO');
      const [profesion] = component.titulosDe('UNIVERSITARIO');
      component.escribirDatoDeTitulo(profesion.id, 'numero', 'TIT-1');
      component.escribirDatoDeTitulo(profesion.id, 'universidad', 'Universidad Privada Boliviana');
      completarProfesional({ professionalTitleUniversity: 'Universidad Mayor de San Andrés' });
      component.submit();

      http.expectNone('/iam/auth/register-practitioner');
      expect(component.errorMessage()).toContain('La universidad de tu título principal');
    });

    it('dos filas del mismo tipo viajan como dos credenciales', () => {
      catalogoDeTiposDeTitulo();
      component.agregarTitulo('UNIVERSITARIO');
      component.agregarTitulo('UNIVERSITARIO');
      const [primera, segunda] = component.titulosDe('UNIVERSITARIO');
      component.escribirDatoDeTitulo(primera.id, 'numero', 'TIT-1');
      component.escribirDatoDeTitulo(segunda.id, 'numero', 'TIT-2');

      completarProfesional();
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(
        (req.request.body.credentials as readonly { number: string }[]).map((c) => c.number),
      ).toEqual(['TIT-1', 'TIT-2']);
      req.flush(RESPUESTA_PRO);
    });

    it('sube el PDF de cada fila y envía su fileId antes del alta', () => {
      catalogoDeTiposDeTitulo();
      component.agregarTitulo('UNIVERSITARIO');
      component.agregarTitulo('MAESTRIA');
      const [carrera] = component.titulosDe('UNIVERSITARIO');
      const [maestria] = component.titulosDe('MAESTRIA');
      const pdfCarrera = archivoDe('medicina.pdf', 'application/pdf', 1024);
      const pdfMaestria = archivoDe('salud-publica.pdf', 'application/pdf', 2048);
      component.escribirDatoDeTitulo(carrera.id, 'numero', 'TIT-1');
      component.escribirDatoDeTitulo(maestria.id, 'numero', 'MAE-1');
      component.updateTitleFiles(carrera.id, [pdfCarrera]);
      component.updateTitleFiles(maestria.id, [pdfMaestria]);
      completarProfesional();

      component.submit();

      const primeraSubida = http.expectOne('/iam/auth/upload-registration-document');
      expect((primeraSubida.request.body as FormData).get('file')).toBe(pdfCarrera);
      primeraSubida.flush({
        fileId: 'file-title-1',
        originalName: pdfCarrera.name,
        sizeBytes: 1024,
        mimeType: 'application/pdf',
      });

      const segundaSubida = http.expectOne('/iam/auth/upload-registration-document');
      expect((segundaSubida.request.body as FormData).get('file')).toBe(pdfMaestria);
      segundaSubida.flush({
        fileId: 'file-title-2',
        originalName: pdfMaestria.name,
        sizeBytes: 2048,
        mimeType: 'application/pdf',
      });

      const alta = http.expectOne('/iam/auth/register-practitioner');
      expect(alta.request.body.credentials).toEqual([
        { credentialTypeConceptId: 'c-degree', number: 'TIT-1', fileId: 'file-title-1' },
        { credentialTypeConceptId: 'c-master', number: 'MAE-1', fileId: 'file-title-2' },
      ]);
      alta.flush(RESPUESTA_PRO);
    });

    it('si falla una subida, el alta no sale y el reintento reutiliza el PDF ya subido', () => {
      catalogoDeTiposDeTitulo();
      component.agregarTitulo('UNIVERSITARIO');
      component.agregarTitulo('MAESTRIA');
      const [carrera] = component.titulosDe('UNIVERSITARIO');
      const [maestria] = component.titulosDe('MAESTRIA');
      const pdfCarrera = archivoDe('medicina.pdf', 'application/pdf', 1024);
      const pdfMaestria = archivoDe('salud-publica.pdf', 'application/pdf', 2048);
      component.escribirDatoDeTitulo(carrera.id, 'numero', 'TIT-1');
      component.escribirDatoDeTitulo(maestria.id, 'numero', 'MAE-1');
      component.updateTitleFiles(carrera.id, [pdfCarrera]);
      component.updateTitleFiles(maestria.id, [pdfMaestria]);
      completarProfesional();

      component.submit();
      http.expectOne('/iam/auth/upload-registration-document').flush({
        fileId: 'file-title-1',
        originalName: pdfCarrera.name,
        sizeBytes: 1024,
        mimeType: 'application/pdf',
      });
      http.expectOne('/iam/auth/upload-registration-document').flush(null, {
        status: 422,
        statusText: 'Unprocessable Entity',
      });
      http.expectNone('/iam/auth/register-practitioner');

      component.submit();

      const reintento = http.expectOne('/iam/auth/upload-registration-document');
      expect((reintento.request.body as FormData).get('file')).toBe(pdfMaestria);
      reintento.flush({
        fileId: 'file-title-2',
        originalName: pdfMaestria.name,
        sizeBytes: 2048,
        mimeType: 'application/pdf',
      });
      const alta = http.expectOne('/iam/auth/register-practitioner');
      expect(alta.request.body.credentials).toEqual([
        { credentialTypeConceptId: 'c-degree', number: 'TIT-1', fileId: 'file-title-1' },
        { credentialTypeConceptId: 'c-master', number: 'MAE-1', fileId: 'file-title-2' },
      ]);
      alta.flush(RESPUESTA_PRO);
    });

    it('sin títulos el cuerpo no los menciona', () => {
      catalogoDeTiposDeTitulo();
      completarProfesional();
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.credentials).toBeUndefined();
      req.flush(RESPUESTA_PRO);
    });

    /**
     * El defecto que esto fija: la guardia frenaba el envío **en silencio**.
     * Quien completaba la universidad y se olvidaba del número llegaba al
     * último paso, pulsaba «Crear cuenta» y no pasaba nada, sin saber qué
     * corregir ni dónde. No alcanza con no llamar a la API.
     */
    /**
     * Una fila de diplomado con universidad y sin número, hecha por el DOM del
     * paso: «+ Agregar» y teclado. Devuelve el id de la fila.
     */
    function filaDeDiplomadoSinNumero(): string {
      irAlPasoDeTitulos();
      pulsar('registro-pro-agregar-DIPLOMADO');
      const [fila] = component.titulosDe('DIPLOMADO');
      escribirEnCasilla(`registro-pro-titulo-universidad-${fila.id}`, 'Nur');
      return fila.id;
    }

    it('una fila con datos y sin número frena el envío, lo dice en pantalla y marca la fila', () => {
      catalogoDeTiposDeTitulo();
      completarProfesional();
      const id = filaDeDiplomadoSinNumero();

      component.submit();
      fixture.detectChanges();

      http.expectNone('/iam/auth/register-practitioner');

      // 1) El aviso se VE: el alert vive fuera del motor, así que se lee desde
      // cualquier paso, y `appAnuncio` lo anuncia a lectores de pantalla.
      expect(avisoVisible()).toContain('número de diploma');
      // 2) Y dirige al paso donde está el campo: el índice de pasos es navegable.
      expect(avisoVisible()).toContain('Tus títulos');
      // 3) La fila señalada es la que está mal, EN el DOM: `aria-invalid`,
      //    el borde de peligro y el mensaje propio, enlazado por
      //    `aria-describedby` para que el lector lo diga junto a la casilla.
      const casilla = casillaDeNumero(id);
      expect(casilla.getAttribute('aria-invalid')).toBe('true');
      expect(casilla.classList.contains('registro-titulo__dato--invalido')).toBe(true);
      expect(casilla.getAttribute('aria-describedby')).toBe(
        `registro-pro-titulo-numero-error-${id}`,
      );
      expect(enElPaso(`registro-pro-titulo-numero-error-${id}`)?.textContent).toContain(
        'Falta el número',
      );
    });

    it('completar el número en la casilla borra el aviso, desmarca la fila y deja enviar', () => {
      catalogoDeTiposDeTitulo();
      completarProfesional();
      const id = filaDeDiplomadoSinNumero();
      component.submit();
      expect(avisoVisible()).not.toBeNull();

      // Las filas no viven en el `FormGroup`, así que escribir el número no
      // dispara `valueChanges`: sin la limpieza propia, el aviso se quedaría
      // contradiciendo a la pantalla.
      escribirEnCasilla(`registro-pro-titulo-numero-${id}`, 'DIP-7');

      expect(avisoVisible()).toBeNull();
      const casilla = casillaDeNumero(id);
      expect(casilla.getAttribute('aria-invalid')).toBeNull();
      expect(casilla.classList.contains('registro-titulo__dato--invalido')).toBe(false);
      expect(enElPaso(`registro-pro-titulo-numero-error-${id}`)).toBeNull();

      component.submit();
      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.credentials).toEqual([
        { credentialTypeConceptId: 'c-diploma', number: 'DIP-7', issuingInstitutionText: 'Nur' },
      ]);
      req.flush(RESPUESTA_PRO);
    });

    it('el botón «Quitar» de la fila problemática la saca del paso y borra el aviso', () => {
      catalogoDeTiposDeTitulo();
      completarProfesional();
      const id = filaDeDiplomadoSinNumero();
      component.submit();
      expect(avisoVisible()).not.toBeNull();

      pulsar(`registro-pro-titulo-quitar-${id}`);

      expect(avisoVisible()).toBeNull();
      expect(enElPaso(`registro-pro-titulo-numero-${id}`)).toBeNull();
      expect(component.titulosDe('DIPLOMADO')).toHaveLength(0);
    });

    it('las casillas acotan lo que el contrato acota: número 100, universidad 200', () => {
      catalogoDeTiposDeTitulo();
      completarProfesional();
      const id = filaDeDiplomadoSinNumero();

      // El exceso se frena en la casilla, no como un 400 en inglés técnico.
      expect(casillaDeNumero(id).getAttribute('maxlength')).toBe('100');
      expect(
        enElPaso<HTMLInputElement>(`registro-pro-titulo-universidad-${id}`)?.getAttribute(
          'maxlength',
        ),
      ).toBe('200');
      // País y ciudad no viajan todavía, así que no se les impone un tope.
      expect(
        enElPaso<HTMLInputElement>(`registro-pro-titulo-pais-${id}`)?.hasAttribute('maxlength'),
      ).toBe(false);
      expect(
        enElPaso<HTMLInputElement>(`registro-pro-titulo-ciudad-${id}`)?.hasAttribute('maxlength'),
      ).toBe(false);
    });

    it('el paso dice qué se guarda hoy y qué se completa después desde el perfil', () => {
      catalogoDeTiposDeTitulo();
      completarProfesional();
      irAlPasoDeTitulos();

      // Sin esta línea la pantalla prometía guardar lo que descarta: el nombre,
      // el país, la ciudad y el diploma se preguntan pero no viajan.
      const alcance = (enElPaso('registro-pro-titulos-alcance')?.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim();
      expect(alcance).toBe(
        'En esta alta se guardan el tipo, el número, la universidad y el PDF de cada título. ' +
          'El nombre, el país y la ciudad que completes aquí todavía no se guardan. ' +
          'Si falla una carga, podés reintentar y se conservan las que ya subieron.',
      );
    });

    it('una fila agregada y vacía no frena ni viaja', () => {
      catalogoDeTiposDeTitulo();
      component.agregarTitulo('DOCTORADO');

      completarProfesional();
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.credentials).toBeUndefined();
      req.flush(RESPUESTA_PRO);
    });

    it('lo que no tiene dónde guardarse sigue sin viajar', () => {
      catalogoDeTiposDeTitulo();
      component.agregarTitulo('UNIVERSITARIO');
      const [titulo] = component.titulosDe('UNIVERSITARIO');
      component.escribirDatoDeTitulo(titulo.id, 'numero', 'TIT-1');
      component.escribirNombreDeTitulo(titulo.id, 'Medicina');
      component.escribirDatoDeTitulo(titulo.id, 'pais', 'Bolivia');
      component.escribirDatoDeTitulo(titulo.id, 'ciudad', 'La Paz');
      component.updateTitleFiles(titulo.id, [archivoDe('medicina.pdf', 'application/pdf', 1024)]);
      component.escribirEstudio('professionalTitleUniversity', 'Universidad Mayor de San Simón');

      completarProfesional();
      component.submit();

      http.expectOne('/iam/auth/upload-registration-document').flush({
        fileId: 'file-title-1',
        originalName: 'medicina.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
      });
      const req = http.expectOne('/iam/auth/register-practitioner');
      // La credencial lleva tipo, número, institución y el fileId del PDF. El
      // nombre del título, el país y la ciudad no se envían: no tienen columna.
      expect(req.request.body.credentials).toEqual([
        { credentialTypeConceptId: 'c-degree', number: 'TIT-1', fileId: 'file-title-1' },
      ]);
      expect(req.request.body.academicTitles).toBeUndefined();
      expect(req.request.body.credentialAttachments).toBeUndefined();
      expect(req.request.body.professionalTitleUniversity).toBeUndefined();
      expect(req.request.body.professionalTitleCountry).toBeUndefined();
      expect(req.request.body.professionalTitleCity).toBeUndefined();
      req.flush(RESPUESTA_PRO);
    });

    /**
     * El defecto que esto fija: el catálogo se leía UNA sola vez, en el
     * constructor, y un fallo dejaba el mapa vacío para toda la vida de la
     * pantalla. El aviso mandaba «volvé al paso y reintentá», pero volver de
     * paso no pedía nada: sin recargar la página no había salida.
     */
    describe('cuando el catálogo de tipos no carga', () => {
      /** La lectura que hace el constructor, caída. */
      function catalogoDeTiposCaido(): void {
        http
          .expectOne((r) => r.url.startsWith('/system-context/dynamic-enums'))
          .flush(null, { status: 503, statusText: 'Service Unavailable' });
      }

      /** La respuesta buena, con los cinco tipos que publica la API. */
      function catalogoDeTiposCompleto(): void {
        http
          .expectOne((r) => r.url.startsWith('/system-context/dynamic-enums'))
          .flush({
            code: 'professional-credential-type',
            name: 'Tipo de credencial profesional',
            definitionId: 'def-1',
            valueSetId: 'vs-cred',
            options: [
              { conceptId: 'c-degree', code: 'CREDENTIAL_TYPE_DEGREE', label: 'Academic degree' },
              { conceptId: 'c-diploma', code: 'CREDENTIAL_TYPE_DIPLOMA', label: 'Diploma course' },
              { conceptId: 'c-master', code: 'CREDENTIAL_TYPE_MASTER', label: "Master's degree" },
              { conceptId: 'c-doctor', code: 'CREDENTIAL_TYPE_DOCTORATE', label: 'Doctorate' },
              { conceptId: 'c-spec', code: 'CREDENTIAL_TYPE_SPECIALTY', label: 'Specialty' },
            ],
          });
      }

      /** Una fila lista para viajar: la que el catálogo caído deja varada. */
      function filaConNumero(): void {
        component.agregarTitulo('UNIVERSITARIO');
        const [fila] = component.titulosDe('UNIVERSITARIO');
        component.escribirDatoDeTitulo(fila.id, 'numero', 'TIT-1');
        component.escribirDatoDeTitulo(fila.id, 'universidad', 'Universidad Mayor de San Simón');
      }

      /** El botón «Reintentar» del paso, tal como está en el DOM, o nada. */
      function botonReintentar(): HTMLButtonElement | null {
        return enElPaso<HTMLButtonElement>('registro-pro-titulos-reintentar');
      }

      /**
       * El defecto que esto fija, en su segunda forma: el aviso decía «el botón
       * Reintentar vuelve a pedirlos» y en el paso no había ningún botón. El
       * botón colgaba de una bandera que sólo encendía el `error` del
       * observable, y el alert del mapa vacío. Acá se recorre la cadena entera
       * y por el DOM: fallo → botón en el paso → clic real → GET → 200 →
       * catálogo → alert fuera → lo escrito, intacto.
       */
      it('con la carga caída, «Reintentar» está en el paso y el clic real recupera el catálogo', () => {
        catalogoDeTiposCaido();
        filaConNumero();
        const [fila] = component.titulosDe('UNIVERSITARIO');
        completarProfesional();
        component.submit();

        // Frenado y dicho, nombrando el botón.
        http.expectNone('/iam/auth/register-practitioner');
        expect(avisoVisible()).toContain('Reintentar');
        expect(avisoVisible()).not.toContain('reintentá en unos segundos');

        // El botón existe donde el aviso manda a buscarlo, y es el mismo
        // estado: si el alert está, el botón está.
        irAlPasoDeTitulos();
        const boton = botonReintentar();
        expect(boton).not.toBeNull();
        expect(casillaDeNumero(fila.id).value).toBe('TIT-1');

        // Clic de verdad sobre el `<button>`: dispara el GET.
        boton?.click();
        catalogoDeTiposCompleto();
        fixture.detectChanges();

        // Catálogo repoblado, aviso y botón fuera, lo escrito sigue ahí.
        expect(component.catalogoTiposDeTituloCaido()).toBe(false);
        expect(botonReintentar()).toBeNull();
        expect(avisoVisible()).toBeNull();
        expect(casillaDeNumero(fila.id).value).toBe('TIT-1');
        expect(component.titulosDe('UNIVERSITARIO')[0].universidad).toBe(
          'Universidad Mayor de San Simón',
        );
      });

      it('tras el reintento con éxito, el envío arma credentials[] con lo escrito', () => {
        catalogoDeTiposCaido();
        filaConNumero();
        completarProfesional();
        component.submit();
        irAlPasoDeTitulos();

        botonReintentar()?.click();
        catalogoDeTiposCompleto();
        fixture.detectChanges();

        component.submit();

        const req = http.expectOne('/iam/auth/register-practitioner');
        expect(req.request.body.credentials).toEqual([
          {
            credentialTypeConceptId: 'c-degree',
            number: 'TIT-1',
            issuingInstitutionText: 'Universidad Mayor de San Simón',
          },
        ]);
        req.flush(RESPUESTA_PRO);
      });

      it('un segundo fallo deja el botón y el aviso, y el alta sigue sin salir', () => {
        catalogoDeTiposCaido();
        filaConNumero();
        completarProfesional();
        component.submit();
        irAlPasoDeTitulos();

        botonReintentar()?.click();
        catalogoDeTiposCaido();
        fixture.detectChanges();

        expect(botonReintentar()).not.toBeNull();
        expect(avisoVisible()).toContain('Reintentar');

        component.submit();
        http.expectNone('/iam/auth/register-practitioner');
      });

      it('un 200 sin los tipos también enciende el botón: manda el mapa, no el error', () => {
        // La forma exacta que dejó el botón ausente en el E2E: respuesta
        // correcta pero inútil. Con la bandera de `error` no había botón.
        http
          .expectOne((r) => r.url.startsWith('/system-context/dynamic-enums'))
          .flush({
            code: 'professional-credential-type',
            name: 'Tipo de credencial profesional',
            definitionId: 'def-1',
            valueSetId: 'vs-cred',
            options: [],
          });
        filaConNumero();
        completarProfesional();
        component.submit();

        http.expectNone('/iam/auth/register-practitioner');
        expect(avisoVisible()).toContain('Reintentar');
        irAlPasoDeTitulos();
        expect(botonReintentar()).not.toBeNull();
      });

      it('el aviso del número que falta NO se borra cuando el catálogo carga', () => {
        catalogoDeTiposCaido();
        component.agregarTitulo('DIPLOMADO');
        const [fila] = component.titulosDe('DIPLOMADO');
        component.escribirDatoDeTitulo(fila.id, 'universidad', 'Nur');
        completarProfesional();
        component.submit();
        expect(avisoVisible()).toContain('número de diploma');
        irAlPasoDeTitulos();

        botonReintentar()?.click();
        catalogoDeTiposCompleto();

        // El catálogo ya está, pero la fila sigue sin número: retirar este
        // aviso de rebote dejaría el envío frenado y la pantalla muda.
        expect(avisoVisible()).toContain('número de diploma');
      });
    });
  });

  it('sin título profesional no manda el alta: dice qué clase de profesional es', () => {
    completarProfesional({ professionalTitle: '' });
    component.submit();

    http.expectNone('/iam/auth/register-practitioner');
    expect(component.formProfesional.controls.professionalTitle.invalid).toBe(true);
  });

  it('el diploma del título es opcional y vive en el mismo paso que el título', () => {
    const practice = component.paginasProfesional().find((p) => p.clave === 'practice');
    const campo = practice?.campos.find((c) => c.key === 'professionalTitleFile');

    expect(campo).toBeDefined();
    expect(campo?.required ?? false).toBe(false);
    // Y el título de al lado sí es obligatorio: son dos cosas distintas.
    expect(practice?.campos.find((c) => c.key === 'professionalTitle')?.required).toBe(true);
  });

  it('sin correo personal no manda el alta: es la identidad de acceso', () => {
    completarProfesional({ personalEmail: '' });
    component.submit();

    http.expectNone('/iam/auth/register-practitioner');
    expect(component.formProfesional.controls.personalEmail.invalid).toBe(true);
  });

  it('el correo de trabajo es opcional y no viaja si está vacío', () => {
    completarProfesional({ email: '' });
    expect(component.formProfesional.controls.email.valid).toBe(true);
    component.submit();

    const req = http.expectOne('/iam/auth/register-practitioner');
    expect(req.request.body.workEmail).toBeUndefined();
    expect(req.request.body.email).toBe('ana.paz@gmail.test');

    req.flush(RESPUESTA_PRO);
  });

  it('no manda el campo viejo de teléfono, que mezclaba lo privado con el trabajo', () => {
    completarProfesional({ mobilePhone: '+591 70011111' });
    component.submit();

    const req = http.expectOne('/iam/auth/register-practitioner');
    expect(req.request.body.phone).toBeUndefined();

    req.flush(RESPUESTA_PRO);
  });

  it('manda el municipio de residencia, sin su departamento', () => {
    completarProfesional();
    component.municipioProfesional.set(MUNICIPIO_SACABA);
    component.submit();

    const req = http.expectOne('/iam/auth/register-practitioner');
    expect(req.request.body.residenceMunicipalityConceptId).toBe(MUNICIPIO_SACABA);
    expect(Object.keys(req.request.body as Record<string, unknown>)).not.toContain(
      'residenceAdministrativeAreaConceptId',
    );

    req.flush(RESPUESTA_PRO);
  });

  /**
   * AC-05-7. El DTO aceptaba `sexAtBirth` desde siempre —lo declara
   * `RegisterPractitionerDto`—; lo que faltaba era **preguntarlo**. Es
   * obligatorio: dato clínico —dosis, valores de referencia, tamizajes—, no
   * una cortesía demográfica.
   */
  it('manda el sexo elegido', () => {
    completarProfesional();
    component.formProfesional.controls.sexAtBirth.setValue('FEMALE');
    component.submit();

    const req = http.expectOne('/iam/auth/register-practitioner');
    expect(req.request.body.sexAtBirth).toBe('FEMALE');

    req.flush(RESPUESTA_PRO);
  });

  /**
   * Vacío no viaja: `forbidNonWhitelisted` rechaza lo que sobra, y una cadena
   * vacía no es lo mismo que la ausencia del campo.
   */
  /** Obligatorio: sin elegirlo, el `submit` no viaja — mismo criterio que matrícula/credencial. */
  it('sin sexo elegido, no se manda el alta', () => {
    completarProfesional({ sexAtBirth: null });
    component.submit();

    expect(component.formProfesional.controls.sexAtBirth.touched).toBe(true);
    // No se gastó un viaje a la API: lo confirma el `verify()` del `afterEach`.
  });

  /**
   * La edad manda en dosis, valores de referencia y tamizajes: dejarla opcional
   * era una ficha incompleta que después hay que perseguir.
   */
  it('sin fecha de nacimiento, no se manda el alta', () => {
    completarProfesional({ birthDate: null });
    component.submit();

    expect(component.formProfesional.controls.birthDate.touched).toBe(true);
    expect(component.formProfesional.controls.birthDate.invalid).toBe(true);
  });

  it('con fecha de nacimiento, viaja en el alta', () => {
    completarProfesional({ birthDate: new Date(1985, 4, 12) });
    component.submit();

    const req = http.expectOne('/iam/auth/register-practitioner');
    expect(req.request.body.birthDate).toBe('1985-05-12');
    req.flush(RESPUESTA_PRO);
  });

  it('exige matrícula y credencial: sin habilitación no hay alta', () => {
    completarProfesional();
    component.formProfesional.patchValue({ licenseNumber: '', sedesLicenseNumber: '' });
    component.submit();

    expect(component.formProfesional.controls.licenseNumber.touched).toBe(true);
    // A qué página lleva un campo inválido lo decide el motor, y lo fija su
    // propia prueba. Acá lo que importa es que no se gastó un viaje a la API:
    // lo confirma el `verify()` del `afterEach`.
  });

  it('la confirmación dice que se entra con el correo, no con el documento', () => {
    completarProfesional();
    component.submit();
    http.expectOne('/iam/auth/register-practitioner').flush(RESPUESTA_PRO);

    expect(component.registered()).toBe(true);
    expect(component.accessHint).toBe('tu correo');
  });

  it('tras registrarse, lleva al login en vez de entrar solo', () => {
    // El endpoint no devuelve tokens: entrar automáticamente exigiría un
    // segundo viaje con las credenciales recién escritas.
    completarProfesional();
    component.submit();
    http.expectOne('/iam/auth/register-practitioner').flush(RESPUESTA_PRO);

    component.goToLogin();

    expect(navegaciones).toEqual(['/auth']);
  });

  describe('catálogos', () => {
    it('un 401 no rompe el registro: deja el aviso y el formulario usable', () => {
      http.expectOne(CATALOGO).flush(null, { status: 401, statusText: 'Unauthorized' });
      fixture.detectChanges();

      expect(component.catalogoDepartamentosCaido()).toBe(true);
      expect(component.opcionesDepartamento()).toEqual([]);
      // El registro sigue en pie: el 401 del catálogo no navega a ningún lado.
      expect(navegaciones).toEqual([]);
    });

    it('sin catálogo de municipios el alta sigue: el campo es opcional', () => {
      http
        .expectOne(CATALOGO_MUNICIPIOS)
        .flush(null, { status: 503, statusText: 'Service Unavailable' });
      fixture.detectChanges();

      expect(component.catalogoMunicipiosCaido()).toBe(true);
      expect(component.ramasMunicipios()).toEqual([]);
      expect(navegaciones).toEqual([]);
    });
  });

  describe('foto de perfil del profesional (subida y previsualización)', () => {
    const FOTO_BASE64_TEST = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD';

    it('envía profilePhotoBase64 en el cuerpo cuando se carga una foto', () => {
      completarProfesional();
      component.formProfesional.controls.profilePhotoBase64.setValue(FOTO_BASE64_TEST);
      component.fotoBase64.set(FOTO_BASE64_TEST);

      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.profilePhotoBase64).toBe(FOTO_BASE64_TEST);
      req.flush(RESPUESTA_PRO);
    });

    it('omite profilePhotoBase64 cuando no se sube ninguna foto', () => {
      completarProfesional();
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.profilePhotoBase64).toBeUndefined();
      req.flush(RESPUESTA_PRO);
    });

    it('quitarFoto limpia la señal y el control', () => {
      component.fotoBase64.set(FOTO_BASE64_TEST);
      component.formProfesional.controls.profilePhotoBase64.setValue(FOTO_BASE64_TEST);

      component.quitarFoto();

      expect(component.fotoBase64()).toBeNull();
      expect(component.formProfesional.controls.profilePhotoBase64.value).toBeNull();
    });

    it('alSeleccionarFoto rechaza formatos no permitidos', () => {
      const archivoTxt = new File(['hola'], 'test.txt', { type: 'text/plain' });
      const fakeInput = { files: [archivoTxt], value: 'test.txt' } as unknown as HTMLInputElement;

      component.alSeleccionarFoto({ target: fakeInput } as unknown as Event);

      expect(component.errorFoto()).toBe('El formato de la imagen debe ser JPG, PNG o WebP.');
      expect(component.fotoBase64()).toBeNull();
    });

    it('alSeleccionarFoto rechaza archivos mayores a 5 MB', () => {
      const archivoGigante = new File([new ArrayBuffer(6 * 1024 * 1024)], 'foto.jpg', {
        type: 'image/jpeg',
      });
      const fakeInput = {
        files: [archivoGigante],
        value: 'foto.jpg',
      } as unknown as HTMLInputElement;

      component.alSeleccionarFoto({ target: fakeInput } as unknown as Event);

      expect(component.errorFoto()).toBe('La imagen supera el límite de 5 MB.');
      expect(component.fotoBase64()).toBeNull();
    });
  });

  /* ==========================================================================
     El catálogo que el filtro necesita.

     Las dos listas de especialidad —la del odontólogo y la del resto— salen de
     partir `VS_MEDICAL_SPECIALTY` por código. Un filtro por código es mudo si
     el catálogo habla otro vocabulario: no falla, no avisa, sencillamente
     devuelve nada. Fue lo que pasó en la rama `mockup` el 08/09/2026 — el
     backend simulado tenía sus dieciocho especialidades con códigos propios
     (`SP-ODONTO`…), ninguno de estos once acertaba, y quien elegía «Odontólogo»
     llegaba al paso de especialidades y no tenía ninguna que elegir.

     Se comprueba contra el catálogo del simulador porque es el único de los
     dos que este repositorio puede leer. Es también el que sirve la maqueta que
     el stakeholder recorre, así que es exactamente donde el hueco apareció.
     ========================================================================== */
  describe('el filtro de especialidades odontológicas', () => {
    it('cada código que nombra existe en el catálogo', () => {
      for (const codigo of ESPECIALIDADES_ODONTOLOGICAS) {
        expect(ESPECIALIDAD[codigo], codigo).toBeDefined();
      }
    });

    it('deja médicas de sobra del otro lado', () => {
      // La otra mitad del corte: si el complemento quedara vacío, el filtro
      // estaría bien escrito y aun así ninguna profesión médica tendría qué
      // ofrecer. Son las 52 restantes de las 63.
      const medicas = Object.keys(ESPECIALIDAD).filter(
        (codigo) => !ESPECIALIDADES_ODONTOLOGICAS.has(codigo),
      );

      expect(medicas.length).toBeGreaterThan(40);
    });
  });

  /* ==========================================================================
     El consultorio propio.

     La regla que lo gobierna: la página entera es opcional, así que lo que
     decide si viaja no es un campo obligatorio sino que haya **algo que
     guardar**. Exigir el nombre haría que quien completa la dirección y se
     olvida del rótulo pierda lo escrito sin que nadie se lo diga.
     ========================================================================== */
  describe('el consultorio propio', () => {
    function cuerpoDelAlta(): Record<string, unknown> {
      component.submit();
      const req = http.expectOne('/iam/auth/register-practitioner');
      const cuerpo = req.request.body as Record<string, unknown>;
      req.flush(RESPUESTA_PRO);
      return cuerpo;
    }

    it('sin nada declarado, no viaja', () => {
      completarProfesional();

      expect(cuerpoDelAlta()['ownSite']).toBeUndefined();
    });

    it('con sólo el nombre, viaja sin dirección', () => {
      completarProfesional();
      component.formProfesional.patchValue({ officeName: 'Consultorio Suárez' });

      // Sin dirección y no con una vacía: una dirección vacía no es «sin
      // dirección», es una fila vacía en `common.addresses`. Misma regla que
      // `work-history.ts` al registrar una sede desde el perfil.
      expect(cuerpoDelAlta()['ownSite']).toEqual({ name: 'Consultorio Suárez' });
    });

    it('con sólo la calle, viaja igual y con nombre por omisión', () => {
      // El caso que motiva la regla: quien escribe la dirección y no el rótulo
      // no pierde lo que escribió. `NewOwnSite.name` es obligatorio del lado
      // del backend, así que se manda uno genérico y se renombra después.
      completarProfesional();
      component.formProfesional.patchValue({ officeAddressLines: 'Calle Libertad #120' });

      expect(cuerpoDelAlta()['ownSite']).toEqual({
        name: 'Mi consultorio',
        address: { lines: ['Calle Libertad #120'] },
      });
    });

    it('con sólo el punto del mapa, viaja con la dirección que tiene', () => {
      completarProfesional();
      component.gpsConsultorio.set({ lat: -17.78, lng: -63.18 });

      expect(cuerpoDelAlta()['ownSite']).toEqual({
        name: 'Mi consultorio',
        // `lines` vacío y no ausente: el contrato lo declara obligatorio, y una
        // sede ubicada en el mapa sin calle escrita es un caso corriente.
        address: { lines: [], latitude: -17.78, longitude: -63.18 },
      });
    });

    it('con todo, arma el cuerpo de `NewOwnSite`', () => {
      completarProfesional();
      component.formProfesional.patchValue({
        officeName: 'Consultorio Suárez',
        officeAddressLines: 'Calle Libertad #120',
      });
      component.municipioConsultorio.set('mun-1');
      component.gpsConsultorio.set({ lat: -17.78, lng: -63.18 });

      expect(cuerpoDelAlta()['ownSite']).toEqual({
        name: 'Consultorio Suárez',
        address: {
          lines: ['Calle Libertad #120'],
          municipalityConceptId: 'mun-1',
          latitude: -17.78,
          longitude: -63.18,
        },
      });
    });

    it('es un lugar distinto del domicilio, y no se pisan', () => {
      // Hay quien vive en una ciudad y atiende en otra. Las dos localidades y
      // los dos puntos son señales separadas: confirmar uno no confirma el otro.
      completarProfesional();
      component.municipioProfesional.set('mun-casa');
      component.gpsDomicilio.set({ lat: -16.5, lng: -68.11 });
      component.municipioConsultorio.set('mun-trabajo');
      component.gpsConsultorio.set({ lat: -17.78, lng: -63.18 });

      const cuerpo = cuerpoDelAlta();

      expect(cuerpo['residenceMunicipalityConceptId']).toBe('mun-casa');
      expect(cuerpo['homeLatitude']).toBe(-16.5);
      expect(cuerpo['ownSite']).toEqual({
        name: 'Mi consultorio',
        address: {
          lines: [],
          municipalityConceptId: 'mun-trabajo',
          latitude: -17.78,
          longitude: -63.18,
        },
      });
    });
  });
});

describe('RegisterPractitioner con mockBackend', () => {
  it('resuelve los cinco tipos canónicos de credencial desde el backend simulado', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [RegisterPractitioner],
      providers: [
        provideHttpClient(withInterceptors([mockBackendInterceptor])),
        provideRouter([]),
        { provide: RefreshTokenStorage, useClass: AlmacenFalso },
      ],
    }).compileComponents();

    const target = 'profiles.professional_credentials.credential_type_concept_id';
    const enumeracion = await firstValueFrom(
      TestBed.inject(SystemContextClient).dynamicEnum(target),
    );
    const fixture = TestBed.createComponent(RegisterPractitioner);
    const component = fixture.componentInstance;
    await fixture.whenStable();
    const conceptos = (
      component as unknown as {
        conceptoPorCodigo: () => ReadonlyMap<string, string>;
      }
    ).conceptoPorCodigo();
    const codigosCanonicos = [
      'CREDENTIAL_TYPE_DEGREE',
      'CREDENTIAL_TYPE_DIPLOMA',
      'CREDENTIAL_TYPE_MASTER',
      'CREDENTIAL_TYPE_DOCTORATE',
      'CREDENTIAL_TYPE_SPECIALTY',
    ];

    expect(codigosCanonicos.map((code) => conceptos.get(code))).toEqual(
      enumeracion.options.map((option) => option.conceptId),
    );

    fixture.destroy();
    // Tope propio, medido y no a ojo: esta prueba monta el alta entera contra el
    // backend simulado, y ese simulador demora cada respuesta a propósito —de 120
    // a 300 ms, `core/mock/mock-backend.interceptor.ts`— para que los estados de
    // carga se puedan ver. El arranque del alta tarda ~10,4 s en asentarse: más
    // que los 5 s por defecto de Vitest. Con 20 s pasa, aislada y dentro de la
    // suite; no se debilitó ninguna aserción.
  }, 20_000);
});
