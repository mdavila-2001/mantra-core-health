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
        | 'middleName'
        | 'thirdName'
        | 'motherLastName'
        | 'nationalId'
        | 'regulatoryAuthority'
        | 'specialtyPrimary'
        | 'specialtySecond'
        | 'specialtyThird'
        | 'profilePhotoBase64'
        | 'occupationConceptId'
        | 'occupationFreeText'
        | 'sexAtBirth',
        string | null
      >
    > & { birthDate?: Date | null } = {},
  ): void {
    component.formProfesional.setValue({
      name: 'Ana',
      middleName: extra.middleName ?? '',
      thirdName: extra.thirdName ?? '',
      lastName: 'Paz',
      motherLastName: extra.motherLastName ?? '',
      nationalId: extra.nationalId ?? '1234567',
      email: 'ana@hospital.test',
      password: 'secreto12',
      licenseNumber: 'MP-12345',
      sedesLicenseNumber: 'T.I. 538/14',
      regulatoryAuthority: extra.regulatoryAuthority ?? '',
      professionalTitle: extra.professionalTitle ?? '',
      phone: extra.phone ?? '',
      mobilePhone: extra.mobilePhone ?? '',
      workMobilePhone: extra.workMobilePhone ?? '',
      workLandline: extra.workLandline ?? '',
      personalEmail: extra.personalEmail ?? '',
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
      // Obligatoria por el mismo motivo. `o-1` es el mismo id que usan las
      // pruebas de ocupación de más abajo; las que prueban el campo lo pisan
      // por `extra`.
      occupationConceptId:
        extra.occupationConceptId === undefined ? 'o-1' : extra.occupationConceptId,
      occupationFreeText: extra.occupationFreeText ?? '',
      licenseIssueDate: null,
      issuerAdministrativeAreaConceptId: null,
      specialtyPrimary: extra.specialtyPrimary ?? '',
      specialtySecond: extra.specialtySecond ?? '',
      specialtyThird: extra.specialtyThird ?? '',
      profilePhotoBase64: extra.profilePhotoBase64 ?? null,
    });
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
        'credentials',
        'practice',
        'specialties',
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
      expect(camposDe('profile')).toEqual(['sexAtBirth', 'birthDate', 'occupationConceptId']);
      // Los cinco contactos que pide el registro, repartidos en dos páginas: lo
      // privado por un lado y lo del trabajo junto al acceso, que es el correo
      // laboral (AC-05-6).
      expect(camposDe('personal-contact')).toEqual(['mobilePhone', 'personalEmail']);
      expect(camposDe('access')).toEqual([
        'workMobilePhone',
        'workLandline',
        'email',
        'password',
      ]);
      expect(camposDe('residence')).toEqual(['municipio']);
      expect(camposDe('credentials')).toEqual([
        'licenseNumber',
        'sedesLicenseNumber',
        'regulatoryAuthority',
        'licenseIssueDate',
      ]);
      expect(camposDe('practice')).toEqual(['profilePhotoBase64', 'professionalTitle']);
      expect(camposDe('specialties')).toEqual([
        'specialtyPrimary',
        'specialtySecond',
        'specialtyThird',
      ]);
    });

    /**
     * Lo que el orden pide y esta pantalla **no** pregunta, porque no tiene
     * dónde guardarse: segundo teléfono y segundo correo (AC-05-6), zona,
     * dirección y GPS (AC-05-8), la organización (AC-05-9/-10/-11), las tres
     * matrículas por separado (AC-05-5), universidad y otros títulos
     * (AC-05-13).
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
        'homeAddressLines',
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

  it('tiene nueve páginas, ninguna de más de cuatro preguntas', () => {
    // Nueve y no menos porque el límite es de **campos por página**, no de
    // páginas: apretar el orden pedido en menos pasos es lo que este motor vino
    // a deshacer (AC-05-2, `MAX_CAMPOS_POR_PAGINA`). La novena es la de los
    // contactos privados, que se separó de la del acceso al dejar de mezclar el
    // número personal con el del consultorio.
    const paginas = component.paginasProfesional();

    expect(paginas.length).toBe(9);
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
      // Ninguna petición NUEVA: quedan las cuatro lecturas de catálogo que el
      // componente hace al nacer —departamentos, municipios, especialidades y
      // ocupaciones— y nada más. La lista de títulos es cerrada y ya está en
      // memoria; si esto empezara a consultar, el número subiría acá antes que en
      // producción.
      expect(http.match(() => true).map((p) => p.request.url)).toEqual([
        '/terminology/value-sets',
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
        specialtySecond: 'e-pedia',
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

    it('elegir la misma dos veces declara una', () => {
      catalogoDeEspecialidades();
      completarProfesional({
        professionalTitle: 'Médico / Médica',
        specialtyPrimary: 'e-cardio',
        specialtySecond: 'e-cardio',
      });
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.specialtyConceptIds).toEqual(['e-cardio']);
      req.flush(RESPUESTA_PRO);
    });
  });

  describe('ocupación normada y buscador (M-1.4.1 / M-1.4.2)', () => {
    it('el bloque de perfil incluye el campo de ocupación', () => {
      const profile = component.paginasProfesional().find((p) => p.clave === 'profile');
      expect(profile?.campos.map((c) => c.key)).toEqual([
        'sexAtBirth',
        'birthDate',
        'occupationConceptId',
      ]);
    });

    it('la lupa filtra las ocupaciones en local', () => {
      component.opcionesOcupacion.set([
        { value: 'o-1', label: 'Médico General', code: 'MED_GEN' },
        { value: 'o-2', label: 'Odontólogo', code: 'ODONT' },
        { value: 'o-3', label: 'Otra ocupación', code: 'occupation:bo:OTRA' },
      ]);

      component.busquedaOcupacion.set('médico');
      expect(component.ocupacionesFiltradas()).toEqual([
        { value: 'o-1', label: 'Médico General' },
      ]);

      component.busquedaOcupacion.set('');
      expect(component.ocupacionesFiltradas()).toHaveLength(3);
    });

    it('elegir una ocupación normada la envía en occupationConceptId', () => {
      component.opcionesOcupacion.set([
        { value: 'o-1', label: 'Médico General', code: 'MED_GEN' },
      ]);
      completarProfesional();
      component.elegirOcupacion({ value: 'o-1', label: 'Médico General' });
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.occupationConceptId).toBe('o-1');
      expect(req.request.body.occupationFreeText).toBeUndefined();
      req.flush(RESPUESTA_PRO);
    });

    it('elegir «Otra ocupación» abre el campo de texto libre y lo envía en occupationFreeText', () => {
      component.opcionesOcupacion.set([
        { value: 'o-otra', label: 'Otra ocupación', code: 'occupation:bo:OTRA' },
      ]);
      completarProfesional();
      component.elegirOcupacion({ value: 'o-otra', label: 'Otra ocupación' });
      fixture.detectChanges();

      const profile = component.paginasProfesional().find((p) => p.clave === 'profile');
      expect(profile?.campos.map((c) => c.key)).toContain('occupationFreeText');

      component.formProfesional.controls.occupationFreeText.setValue('Médico Cirujano Investigador');
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.occupationConceptId).toBeUndefined();
      expect(req.request.body.occupationFreeText).toBe('Médico Cirujano Investigador');
      req.flush(RESPUESTA_PRO);
    });

    it('sin ocupación no manda el alta: la ocupación es obligatoria', () => {
      completarProfesional({ occupationConceptId: null });
      component.submit();

      http.expectNone('/iam/auth/register-practitioner');
      expect(component.formProfesional.controls.occupationConceptId.touched).toBe(true);
      expect(component.formProfesional.controls.occupationConceptId.invalid).toBe(true);
    });

    it('«Otra ocupación» sin escribir cuál tampoco manda el alta', () => {
      component.opcionesOcupacion.set([
        { value: 'o-otra', label: 'Otra ocupación', code: 'occupation:bo:OTRA' },
      ]);
      completarProfesional();
      component.elegirOcupacion({ value: 'o-otra', label: 'Otra ocupación' });
      component.submit();

      http.expectNone('/iam/auth/register-practitioner');
      expect(component.formProfesional.controls.occupationFreeText.invalid).toBe(true);
    });

    it('volver de «Otra» a una ocupación normada libera el texto libre', () => {
      component.opcionesOcupacion.set([
        { value: 'o-otra', label: 'Otra ocupación', code: 'occupation:bo:OTRA' },
        { value: 'o-1', label: 'Médico General', code: 'MED_GEN' },
      ]);
      completarProfesional();
      component.elegirOcupacion({ value: 'o-otra', label: 'Otra ocupación' });
      expect(component.formProfesional.controls.occupationFreeText.invalid).toBe(true);

      component.elegirOcupacion({ value: 'o-1', label: 'Médico General' });

      expect(component.formProfesional.controls.occupationFreeText.valid).toBe(true);
      component.submit();
      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.occupationConceptId).toBe('o-1');
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
    // El identificador de acceso es el correo, no el documento. El nombre va
    // en partes, igual que en el alta de paciente. Sexo, fecha de nacimiento y
    // ocupación son obligatorios: los tres son dato clínico o de filiación, no
    // una cortesía, así que forman parte del alta mínima.
    expect(req.request.body).toEqual({
      name: 'Ana',
      lastName: 'Paz',
      nationalId: '1234567',
      email: 'ana@hospital.test',
      password: 'secreto12',
      licenseNumber: 'MP-12345',
      sedesLicenseNumber: 'T.I. 538/14',
      sexAtBirth: 'FEMALE',
      birthDate: '1985-05-12',
      occupationConceptId: 'o-1',
    });

    req.flush(RESPUESTA_PRO);
  });

  it('el documento de identidad es opcional para el profesional y no viaja si está vacío', () => {
    completarProfesional({ nationalId: '' });
    expect(component.formProfesional.controls.nationalId.valid).toBe(true);
    component.submit();

    const req = http.expectOne('/iam/auth/register-practitioner');
    expect(req.request.body.nationalId).toBeUndefined();
    expect(req.request.body.issuerAdministrativeAreaConceptId).toBeUndefined();

    req.flush(RESPUESTA_PRO);
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
    });
    component.submit();

    const req = http.expectOne('/iam/auth/register-practitioner');
    expect(req.request.body.mobilePhone).toBe('+591 70011111');
    expect(req.request.body.workMobilePhone).toBe('+591 70022222');
    expect(req.request.body.workLandline).toBe('+591 33456789');
    expect(req.request.body.personalEmail).toBe('ana.paz@gmail.test');
    // El correo de acceso sigue siendo `email`, que es el del trabajo.
    expect(req.request.body.email).toBe('ana@hospital.test');

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
});
