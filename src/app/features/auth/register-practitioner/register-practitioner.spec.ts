import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { NAV_ICON_NAMES } from '../../../shared/components/atoms/nav-icon/nav-icon.types';
import { RegisterPractitioner } from './register-practitioner';
import { RefreshTokenStorage } from '../../../core/auth/refresh-token.storage';
import type { BirthSexCode } from '../../../core/data-access/iam/iam.types';

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
        | 'specialtyPrimary'
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
      officeName: '',
      officeAddressLines: '',
      regulatoryAuthority: extra.regulatoryAuthority ?? '',
      // Obligatorio desde que dejó de ser «(opcional)»: es lo que dice qué
      // clase de profesional es, y de él dependen el colegio y las
      // especialidades. Las pruebas que lo ejercen lo pisan por `extra`.
      professionalTitle: extra.professionalTitle ?? 'Médico / Médica',
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
        extra.sexAtBirth === undefined
          ? 'FEMALE'
          : (extra.sexAtBirth as BirthSexCode | null),
      licenseIssueDate: null,
      issuerAdministrativeAreaConceptId: 'dep-1',
      specialtyPrimary: extra.specialtyPrimary ?? '',
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
        // El consultorio propio va pegado al domicilio: son las dos preguntas
        // de «dónde», y separarlas dejaba la del trabajo perdida entre los
        // títulos. Es opcional, y aun así el lugar desde el que se publica la
        // agenda mientras ninguna organización lo haya aceptado.
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
      expect(camposDe('document')).toEqual([
        'nationalId',
        'issuerAdministrativeAreaConceptId',
      ]);
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
        'professionalTitleFile',
      ]);
      expect(camposDe('specialties')).toEqual(['specialtyPrimary', 'especialidadesExtra']);
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
        expect(claves, `«${ausente}» no tiene dónde guardarse todavía`).not.toContain(
          ausente,
        );
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
        expect(campo.control, `«${campo.key}» no tiene rótulo y no es proyectado`).toBe(
          'custom',
        );
      }
      if (campo.icono === null) continue;
      expect(NAV_ICON_NAMES, `«${campo.key}» usa un glifo que no está en el set`).toContain(
        campo.icono,
      );
    }
  });

  it('tiene trece páginas, ninguna de más de cuatro preguntas', () => {
    // Trece y no menos porque el límite es de **campos por página**, no de
    // páginas: apretar el orden pedido en menos pasos es lo que este motor vino
    // a deshacer (AC-05-2, `MAX_CAMPOS_POR_PAGINA`). Las últimas cuatro son la
    // de contactos privados —separada de la del acceso al dejar de mezclar el
    // número personal con el del consultorio—, las dos de respaldos y títulos
    // —que no caben en la de habilitación, ya llena— y la contraseña, que
    // cierra el alta sola.
    //
    // La treceava es el **consultorio propio** (08/09/2026): sus cuatro campos
    // no caben en la de residencia, que ya tiene tres, y meterlos ahí además
    // mezclaría dos lugares distintos en una pregunta.
    const paginas = component.paginasProfesional();

    expect(paginas.length).toBe(13);
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
   * Lo que fijan: que se ofrecen las de la profesión elegida y no las otras
   * (un odontólogo no es cardiólogo), que el colegio cambia solo sin pisar una
   * elección explícita, y que los conceptos VIAJAN en el cuerpo — el cliente
   * lo arma nombre por nombre y descarta en silencio lo que no nombra.
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

    function opcionesDeLaPagina(): readonly { value: string; label: string }[] {
      const pagina = component.paginasProfesional().find((p) => p.titulo === 'Tus especialidades');
      return (pagina?.campos[0].options ?? []) as readonly {
        value: string;
        label: string;
      }[];
    }

    /**
     * **El orden real, que es el que fallaba.**
     *
     * Las dos pruebas de abajo ponen el título ANTES de leer las páginas por
     * primera vez, y así pasaban incluso con el defecto: el `computed` se
     * estrenaba con el título ya elegido. En la pantalla el orden es el
     * inverso —el catálogo llega al abrir el paso, la persona elige su
     * profesión después—, y ahí el `computed` ya estaba calculado con el
     * título vacío y no volvía a correr, porque el valor de un `FormControl`
     * no es una señal y no lo despierta.
     *
     * Resultado en producción: un odontólogo veía las 52 médicas con las 11
     * suyas al final. El stakeholder lo reportó como «no están las
     * especialidades de odontología».
     */
    it('filtra aunque las opciones ya se hayan leído antes de elegir profesión', () => {
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

      expect(opcionesDeLaPagina().map((o) => o.value)).toEqual(['e-endo', 'e-orto']);
    });

    it('un odontólogo ve las odontológicas y NO las médicas', () => {
      catalogoDeEspecialidades();
      component.formProfesional.controls.professionalTitle.setValue('Odontólogo / Odontóloga');
      fixture.detectChanges();

      const valores = opcionesDeLaPagina().map((o) => o.value);
      expect(valores).toEqual(['e-endo', 'e-orto']);
    });

    it('un médico ve las médicas y NO las odontológicas', () => {
      catalogoDeEspecialidades();
      component.formProfesional.controls.professionalTitle.setValue('Médico / Médica');
      fixture.detectChanges();

      const valores = opcionesDeLaPagina().map((o) => o.value);
      expect(valores).toEqual(['e-cardio', 'e-pedia']);
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
      // Ninguna petición NUEVA: quedan las tres lecturas de catálogo que el
      // componente hace al nacer —departamentos, municipios y especialidades— y
      // nada más. Eran cuatro hasta que se quitó la ocupación del alta de
      // profesional. La lista de títulos es cerrada y ya está en memoria; si
      // esto empezara a consultar, el número subiría acá antes que en producción.
      expect(http.match(() => true).map((p) => p.request.url)).toEqual([
        '/terminology/value-sets',
        '/terminology/value-sets',
        '/terminology/value-sets',
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
      expect(opcionesDeLaPagina().map((o) => o.label)).toEqual(['Endodoncia', 'Ortodoncia']);
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

    it('cambiar de profesión limpia una especialidad que ya no corresponde', () => {
      // Un desplegable con un valor que no está entre sus opciones muestra un
      // vacío que miente: parece que no elegiste y el cuerpo lo manda igual.
      catalogoDeEspecialidades();
      component.formProfesional.controls.professionalTitle.setValue('Odontólogo / Odontóloga');
      component.formProfesional.controls.specialtyPrimary.setValue('e-endo');

      component.formProfesional.controls.professionalTitle.setValue('Médico / Médica');

      expect(component.formProfesional.controls.specialtyPrimary.value).toBe('');
    });

    it('las especialidades elegidas VIAJAN en el cuerpo, en orden', () => {
      catalogoDeEspecialidades();
      completarProfesional({
        professionalTitle: 'Médico / Médica',
        specialtyPrimary: 'e-cardio',
        especialidadesExtra: ['e-pedia'],
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

    it('se pueden declarar más de tres especialidades', () => {
      catalogoDeEspecialidades();
      completarProfesional({
        professionalTitle: 'Médico / Médica',
        specialtyPrimary: 'e-cardio',
        especialidadesExtra: ['e-pedia', 'e-endo', 'e-orto'],
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
        specialtyPrimary: 'e-cardio',
        especialidadesExtra: [''],
      });
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.specialtyConceptIds).toEqual(['e-cardio']);
      req.flush(RESPUESTA_PRO);
    });

    it('cambiar de profesión limpia también una especialidad agregada', () => {
      catalogoDeEspecialidades();
      completarProfesional({ especialidadesExtra: ['e-endo'] });

      component.formProfesional.controls.professionalTitle.setValue('Médico / Médica');

      expect(component.especialidadesExtra()).toEqual(['']);
    });

    it('elegir la misma dos veces declara una', () => {
      catalogoDeEspecialidades();
      completarProfesional({
        professionalTitle: 'Médico / Médica',
        specialtyPrimary: 'e-cardio',
        especialidadesExtra: ['e-cardio'],
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

      component.formProfesional.controls.professionalTitle.setValue('Médico especialista / Médica especialista');
      fixture.detectChanges();
      expect(campoCredencial('licenseNumber')?.label).toBe('Matrícula Profesional (Médico)');

      component.formProfesional.controls.professionalTitle.setValue('Licenciado / Licenciada en Nutrición');
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
      // privado. `personalEmail` NO está: desde que es la identidad de acceso
      // viaja en `email`, que es el campo de login del DTO.
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

    expect(component.formProfesional.controls.issuerAdministrativeAreaConceptId.invalid).toBe(
      true,
    );

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
    expect(req.request.body.personalEmail).toBeUndefined();

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
    /** Un evento `change` de un `<input type="file">` con el archivo dado. */
    function eventoDeArchivo(nombre: string, tipo: string, bytes: number): Event {
      const archivo = new File(['x'], nombre, { type: tipo });
      Object.defineProperty(archivo, 'size', { value: bytes });
      const entrada = document.createElement('input');
      entrada.type = 'file';
      Object.defineProperty(entrada, 'files', { value: [archivo] });
      return { target: entrada } as unknown as Event;
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

      component.adjuntarArchivoATitulo(
        segundo.id,
        eventoDeArchivo('gestion.pdf', 'application/pdf', 1024),
      );

      const despues = component.titulosDe('DIPLOMADO');
      expect(despues.find((t) => t.id === primero.id)?.archivo).toBeNull();
      expect(despues.find((t) => t.id === segundo.id)?.archivo).toBe('gestion.pdf');
    });

    it('quitar un título se lleva su adjunto y deja los otros', () => {
      component.agregarTitulo('DOCTORADO');
      component.agregarTitulo('DOCTORADO');
      const [primero, segundo] = component.titulosDe('DOCTORADO');
      component.adjuntarArchivoATitulo(
        primero.id,
        eventoDeArchivo('tesis.pdf', 'application/pdf', 2048),
      );

      component.quitarTitulo(primero.id);

      expect(component.titulosDe('DOCTORADO').map((t) => t.id)).toEqual([segundo.id]);
    });

    it('rechaza un formato que no es PDF ni imagen, y no lo adjunta', () => {
      component.agregarTitulo('MAESTRIA');
      const [titulo] = component.titulosDe('MAESTRIA');

      component.adjuntarArchivoATitulo(
        titulo.id,
        eventoDeArchivo('titulo.docx', 'application/msword', 1024),
      );

      expect(component.errorAdjunto()).toBe('El respaldo tiene que ser un PDF, un JPG o un PNG.');
      expect(component.titulosDe('MAESTRIA')[0].archivo).toBeNull();
    });

    it('rechaza un archivo de más de 5 MB', () => {
      component.adjuntarRespaldo(
        'license',
        eventoDeArchivo('matricula.pdf', 'application/pdf', 6 * 1024 * 1024),
      );

      expect(component.errorAdjunto()).toBe('El archivo supera el límite de 5 MB.');
      expect(component.respaldoMatricula()).toBeNull();
    });

    it('los dos respaldos de la habilitación son independientes', () => {
      component.adjuntarRespaldo(
        'license',
        eventoDeArchivo('matricula.pdf', 'application/pdf', 1024),
      );
      component.adjuntarRespaldo('sedes', eventoDeArchivo('sedes.jpg', 'image/jpeg', 2048));

      expect(component.respaldoMatricula()?.archivo).toBe('matricula.pdf');
      expect(component.respaldoSedes()?.archivo).toBe('sedes.jpg');

      component.quitarRespaldo('license');

      expect(component.respaldoMatricula()).toBeNull();
      expect(component.respaldoSedes()?.archivo).toBe('sedes.jpg');
    });

    it('nada de esto viaja en el alta todavía: es sólo pantalla', () => {
      component.agregarTitulo('UNIVERSITARIO');
      const [titulo] = component.titulosDe('UNIVERSITARIO');
      component.escribirNombreDeTitulo(titulo.id, 'Medicina');
      component.adjuntarArchivoATitulo(
        titulo.id,
        eventoDeArchivo('medicina.pdf', 'application/pdf', 1024),
      );
      component.adjuntarRespaldo(
        'license',
        eventoDeArchivo('matricula.pdf', 'application/pdf', 1024),
      );
      completarProfesional();
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.academicTitles).toBeUndefined();
      expect(req.request.body.credentialAttachments).toBeUndefined();
      req.flush(RESPUESTA_PRO);
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
      const fakeInput = { files: [archivoGigante], value: 'foto.jpg' } as unknown as HTMLInputElement;

      component.alSeleccionarFoto({ target: fakeInput } as unknown as Event);

      expect(component.errorFoto()).toBe('La imagen supera el límite de 5 MB.');
      expect(component.fotoBase64()).toBeNull();
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
        address: { lines: [], municipalityConceptId: 'mun-trabajo', latitude: -17.78, longitude: -63.18 },
      });
    });
  });
});
