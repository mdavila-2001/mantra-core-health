import { matchesFileAccept } from '../../../shared/forms/file-accept';
import { environment } from '../../../../environments/environment';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';

import { NAV_ICON_NAMES } from '../../../shared/components/atoms/nav-icon/nav-icon.types';
import { ESPECIALIDADES_ODONTOLOGICAS, RegisterPractitioner } from './register-practitioner';
import {
  chooseSelectOptionNow,
  selectHasValue,
  selectOptionLabelsNow,
  selectShownLabel,
  selectTrigger,
} from '../../../../testing/select';
import { SPECIALTY } from '../../../core/mock/fixtures/concepts';
import { CATALOG_OUTSIDE_INSTITUTION } from '../../../core/profession/educational-institutions';
import {
  CATALOG_OUTSIDE_COUNTRY,
  UniversitiesRegistry,
} from '../../../core/profession/university-registry';
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
/** Un punto de casa ya confirmado: el domicilio lo exige desde el 26/10/2026. */
const PUNTO_CASA = { lat: -17.7833, lng: -63.1821 };
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
    // El mapa del domicilio nace con el punto confirmado de `completarProfesional`
    // y pide su calle apenas se muestra su paso: las pruebas que sólo lo
    // atraviesan la dan por atendida acá.
    for (const pendiente of http.match((r) => r.url.startsWith('/public/geo/reverse'))) {
      if (pendiente.cancelled) continue;
      pendiente.flush({ found: false, attribution: '© OpenStreetMap' });
    }
    // Desde el 28/10/2026 la página «Dónde trabaja y con qué seguros» pide el
    // catálogo de aseguradoras al mostrarse: las pruebas que sólo la atraviesan
    // la dan por atendida acá, como el mapa.
    for (const pendiente of http.match((r) => r.url === '/insurance-carrier-catalog')) {
      if (pendiente.cancelled) continue;
      pendiente.flush({ carriers: [] });
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
        | 'collegeLicenseNumber'
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
      // Obligatorio para un título con colegio conocido, como el de por defecto.
      collegeLicenseNumber: extra.collegeLicenseNumber ?? 'CMB-4410',
      // El punto del domicilio es obligatorio (26/10/2026): por defecto uno
      // confirmado, para que las pruebas a las que no les importa sigan
      // mandando el formulario. Ver `PUNTO_CASA`.
      gpsDomicilio: PUNTO_CASA,
      homeAddressLines: '',
      homeDistrict: '',
      municipio: null,
      municipioConsultorio: null,
      workAddressLines: '',
      officeContactPhone: '',
      officeName: '',
      officeAddressLines: '',
      officeDistrict: '',
      regulatoryAuthority: extra.regulatoryAuthority ?? '',
      // Obligatorio desde que dejó de ser «(opcional)»: es lo que dice qué
      // clase de profesional es, y de él dependen el colegio y las
      // especialidades. Las pruebas que lo ejercen lo pisan por `extra`.
      professionalTitle: extra.professionalTitle ?? 'Médico / Médica',
      // Dónde estudió la profesión con la que ejerce. Los tres son opcionales,
      // así que por defecto van vacíos; las pruebas que los ejercen los pisan.
      professionalTitleNumber: '',
      professionalTitleUniversity: extra.professionalTitleUniversity ?? '',
      professionalTitleCountry: extra.professionalTitleCountry ?? '',
      professionalTitleCity: extra.professionalTitleCity ?? '',
      // El respaldo de «Tus títulos» para el motor de pasos: lo sincroniza un
      // `effect` con las filas, así que acá arranca «completo».
      academicTitles: !component.tituloSinNumeroEnAlgunaFila(),
      especialidadesExtra: true,
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
      sedesLicenseIssueDate: null,
      collegeLicenseIssueDate: null,
      issuerAdministrativeAreaConceptId: 'dep-1',
      profilePhotoBase64: extra.profilePhotoBase64 ?? null,
      signatureImageBase64: null,
      sealImageBase64: null,
    });
    // Las especialidades agregadas no son controles: viven en una señal, igual
    // que los nombres extra.
    component.especialidadesExtra.set(extra.especialidadesExtra ?? []);
    component.gpsDomicilio.set(PUNTO_CASA);
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
      // Nueve páginas desde el 26/10/2026 (pedido del propietario): eran
      // quince y el alta se hacía eterna. Se juntaron por tema. Diez desde el
      // 28/10/2026: instituciones y seguros, en UNA página nueva.
      expect(component.paginasProfesional().map((pagina) => pagina.clave)).toEqual([
        // Nombre y cédula comparten página, como en el alta de paciente.
        'name',
        // Datos personales, celular, correo de acceso y contraseña: el correo
        // y la contraseña van JUNTOS, son las dos mitades del inicio de sesión.
        'access',
        'residence',
        // Contacto y dirección del trabajo en una sola página.
        'workplace-location',
        // Contacto y ubicación del consultorio propio, en una sola página.
        'own-office',
        // Dónde trabaja y con qué seguros: lo que otro tiene que confirmar, después
        // de lo que no depende de nadie (28/10/2026).
        'workplaces',
        // El título profesional va ANTES de la habilitación: de él dependen el
        // colegio y la lista de especialidades.
        'practice',
        // La habilitación con sus respaldos al lado.
        'credentials',
        // Especialidades y demás títulos: la formación, junta.
        'specialties',
        // La firma y el sello (imágenes, opcionales) cierran el alta.
        'signature-seal',
      ]);
    });

    it('cada bloque trae los campos que le tocan, en su orden', () => {
      expect(camposDe('name')).toEqual([
        'name',
        'lastName',
        'motherLastName',
        'nationalId',
        'issuerAdministrativeAreaConceptId',
      ]);
      expect(camposDe('document')).toBeUndefined();
      // El correo de acceso y la contraseña en la MISMA página (26/10/2026).
      // AC-05-7: el sexo sigue antes de la fecha de nacimiento.
      expect(camposDe('access')).toEqual([
        'sexAtBirth',
        'birthDate',
        'mobilePhone',
        'personalEmail',
        'password',
      ]);
      // Pedido del cliente del 26/10/2026: en cada ubicación lo único que se
      // marca es el punto. La calle, la zona y el municipio salen de él: siguen
      // en el formulario, pero ya no son campos de ninguna página.
      expect(camposDe('residence')).toEqual(['gpsDomicilio']);
      expect(camposDe('workplace-location')).toEqual([
        'workMobilePhone',
        'workLandline',
        'email',
        'gpsTrabajo',
      ]);
      expect(camposDe('own-office')).toEqual(['officeName', 'officeContactPhone', 'gpsConsultorio']);
      // La autoridad emisora ya no se pregunta (26/10/2026): el colegio se
      // completa solo con el título profesional.
      // Cada habilitación es UN renglón con su número, su fecha y su respaldo
      // (27/10/2026): matrícula, SEDES y el colegio de la profesión.
      expect(camposDe('credentials')).toEqual([
        'licenseNumber',
        'sedesLicenseNumber',
        'collegeLicenseNumber',
      ]);
      expect(camposDe('practice')).toEqual([
        'profilePhotoBase64',
        'professionalTitle',
        'professionalTitleEducation',
        'professionalTitleFile',
      ]);
      expect(camposDe('specialties')).toEqual(['especialidadesExtra', 'academicTitles']);
      expect(camposDe('signature-seal')).toEqual(['signatureImageBase64', 'sealImageBase64']);
      for (const vieja of [
        'profile',
        'personal-contact',
        'own-office-contact',
        'credential-files',
        'academic-titles',
        'password',
      ]) {
        expect(camposDe(vieja), `«${vieja}» se fusionó con otra página`).toBeUndefined();
      }
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
        // línea de `RegisterPractitionerDto` copiada del de paciente.
        //
        // La zona sigue acá porque de ella sí no hay columna para nadie.
        'organizationName',
        'healthFacilityConceptId',
        'ministryLicenseNumber',
        // `sedesLicenseNumber` salió de esta lista: ya tiene destino. Nace como
        // una segunda fila de `profiles.jurisdiction_authorizations` con
        // jurisdicción SEDES — Santa Cruz, al lado de la matrícula nacional.
        // `collegeLicenseNumber` salió el 27/10/2026 por lo mismo: la API lo
        // guarda como tercera fila, con jurisdicción de colegio profesional.
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

  it('tiene diez páginas, ninguna con más de seis preguntas', () => {
    // Antes eran quince, de a cuatro campos como mucho (AC-05-2). El
    // propietario pidió juntarlas (26/10/2026): ahora se agrupan por tema, y
    // las páginas largas lo son por campos opcionales o que se abren solos
    // (`showWhen`).
    // Diez desde el 28/10/2026: «Dónde trabaja y con qué seguros».
    const paginas = component.paginasProfesional();
    expect(paginas.length).toBe(10);
    for (const pagina of paginas) {
      expect(
        pagina.campos.length,
        `«${pagina.titulo}» pide ${pagina.campos.length}`,
      ).toBeLessThanOrEqual(6);
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
      // componente hace al nacer —departamentos, especialidades, los tipos de
      // título (1.6) y las profesiones COB-2023 de «Otra profesión»
      // (04/10/2026)— y nada más. Los municipios ya no: los pide el mapa de
      // cada ubicación, que deduce la localidad del punto (26/10/2026). La lista de títulos profesionales
      // sigue siendo cerrada y en memoria; si esto empezara a consultar, el
      // número subiría acá antes que en producción.
      expect(http.match(() => true).map((p) => p.request.url)).toEqual([
        '/terminology/value-sets',
        '/terminology/value-sets',
        '/system-context/dynamic-enums',
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
      // El registro del colegio es obligatorio para un médico, y el colegio
      // sale del título: nadie lo escribe.
      collegeLicenseNumber: 'CMB-4410',
      collegeName: 'Colegio Médico de Bolivia',
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
      // El punto del domicilio, obligatorio desde el 26/10/2026.
      homeLatitude: -17.7833,
      homeLongitude: -63.1821,
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

  it('el documento admite letras, dígitos, punto y guion, mínimo 4', () => {
    const control = component.formProfesional.controls.nationalId;
    for (const invalida of ['123', 'QA 123', 'CI#1234']) {
      control.setValue(invalida);
      expect(control.invalid, `«${invalida}» no es un documento`).toBe(true);
    }
    for (const valida of ['1234', '1234567', 'CI-E2E-123', 'AB.123']) {
      control.setValue(valida);
      expect(control.valid, `«${valida}» sí lo es`).toBe(true);
    }
  });

  it('con el documento inválido no se puede enviar el alta', () => {
    completarProfesional({ nationalId: 'QA 123' });

    component.submit();
    http.expectNone('/iam/auth/register-practitioner');
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
      for (let pagina = 0; pagina < 13; pagina += 1) {
        if (fixture.nativeElement.querySelector('.registro-titulos') !== null) return;
        const continuar: HTMLButtonElement | null = fixture.nativeElement.querySelector(
          '[data-testid="paginated-form-continuar"]',
        );
        if (continuar === null) break;
        continuar.click();
        fixture.detectChanges();
      }
      throw new Error('No se llegó al paso «Sus títulos»');
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

    /** El `app-select` del paso, por el `data-testid` de su host. */
    function hostDelDesplegable(testId: string): HTMLElement {
      const host = enElPaso<HTMLElement>(testId);
      if (host === null) throw new Error(`No está el desplegable ${testId}`);
      return host;
    }

    /** El botón que hace de campo en un `app-select` del paso (donde vive `disabled`). */
    function desplegable(testId: string): HTMLButtonElement {
      return selectTrigger(hostDelDesplegable(testId));
    }

    /** Las etiquetas que ofrece un desplegable del paso (el placeholder no es una fila). */
    function etiquetasDe(testId: string): readonly string[] {
      // Deshabilitado no se abre: leer su lista daría vacío y una aserción
      // negativa pasaría sin mirar nada.
      if (desplegable(testId).disabled) {
        throw new Error(`El desplegable ${testId} está deshabilitado y no muestra su lista`);
      }
      return selectOptionLabelsNow(fixture, hostDelDesplegable(testId));
    }

    /** La etiqueta marcada en un desplegable del paso, o `null` si está en el placeholder. */
    function elegidoEn(testId: string): string | null {
      const host = hostDelDesplegable(testId);
      return selectHasValue(host) ? selectShownLabel(host) : null;
    }

    /**
     * Elige en un desplegable como lo hace el ratón: abre la lista y toca la
     * opción por su etiqueta.
     */
    function elegirEnDesplegable(testId: string, etiqueta: string): void {
      const host = hostDelDesplegable(testId);
      if (!selectOptionLabelsNow(fixture, host).includes(etiqueta)) {
        throw new Error(`No hay «${etiqueta}» en ${testId}`);
      }
      chooseSelectOptionNow(fixture, host, etiqueta);
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

    describe('cada habilitación con su fecha y su respaldo, y el colegio de la profesión', () => {
      const campoDe = (key: string) =>
        component
          .paginasProfesional()
          .flatMap((pagina) => pagina.campos)
          .find((campo) => campo.key === key);

      it('los tres renglones salen en orden: matrícula, SEDES y colegio', () => {
        expect(component.renglonesDeHabilitacion().map((renglon) => renglon.clave)).toEqual([
          'license',
          'sedes',
          'college',
        ]);
        expect(
          component.renglonesDeHabilitacion().map((renglon) => [renglon.control, renglon.fecha]),
        ).toEqual([
          ['licenseNumber', 'licenseIssueDate'],
          ['sedesLicenseNumber', 'sedesLicenseIssueDate'],
          ['collegeLicenseNumber', 'collegeLicenseIssueDate'],
        ]);
      });

      it('el colegio es el que corresponde a la profesión elegida antes', () => {
        component.formProfesional.controls.professionalTitle.setValue('Médico / Médica');
        expect(campoDe('collegeLicenseNumber')?.label).toBe(
          'Registro en el Colegio Médico de Bolivia',
        );
        expect(campoDe('collegeLicenseNumber')?.required).toBe(true);

        component.formProfesional.controls.professionalTitle.setValue('Odontólogo / Odontóloga');
        expect(campoDe('collegeLicenseNumber')?.label).toBe(
          'Registro en el Colegio de Odontólogos de Bolivia',
        );
        expect(component.renglonDe('college')?.etiqueta).toBe(
          'Registro en el Colegio de Odontólogos de Bolivia',
        );
      });

      it('sin el número del colegio no se crea la cuenta, si la profesión tiene colegio', () => {
        completarProfesional({ collegeLicenseNumber: '' });
        expect(component.formProfesional.controls.collegeLicenseNumber.invalid).toBe(true);

        component.submit();

        http.expectNone('/iam/auth/register-practitioner');
      });

      it('una profesión sin colegio conocido no exige el registro ni lo manda', () => {
        completarProfesional({
          professionalTitle: 'Técnico / Técnica en Radiología',
          collegeLicenseNumber: '',
        });
        expect(component.formProfesional.controls.collegeLicenseNumber.valid).toBe(true);
        expect(campoDe('collegeLicenseNumber')?.required).toBe(false);

        component.submit();

        const alta = http.expectOne('/iam/auth/register-practitioner');
        expect(alta.request.body).not.toHaveProperty('collegeLicenseNumber');
        expect(alta.request.body).not.toHaveProperty('collegeName');
        alta.flush(RESPUESTA_PRO);
      });

      it('manda la fecha de cada registro y el colegio con su nombre', () => {
        completarProfesional();
        component.escribirFechaDeHabilitacion('licenseIssueDate', new Date(2015, 2, 2));
        component.escribirFechaDeHabilitacion('sedesLicenseIssueDate', new Date(2016, 6, 11));
        component.escribirFechaDeHabilitacion('collegeLicenseIssueDate', new Date(2015, 8, 20));

        component.submit();

        const alta = http.expectOne('/iam/auth/register-practitioner');
        expect(alta.request.body).toMatchObject({
          licenseNumber: 'MP-12345',
          licenseIssueDate: '2015-03-02',
          sedesLicenseNumber: 'T.I. 538/14',
          sedesLicenseIssueDate: '2016-07-11',
          collegeLicenseNumber: 'CMB-4410',
          collegeName: 'Colegio Médico de Bolivia',
          collegeLicenseIssueDate: '2015-09-20',
        });
        alta.flush(RESPUESTA_PRO);
      });

      it('sube el PDF del colegio y manda su fileId, sin mezclarlo con los otros', () => {
        completarProfesional();
        const colegio = archivoDe('colegio.pdf', 'application/pdf', 1024);
        component.updateSupportFiles('college', [colegio]);
        expect(component.respaldoColegio()?.archivo).toBe('colegio.pdf');

        component.submit();

        const subida = http.expectOne('/iam/auth/upload-registration-document');
        expect((subida.request.body as FormData).get('file')).toBe(colegio);
        subida.flush({ fileId: 'pdf-colegio' });
        const alta = http.expectOne('/iam/auth/register-practitioner');
        expect(alta.request.body).toMatchObject({ collegeLicenseFileId: 'pdf-colegio' });
        expect(alta.request.body).not.toHaveProperty('licenseFileId');
        expect(alta.request.body).not.toHaveProperty('sedesLicenseFileId');
        alta.flush(RESPUESTA_PRO);
      });
    });

    describe('los respaldos de la habilitación viajan a la API (P29)', () => {
      it('el selector de los respaldos sólo acepta PDF, como la API que los recibe', () => {
        const accept = (component as unknown as { formatosDeRespaldo: string }).formatosDeRespaldo;
        expect(matchesFileAccept(archivoDe('matricula.jpg', 'image/jpeg', 1024), accept)).toBe(
          false,
        );
        expect(matchesFileAccept(archivoDe('sedes.png', 'image/png', 1024), accept)).toBe(false);
        expect(matchesFileAccept(archivoDe('matricula.pdf', 'application/pdf', 1024), accept)).toBe(
          true,
        );
      });

      it('sube el PDF de la matrícula y el del SEDES y manda cada fileId en el alta', () => {
        completarProfesional();
        const matricula = archivoDe('matricula.pdf', 'application/pdf', 1024);
        const sedes = archivoDe('sedes.pdf', 'application/pdf', 2048);
        component.updateSupportFiles('license', [matricula]);
        component.updateSupportFiles('sedes', [sedes]);
        component.submit();

        const primera = http.expectOne('/iam/auth/upload-registration-document');
        expect((primera.request.body as FormData).get('file')).toBe(matricula);
        primera.flush({ fileId: 'pdf-matricula' });
        const segunda = http.expectOne('/iam/auth/upload-registration-document');
        expect((segunda.request.body as FormData).get('file')).toBe(sedes);
        segunda.flush({ fileId: 'pdf-sedes' });

        const alta = http.expectOne('/iam/auth/register-practitioner');
        expect(alta.request.body).toMatchObject({
          licenseNumber: 'MP-12345',
          licenseFileId: 'pdf-matricula',
          sedesLicenseNumber: 'T.I. 538/14',
          sedesLicenseFileId: 'pdf-sedes',
        });
        alta.flush(RESPUESTA_PRO);
      });

      it('sin archivo el alta no sube nada ni manda los campos', () => {
        completarProfesional();
        component.submit();

        http.expectNone('/iam/auth/upload-registration-document');
        const alta = http.expectOne('/iam/auth/register-practitioner');
        expect(alta.request.body).not.toHaveProperty('licenseFileId');
        expect(alta.request.body).not.toHaveProperty('sedesLicenseFileId');
        alta.flush(RESPUESTA_PRO);
      });

      it('si la subida falla no se crea la cuenta: el archivo no se pierde en silencio', () => {
        completarProfesional();
        component.updateSupportFiles('license', [
          archivoDe('matricula.pdf', 'application/pdf', 1024),
        ]);
        component.submit();

        http
          .expectOne('/iam/auth/upload-registration-document')
          .flush({ message: 'No es un PDF' }, { status: 422, statusText: 'Unprocessable Entity' });

        http.expectNone('/iam/auth/register-practitioner');
        expect(component.respaldoMatricula()?.archivo).toBe('matricula.pdf');
      });

      it('al reintentar no vuelve a subir el PDF ya confirmado', () => {
        completarProfesional();
        component.updateSupportFiles('license', [
          archivoDe('matricula.pdf', 'application/pdf', 1024),
        ]);
        component.submit();
        http.expectOne('/iam/auth/upload-registration-document').flush({ fileId: 'pdf-matricula' });
        http
          .expectOne('/iam/auth/register-practitioner')
          .flush({ message: 'caída' }, { status: 503, statusText: 'Service Unavailable' });

        component.submit();

        http.expectNone('/iam/auth/upload-registration-document');
        const alta = http.expectOne('/iam/auth/register-practitioner');
        expect(alta.request.body.licenseFileId).toBe('pdf-matricula');
        alta.flush(RESPUESTA_PRO);
      });

      it('cambiar el archivo olvida el fileId anterior y sube el nuevo', () => {
        completarProfesional();
        component.updateSupportFiles('license', [archivoDe('vieja.pdf', 'application/pdf', 1024)]);
        component.submit();
        http.expectOne('/iam/auth/upload-registration-document').flush({ fileId: 'pdf-viejo' });
        http
          .expectOne('/iam/auth/register-practitioner')
          .flush({ message: 'caída' }, { status: 503, statusText: 'Service Unavailable' });

        const nueva = archivoDe('nueva.pdf', 'application/pdf', 1024);
        component.updateSupportFiles('license', [nueva]);
        component.submit();

        const upload = http.expectOne('/iam/auth/upload-registration-document');
        expect((upload.request.body as FormData).get('file')).toBe(nueva);
        upload.flush({ fileId: 'pdf-nuevo' });
        const alta = http.expectOne('/iam/auth/register-practitioner');
        expect(alta.request.body.licenseFileId).toBe('pdf-nuevo');
        alta.flush(RESPUESTA_PRO);
      });
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
     * El pedido del propietario del 03/10/2026, sobre una captura con la UMSS
     * elegida y «LPZ» tecleado al lado: «debe mostrar la ciudad por defecto».
     * La ciudad la sabe el padrón; preguntarla en blanco era hacerla adivinar.
     */
    describe('la ciudad de estudio sale de la universidad elegida', () => {
      const UMSS = 'Universidad Mayor de San Simón';
      const UMSA = 'Universidad Mayor de San Andrés';
      const UCB = 'Universidad Católica Boliviana San Pablo';

      it('elegir la universidad completa la ciudad', () => {
        component.elegirPaisDelTitulo('Bolivia');
        component.elegirUniversidadDelTitulo(UMSS);

        expect(component.valorDeEstudio('professionalTitleCity')).toBe('Cochabamba');
      });

      it('cambiar de universidad cambia la ciudad propuesta', () => {
        component.elegirPaisDelTitulo('Bolivia');
        component.elegirUniversidadDelTitulo(UMSS);
        component.elegirUniversidadDelTitulo(UMSA);

        expect(component.valorDeEstudio('professionalTitleCity')).toBe('La Paz');
      });

      /*
       * Propietario, 04/10/2026: la ciudad es «un SELECT no modificable que
       * sale como resultado de elegir la universidad». Ya no hay ciudad
       * escrita a mano que respetar: sólo se elige entre las sedes.
       */
      it('una ciudad que no es sede de la universidad elegida se reemplaza por la sede principal', () => {
        component.elegirPaisDelTitulo('Bolivia');
        component.escribirEstudio('professionalTitleCity', 'Quillacollo');
        component.elegirUniversidadDelTitulo(UMSS);

        expect(component.valorDeEstudio('professionalTitleCity')).toBe('Cochabamba');
      });

      it('con varias sedes propone la principal y deja elegir sólo entre ellas', () => {
        component.elegirPaisDelTitulo('Bolivia');
        component.elegirUniversidadDelTitulo(UMSS);
        component.elegirUniversidadDelTitulo(UCB);

        // Cochabamba también es sede de la UCB: la elegida se conserva.
        expect(component.valorDeEstudio('professionalTitleCity')).toBe('Cochabamba');
        component.elegirCiudadDelTitulo('Tarija');
        expect(component.valorDeEstudio('professionalTitleCity')).toBe('Tarija');
        // Volver a elegir la misma universidad no pisa la sede elegida.
        component.elegirUniversidadDelTitulo(UCB);
        expect(component.valorDeEstudio('professionalTitleCity')).toBe('Tarija');
      });

      it('cambiar de país se lleva la ciudad propuesta junto con la universidad', () => {
        component.elegirPaisDelTitulo('Bolivia');
        component.elegirUniversidadDelTitulo(UMSS);
        component.elegirPaisDelTitulo(CATALOG_OUTSIDE_COUNTRY);

        expect(component.valorDeEstudio('professionalTitleUniversity')).toBe('');
        expect(component.valorDeEstudio('professionalTitleCity')).toBe('');
      });

      it('vale igual en cada fila de «Sus títulos»', () => {
        component.agregarTitulo('UNIVERSITARIO');
        const [{ id }] = component.titulosDe('UNIVERSITARIO');
        const fila = () => component.titulosDe('UNIVERSITARIO')[0];

        component.elegirEnFila(id, 'pais', 'Bolivia');
        component.elegirEnFila(id, 'universidad', UMSS);
        expect(fila().ciudad).toBe('Cochabamba');

        component.elegirEnFila(id, 'universidad', UMSA);
        expect(fila().ciudad).toBe('La Paz');

        // Otro país: se van la universidad y la ciudad que ella había puesto.
        component.elegirEnFila(id, 'pais', CATALOG_OUTSIDE_COUNTRY);
        expect([fila().universidad, fila().ciudad]).toEqual(['', '']);

        // La ciudad sólo puede ser una sede: con varias, se elige entre ellas.
        component.elegirEnFila(id, 'pais', 'Bolivia');
        component.elegirEnFila(id, 'universidad', UCB);
        expect(component.ciudadesDeFila(fila()).map((o) => o.value)).toEqual([
          'La Paz',
          'Cochabamba',
          'Santa Cruz de la Sierra',
          'Tarija',
          'Sucre',
        ]);
        component.elegirCiudadEnFila(id, 'Sucre');
        expect(fila().ciudad).toBe('Sucre');
      });
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
            {
              conceptId: 'c-specialty',
              code: 'CREDENTIAL_TYPE_SPECIALTY',
              label: 'Specialty title',
            },
          ],
        });
    }

    describe('el estudio de cada especialidad', () => {
      /** Responde el catálogo de especialidades para que las casillas tengan nombre. */
      function catalogoDeEspecialidades(): void {
        http.expectOne(CATALOGO_ESPECIALIDADES).flush({
          items: [{ id: 'vs-esp', internalCode: 'VS_MEDICAL_SPECIALTY', name: 'Especialidades' }],
        });
        http.expectOne('/terminology/value-sets/vs-esp/$expand?limit=200').flush({
          items: [
            { conceptId: 'e-cardio', code: 'CARDIOLOGIA', display: 'Cardiología' },
            { conceptId: 'e-pedia', code: 'PEDIATRIA', display: 'Pediatría' },
          ],
          count: 2,
          limit: 200,
          nextCursor: null,
        });
      }

      it('viaja como credencial de especialidad, con su universidad, país, ciudad y PDF', () => {
        catalogoDeTiposDeTitulo();
        catalogoDeEspecialidades();
        component.especialidadesExtra.set(['e-cardio', 'e-pedia']);
        component.writeSpecialtyStudy(0, 'number', 'ESP-77');
        component.chooseSpecialtyCountry(0, 'Bolivia');
        component.chooseSpecialtyUniversity(0, component.specialtyUniversityOptions(0)[0].value);
        component.updateSpecialtyFiles(0, [archivoDe('cardio.pdf', 'application/pdf', 2048)]);

        completarProfesional({ especialidadesExtra: ['e-cardio', 'e-pedia'] });
        component.submit();

        http.expectOne('/iam/auth/upload-registration-document').flush({
          fileId: 'file-esp-1',
          originalName: 'cardio.pdf',
          sizeBytes: 2048,
          mimeType: 'application/pdf',
        });
        const req = http.expectOne('/iam/auth/register-practitioner');
        const [credencial, ...otras] = req.request.body.credentials;
        expect(otras).toEqual([]);
        expect(credencial).toMatchObject({
          credentialTypeConceptId: 'c-specialty',
          number: 'ESP-77',
          issuingCountryText: 'Bolivia',
          titleText: 'Cardiología',
          fileId: 'file-esp-1',
        });
        expect(credencial.issuingInstitutionText).toBeTruthy();
        // La segunda especialidad no declaró estudio: no genera fila.
        expect(req.request.body.specialtyConceptIds).toEqual(['e-cardio', 'e-pedia']);
        req.flush(RESPUESTA_PRO);
      });

      it('con datos y sin número frena el paso y el envío, y nombra la casilla', () => {
        catalogoDeTiposDeTitulo();
        component.especialidadesExtra.set(['e-cardio', 'e-pedia']);
        component.chooseSpecialtyCountry(1, 'Bolivia');

        expect(component.formProfesional.controls.especialidadesExtra.invalid).toBe(true);
        expect(component.specialtyStudyMissingNumber(1)).toBe(true);
        expect(component.specialtyStudyMissingNumber(0)).toBe(false);

        completarProfesional({ especialidadesExtra: ['e-cardio', 'e-pedia'] });
        component.submit();
        http.expectNone('/iam/auth/register-practitioner');
        expect(component.state().status).toBe('validation');

        component.writeSpecialtyStudy(1, 'number', 'ESP-2');
        expect(component.formProfesional.controls.especialidadesExtra.valid).toBe(true);
      });

      it('cambiar de país reinicia la universidad, y la ciudad sigue a la universidad', () => {
        component.especialidadesExtra.set(['e-cardio']);
        component.chooseSpecialtyCountry(0, 'Bolivia');
        const universidad = component
          .specialtyUniversityOptions(0)
          .find((opcion) => component.specialtyCityOptions(0).length >= 0 && opcion.value)!;
        component.chooseSpecialtyUniversity(0, universidad.value);
        expect(component.specialtyStudyAt(0).university).toBe(universidad.value);

        component.chooseSpecialtyCountry(0, null);
        expect(component.specialtyStudyAt(0).university).toBe('');
        expect(component.specialtyStudyAt(0).pickedUniversity).toBeNull();
      });

      it('quitar una especialidad quita su estudio y sube el diploma de las siguientes', () => {
        component.especialidadesExtra.set(['e-cardio', 'e-pedia']);
        component.writeSpecialtyStudy(0, 'number', 'A');
        component.writeSpecialtyStudy(1, 'number', 'B');
        component.updateSpecialtyFiles(1, [archivoDe('b.pdf', 'application/pdf', 10)]);

        component.quitarEspecialidad(0);

        expect(component.specialtyStudies().map((study) => study.number)).toEqual(['B']);
        expect(component.attachmentFiles()['especialidad-0']?.[0]?.name).toBe('b.pdf');
        expect(component.attachmentFiles()['especialidad-1']).toBeUndefined();
      });
    });

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

    it('guarda universidad y PDF del principal sin repetirlo en Sus títulos', () => {
      catalogoDeTiposDeTitulo();
      completarProfesional({ professionalTitleUniversity: 'Universidad Mayor de San Andrés' });
      component.escribirEstudio('professionalTitleNumber', 'DIP-123');
      const pdf = archivoDe('principal.pdf', 'application/pdf', 1024);
      component.updateSupportFiles('professional-title', [pdf]);
      component.submit();
      const upload = http.expectOne('/iam/auth/upload-registration-document');
      expect((upload.request.body as FormData).get('file')).toBe(pdf);
      upload.flush({
        fileId: 'pdf-principal',
        originalName: pdf.name,
        sizeBytes: 1024,
        mimeType: 'application/pdf',
      });
      const alta = http.expectOne('/iam/auth/register-practitioner');
      expect(alta.request.body.credentials).toEqual([
        {
          credentialTypeConceptId: 'c-degree',
          number: 'DIP-123',
          issuingInstitutionText: 'Universidad Mayor de San Andrés',
          fileId: 'pdf-principal',
        },
      ]);
      alta.flush(RESPUESTA_PRO);
    });

    it('vincula por número sin duplicar la fila ni rechazar una sigla de universidad', () => {
      catalogoDeTiposDeTitulo();
      completarProfesional({ professionalTitleUniversity: 'Universidad Mayor de San Andrés' });
      component.escribirEstudio('professionalTitleNumber', 'DIP-123');
      component.agregarTitulo('UNIVERSITARIO');
      const [titulo] = component.titulosDe('UNIVERSITARIO');
      component.escribirDatoDeTitulo(titulo.id, 'numero', 'DIP-123');
      component.escribirDatoDeTitulo(titulo.id, 'universidad', 'UMSA');
      component.updateSupportFiles('professional-title', [
        archivoDe('principal.pdf', 'application/pdf', 1024),
      ]);
      component.submit();
      http.expectOne('/iam/auth/upload-registration-document').flush({ fileId: 'pdf-principal' });
      const alta = http.expectOne('/iam/auth/register-practitioner');
      expect(alta.request.body.credentials).toEqual([
        {
          credentialTypeConceptId: 'c-degree',
          number: 'DIP-123',
          issuingInstitutionText: 'UMSA',
          fileId: 'pdf-principal',
        },
      ]);
      alta.flush(RESPUESTA_PRO);
    });

    it('reutiliza el PDF principal para una fila universitaria numerada existente', () => {
      catalogoDeTiposDeTitulo();
      completarProfesional({ professionalTitleUniversity: 'UMSA' });
      component.agregarTitulo('UNIVERSITARIO');
      const [titulo] = component.titulosDe('UNIVERSITARIO');
      component.escribirDatoDeTitulo(titulo.id, 'numero', 'DIP-123');
      component.updateSupportFiles('professional-title', [
        archivoDe('principal.pdf', 'application/pdf', 1024),
      ]);
      component.submit();
      http.expectOne('/iam/auth/upload-registration-document').flush({ fileId: 'pdf-principal' });
      const alta = http.expectOne('/iam/auth/register-practitioner');
      expect(alta.request.body.credentials[0]).toEqual({
        credentialTypeConceptId: 'c-degree',
        number: 'DIP-123',
        issuingInstitutionText: 'UMSA',
        fileId: 'pdf-principal',
      });
      alta.flush(RESPUESTA_PRO);
    });

    it('PDF sin número avisa qué completar y no inventa una credencial', () => {
      catalogoDeTiposDeTitulo();
      completarProfesional();
      component.updateSupportFiles('professional-title', [
        archivoDe('principal.pdf', 'application/pdf', 1024),
      ]);
      component.submit();
      http.expectNone('/iam/auth/upload-registration-document');
      http.expectNone('/iam/auth/register-practitioner');
      expect(component.errorMessage()).toContain('Complete el número del diploma');
    });

    it('tras fallar el alta no vuelve a subir el PDF principal; cambiarlo sí invalida su fileId', () => {
      catalogoDeTiposDeTitulo();
      completarProfesional();
      component.escribirEstudio('professionalTitleNumber', 'DIP-123');
      component.updateSupportFiles('professional-title', [
        archivoDe('principal.pdf', 'application/pdf', 1024),
      ]);
      component.submit();
      http.expectOne('/iam/auth/upload-registration-document').flush({ fileId: 'pdf-uno' });
      http
        .expectOne('/iam/auth/register-practitioner')
        .flush(null, { status: 500, statusText: 'Error' });
      component.submit();
      http.expectNone('/iam/auth/upload-registration-document');
      const retry = http.expectOne('/iam/auth/register-practitioner');
      expect(retry.request.body.credentials[0].fileId).toBe('pdf-uno');
      retry.flush(null, { status: 500, statusText: 'Error' });
      component.updateSupportFiles('professional-title', [
        archivoDe('nuevo.pdf', 'application/pdf', 1024),
      ]);
      component.submit();
      http.expectOne('/iam/auth/upload-registration-document').flush({ fileId: 'pdf-dos' });
      const final = http.expectOne('/iam/auth/register-practitioner');
      expect(final.request.body.credentials[0].fileId).toBe('pdf-dos');
      final.flush(RESPUESTA_PRO);
    });

    // La universidad es opcional: sin una fila que la lleve, el alta NO se
    // frena (propietario, 03/10/2026). Antes se cortaba con un mensaje que el
    // médico no entendía y que lo dejaba sin crear la cuenta.
    it('con la universidad del título principal y ninguna fila que la lleve, el alta igual se envía y avisa en el campo', () => {
      catalogoDeTiposDeTitulo();
      completarProfesional({ professionalTitleUniversity: 'Universidad Mayor de San Andrés' });
      expect(component['hayUniversidadPrincipalSinTitulo']()).toBe(true);
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.credentials).toBeUndefined();
      expect(component.errorMessage()).toBeNull();
      req.flush(RESPUESTA_PRO);
      expect(component.registered()).toBe(true);
    });

    it('una universidad distinta en la fila no se pisa, y el alta igual se envía', () => {
      catalogoDeTiposDeTitulo();
      component.agregarTitulo('UNIVERSITARIO');
      const [profesion] = component.titulosDe('UNIVERSITARIO');
      component.escribirDatoDeTitulo(profesion.id, 'numero', 'TIT-1');
      component.escribirDatoDeTitulo(profesion.id, 'universidad', 'Universidad Privada Boliviana');
      completarProfesional({ professionalTitleUniversity: 'Universidad Mayor de San Andrés' });
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.credentials).toEqual([
        {
          credentialTypeConceptId: 'c-degree',
          number: 'TIT-1',
          issuingInstitutionText: 'Universidad Privada Boliviana',
        },
      ]);
      req.flush(RESPUESTA_PRO);
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
      // Universidad que no está en el padrón: país del árbol, «Otra…» y a mano.
      elegirEnDesplegable(`registro-pro-titulo-pais-${fila.id}`, 'Bolivia');
      elegirEnDesplegable(`registro-pro-titulo-universidad-${fila.id}`, 'Otra institución…');
      escribirEnCasilla(`registro-pro-titulo-universidad-otra-${fila.id}`, 'Nur');
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
      expect(avisoVisible()).toContain('número del diploma');
      // 2) Y dirige al paso donde está el campo: el índice de pasos es navegable.
      expect(avisoVisible()).toContain('Sus títulos');
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
        {
          credentialTypeConceptId: 'c-diploma',
          number: 'DIP-7',
          issuingCountryText: 'Bolivia',
          issuingInstitutionText: 'Nur',
        },
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

    it('las casillas acotan lo que el contrato acota: número 100, universidad escrita a mano 200', () => {
      catalogoDeTiposDeTitulo();
      completarProfesional();
      const id = filaDeDiplomadoSinNumero();

      // El exceso se frena en la casilla, no como un 400 en inglés técnico.
      expect(casillaDeNumero(id).getAttribute('maxlength')).toBe('100');
      expect(
        enElPaso<HTMLInputElement>(`registro-pro-titulo-universidad-otra-${id}`)?.getAttribute(
          'maxlength',
        ),
      ).toBe('200');
      expect(component.titulosDe('DIPLOMADO')[0].universidad).toBe('Nur');
      // País y universidad del padrón son desplegables: una opción de la lista
      // no necesita tope. La ciudad no viaja todavía, así que tampoco.
      expect(desplegable(`registro-pro-titulo-pais-${id}`)).not.toBeNull();
      // Con «Otra…» universidad el padrón no conoce sedes: la ciudad se
      // escribe, y como no viaja, no lleva tope.
      expect(
        enElPaso<HTMLInputElement>(`registro-pro-titulo-ciudad-otra-${id}`)?.hasAttribute(
          'maxlength',
        ),
      ).toBe(false);
    });

    /**
     * El pedido del propietario (02/10/2026): universidad y país de estudio son
     * desplegables poblados con datos, en árbol —el país acota la universidad—.
     * Acá se prueba por el DOM del paso, que es donde se elige.
     */
    describe('país y universidad en árbol', () => {
      /** Lleva la pantalla hasta «Tu título profesional y foto». */
      function irAlPasoDelTitulo(): void {
        fixture.detectChanges();
        for (let pagina = 0; pagina < 13; pagina += 1) {
          if (fixture.nativeElement.querySelector('.registro__estudio') !== null) return;
          const continuar: HTMLButtonElement | null = fixture.nativeElement.querySelector(
            '[data-testid="paginated-form-continuar"]',
          );
          if (continuar === null) break;
          continuar.click();
          fixture.detectChanges();
        }
        if (fixture.nativeElement.querySelector('.registro__estudio') === null) {
          throw new Error('No se llegó al paso del título');
        }
      }

      it('el país acota la universidad: Bolivia ofrece la lista curada y Argentina la importada', async () => {
        await TestBed.inject(UniversitiesRegistry).cargar();
        completarProfesional();
        irAlPasoDelTitulo();

        // Sin país no hay universidad que elegir: el desplegable espera.
        expect(desplegable('registro-pro-titulo-universidad').disabled).toBe(true);
        expect(etiquetasDe('registro-pro-titulo-pais')[0]).toBe('Bolivia');
        expect(etiquetasDe('registro-pro-titulo-pais')).toContain('Argentina');
        expect(etiquetasDe('registro-pro-titulo-pais').at(-1)).toBe('Otro país…');

        elegirEnDesplegable('registro-pro-titulo-pais', 'Bolivia');
        expect(component.valorDeEstudio('professionalTitleCountry')).toBe('Bolivia');
        expect(desplegable('registro-pro-titulo-universidad').disabled).toBe(false);
        const bolivianas = etiquetasDe('registro-pro-titulo-universidad');
        expect(bolivianas).toContain('Universidad Mayor de San Andrés (UMSA) — La Paz');
        expect(bolivianas).not.toContain('Universidad de Buenos Aires');
        expect(bolivianas.at(-1)).toBe('Otra institución…');

        elegirEnDesplegable('registro-pro-titulo-pais', 'Argentina');
        const argentinas = etiquetasDe('registro-pro-titulo-universidad');
        expect(argentinas).toContain('Universidad de Buenos Aires');
        expect(argentinas).not.toContain('Universidad Mayor de San Andrés (UMSA) — La Paz');
      });

      it('elegir del padrón guarda el nombre, y cambiar de país reinicia la universidad', async () => {
        await TestBed.inject(UniversitiesRegistry).cargar();
        completarProfesional();
        irAlPasoDelTitulo();

        elegirEnDesplegable('registro-pro-titulo-pais', 'Bolivia');
        elegirEnDesplegable(
          'registro-pro-titulo-universidad',
          'Universidad Mayor de San Andrés (UMSA) — La Paz',
        );
        // Lo que se guarda es el nombre, que es lo que viaja en `issuingInstitutionText`.
        expect(component.valorDeEstudio('professionalTitleUniversity')).toBe(
          'Universidad Mayor de San Andrés',
        );

        elegirEnDesplegable('registro-pro-titulo-pais', 'Argentina');
        expect(component.valorDeEstudio('professionalTitleCountry')).toBe('Argentina');
        // Una universidad boliviana bajo Argentina sería mentir: se vacía.
        expect(component.valorDeEstudio('professionalTitleUniversity')).toBe('');
        expect(elegidoEn('registro-pro-titulo-universidad')).toBeNull();
      });

      it('la ciudad es un desplegable bloqueado que sale de la universidad elegida', () => {
        completarProfesional();
        irAlPasoDelTitulo();
        // Sin universidad no hay ciudad que ofrecer, y no se escribe.
        expect(
          fixture.nativeElement.querySelector('input[data-testid="registro-pro-titulo-ciudad"]'),
        ).toBeNull();
        expect(elegidoEn('registro-pro-titulo-ciudad')).toBeNull();
        expect(desplegable('registro-pro-titulo-ciudad').disabled).toBe(true);

        elegirEnDesplegable('registro-pro-titulo-pais', 'Bolivia');
        elegirEnDesplegable(
          'registro-pro-titulo-universidad',
          'Universidad Mayor de San Simón (UMSS) — Cochabamba',
        );

        // La sede principal queda elegida. La UMSS tiene varias sedes, así que
        // se puede cambiar, pero sólo por otra de sus sedes.
        expect(elegidoEn('registro-pro-titulo-ciudad')).toBe('Cochabamba');
        expect(etiquetasDe('registro-pro-titulo-ciudad').filter((t) => t !== '')).toContain(
          'Punata',
        );

        // Un médico no ve la UPSA (no dicta Medicina): el filtro de salud ya
        // actúa sobre el título elegido.
        expect(etiquetasDe('registro-pro-titulo-universidad')).not.toContain(
          'Universidad Privada de Santa Cruz de la Sierra (UPSA)',
        );

        // Con una sola sede el desplegable queda fijo.
        elegirEnDesplegable(
          'registro-pro-titulo-universidad',
          'Universidad Evangélica Boliviana (UEB) — Santa Cruz',
        );
        expect(elegidoEn('registro-pro-titulo-ciudad')).toBe('Santa Cruz de la Sierra');
        expect(desplegable('registro-pro-titulo-ciudad').disabled).toBe(true);
      });

      it('«Otro…» destapa la casilla escrita a mano, y lo escrito es lo que se guarda', () => {
        completarProfesional();
        irAlPasoDelTitulo();

        expect(enElPaso('registro-pro-titulo-pais-otro')).toBeNull();
        elegirEnDesplegable('registro-pro-titulo-pais', 'Otro país…');
        expect(component.valorDeEstudio('professionalTitleCountry')).toBe('');
        escribirEnCasilla('registro-pro-titulo-pais-otro', 'Atlántida');
        expect(component.valorDeEstudio('professionalTitleCountry')).toBe('Atlántida');
        // El desplegable sigue en «Otro»: la casilla no desaparece debajo del cursor.
        expect(elegidoEn('registro-pro-titulo-pais')).toBe('Otro país…');

        // Con «Otro país» la única universidad posible es la escrita a mano.
        expect(etiquetasDe('registro-pro-titulo-universidad')).toEqual(['Otra institución…']);
        elegirEnDesplegable('registro-pro-titulo-universidad', 'Otra institución…');
        escribirEnCasilla('registro-pro-titulo-universidad-otra', 'Universidad de Atlántida');
        expect(component.valorDeEstudio('professionalTitleUniversity')).toBe(
          'Universidad de Atlántida',
        );
      });

      it('escribir el país o la universidad como texto deja el desplegable a tono', () => {
        completarProfesional();
        irAlPasoDelTitulo();

        component.escribirEstudio('professionalTitleCountry', 'Bolivia');
        component.escribirEstudio('professionalTitleUniversity', 'Universidad Mayor de San Simón');
        fixture.detectChanges();
        expect(elegidoEn('registro-pro-titulo-pais')).toBe('Bolivia');
        expect(elegidoEn('registro-pro-titulo-universidad')).toBe(
          'Universidad Mayor de San Simón (UMSS) — Cochabamba',
        );

        // Un texto que no está en el padrón cae en «Otro…» con la casilla a la vista.
        component.escribirEstudio('professionalTitleUniversity', 'Universidad de La Habana');
        fixture.detectChanges();
        expect(elegidoEn('registro-pro-titulo-universidad')).toBe('Otra institución…');
        expect(enElPaso<HTMLInputElement>('registro-pro-titulo-universidad-otra')?.value).toBe(
          'Universidad de La Habana',
        );
      });

      it('en una fila, el país acota la universidad y la elegida viaja en issuingInstitutionText', () => {
        catalogoDeTiposDeTitulo();
        completarProfesional();
        irAlPasoDeTitulos();
        pulsar('registro-pro-agregar-UNIVERSITARIO');
        const [fila] = component.titulosDe('UNIVERSITARIO');
        escribirEnCasilla(`registro-pro-titulo-numero-${fila.id}`, 'TIT-9');

        expect(desplegable(`registro-pro-titulo-universidad-${fila.id}`).disabled).toBe(true);
        elegirEnDesplegable(`registro-pro-titulo-pais-${fila.id}`, 'Bolivia');
        elegirEnDesplegable(
          `registro-pro-titulo-universidad-${fila.id}`,
          'Universidad Privada Boliviana (UPB)',
        );
        const [elegida] = component.titulosDe('UNIVERSITARIO');
        expect([elegida.pais, elegida.universidad]).toEqual([
          'Bolivia',
          'Universidad Privada Boliviana',
        ]);
        expect(elegida.paisElegido).toBe('Bolivia');

        // «Otro país…» en la fila vacía país y universidad y destapa la casilla.
        elegirEnDesplegable(`registro-pro-titulo-pais-${fila.id}`, 'Otro país…');
        const [otra] = component.titulosDe('UNIVERSITARIO');
        expect([otra.pais, otra.universidad, otra.paisElegido, otra.universidadElegida]).toEqual([
          '',
          '',
          CATALOG_OUTSIDE_COUNTRY,
          null,
        ]);
        escribirEnCasilla(`registro-pro-titulo-pais-otro-${fila.id}`, 'Cuba');
        elegirEnDesplegable(`registro-pro-titulo-universidad-${fila.id}`, 'Otra institución…');
        escribirEnCasilla(
          `registro-pro-titulo-universidad-otra-${fila.id}`,
          'Universidad de La Habana',
        );
        const [cubana] = component.titulosDe('UNIVERSITARIO');
        expect([cubana.pais, cubana.universidad, cubana.universidadElegida]).toEqual([
          'Cuba',
          'Universidad de La Habana',
          CATALOG_OUTSIDE_INSTITUTION,
        ]);

        component.submit();
        const req = http.expectOne('/iam/auth/register-practitioner');
        expect(req.request.body.credentials).toEqual([
          {
            credentialTypeConceptId: 'c-degree',
            number: 'TIT-9',
            issuingInstitutionText: 'Universidad de La Habana',
            issuingCountryText: 'Cuba',
          },
        ]);
        req.flush(RESPUESTA_PRO);
      });
    });

    it('el paso dice qué se guarda hoy y qué se completa después desde el perfil', () => {
      catalogoDeTiposDeTitulo();
      completarProfesional();
      irAlPasoDeTitulos();

      // Desde el 04/10/2026 todo lo que la fila pregunta se guarda, así que la
      // línea ya no confiesa un descarte: dice qué es obligatorio y la salida.
      const alcance = (enElPaso('registro-pro-titulos-alcance')?.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim();
      expect(alcance).toBe(
        'De cada título se guardan el tipo, el número, la profesión, la universidad, el ' +
          'país, la ciudad y el PDF. Lo único obligatorio de una fila es el número del ' +
          'diploma: si no lo tiene a mano, quite la fila y cárguela después desde «Mi perfil».',
      );
      expect(alcance).not.toContain('todavía no se guardan');
    });

    // El aviso que reemplaza al freno: no manda a cargar el título principal
    // como «Otra profesión» —que es lo único que en esta alta lleva universidad
    // y nadie entendía—, sino que dice que no hace falta y dónde completarla.
    it('con universidad elegida y sin título que la lleve, el paso lo dice en criollo', () => {
      catalogoDeTiposDeTitulo();
      completarProfesional({ professionalTitleUniversity: 'Universidad Mayor de San Andrés' });
      irAlPasoDeTitulos();

      const aviso = (enElPaso('registro-pro-titulos-universidad')?.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim();
      expect(aviso).toBe(
        'La universidad que eligió («Universidad Mayor de San Andrés») no hace falta para ' +
          'crear su cuenta. Para que aparezca en su perfil, después agregue su título con su ' +
          'número de diploma desde «Mi perfil».',
      );
    });

    it('sin universidad elegida, el paso no muestra ese aviso', () => {
      catalogoDeTiposDeTitulo();
      completarProfesional();
      irAlPasoDeTitulos();

      expect(enElPaso('registro-pro-titulos-universidad')).toBeNull();
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

    /*
     * Correcciones del propietario del 04/10/2026: «Otra profesión» se elige
     * de la COB-2023, el nombre de un diplomado viaja y una fila incompleta
     * se frena en su propio paso, nombrando la sección que se ve.
     */
    it('«Otra profesión» viaja como concepto de la COB-2023, no como texto', () => {
      catalogoDeTiposDeTitulo();
      component.agregarTitulo('UNIVERSITARIO');
      const [fila] = component.titulosDe('UNIVERSITARIO');
      component.elegirProfesionEnFila(fila.id, {
        value: 'concepto-ingenieros-civiles',
        label: 'Ingenieros civiles',
      });
      component.escribirDatoDeTitulo(fila.id, 'numero', 'ING-1');

      completarProfesional();
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.credentials).toEqual([
        {
          credentialTypeConceptId: 'c-degree',
          number: 'ING-1',
          professionConceptId: 'concepto-ingenieros-civiles',
        },
      ]);
      req.flush(RESPUESTA_PRO);
    });

    it('la fila de «Otra profesión» no tiene casilla de texto para el nombre', () => {
      catalogoDeTiposDeTitulo();
      component.agregarTitulo('UNIVERSITARIO');
      const [fila] = component.titulosDe('UNIVERSITARIO');
      completarProfesional();
      irAlPasoDeTitulos();

      expect(enElPaso(`registro-pro-titulo-nombre-${fila.id}`)).toBeNull();
      expect(enElPaso(`registro-pro-titulo-profesion-${fila.id}`)).not.toBeNull();
    });

    it('el nombre de un diplomado viaja como titleText', () => {
      catalogoDeTiposDeTitulo();
      component.agregarTitulo('DIPLOMADO');
      const [fila] = component.titulosDe('DIPLOMADO');
      component.escribirNombreDeTitulo(fila.id, 'Diplomado en Salud Pública');
      component.escribirDatoDeTitulo(fila.id, 'numero', 'DIP-9');

      completarProfesional();
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.credentials).toEqual([
        {
          credentialTypeConceptId: 'c-diploma',
          number: 'DIP-9',
          titleText: 'Diplomado en Salud Pública',
        },
      ]);
      req.flush(RESPUESTA_PRO);
    });

    it('una fila sin número frena «Siguiente» en «Sus títulos» y nombra la sección', () => {
      catalogoDeTiposDeTitulo();
      completarProfesional();
      irAlPasoDeTitulos();
      component.agregarTitulo('UNIVERSITARIO');
      const [fila] = component.titulosDe('UNIVERSITARIO');
      component.elegirProfesionEnFila(fila.id, {
        value: 'concepto-ingenieros-civiles',
        label: 'Ingenieros civiles',
      });
      fixture.detectChanges();

      // El aviso del paso dice QUÉ sección, con su nombre visible.
      expect(enElPaso('registro-pro-titulos-incompletos')?.textContent).toContain(
        '«Otra profesión»',
      );
      // Y «Siguiente» no deja salir del paso.
      const continuar: HTMLButtonElement = fixture.nativeElement.querySelector(
        '[data-testid="paginated-form-continuar"]',
      );
      continuar.click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.registro-titulos')).not.toBeNull();

      // Completar el número lo destraba.
      component.escribirDatoDeTitulo(fila.id, 'numero', 'ING-1');
      fixture.detectChanges();
      expect(enElPaso('registro-pro-titulos-incompletos')).toBeNull();
      continuar.click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.registro-titulos')).toBeNull();
    });

    it('todo lo que la fila pregunta viaja con su credencial', () => {
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
      // La credencial lleva tipo, número, país, ciudad y el fileId del PDF
      // (modelo v4.2.29/v4.2.41). Los campos sueltos del formulario no viajan.
      expect(req.request.body.credentials).toEqual([
        {
          credentialTypeConceptId: 'c-degree',
          number: 'TIT-1',
          issuingCountryText: 'Bolivia',
          issuingCityText: 'La Paz',
          fileId: 'file-title-1',
        },
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
        expect(avisoVisible()).not.toContain('reintente en unos segundos');

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
        expect(avisoVisible()).toContain('número del diploma');
        irAlPasoDeTitulos();

        botonReintentar()?.click();
        catalogoDeTiposCompleto();

        // El catálogo ya está, pero la fila sigue sin número: retirar este
        // aviso de rebote dejaría el envío frenado y la pantalla muda.
        expect(avisoVisible()).toContain('número del diploma');
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
  });

  describe('ubicaciones: sólo el punto se marca, lo demás sale de él (26/10/2026)', () => {
    const PUNTO = { lat: -17.79, lng: -63.19 };
    const localidad = (
      punto: { lat: number; lng: number },
      extra: Partial<{
        calle: string | null;
        calleSola: string | null;
        zona: string | null;
        municipioConceptId: string | null;
      }> = {},
    ) => ({
      punto,
      calle: 'Calle Warnes 45, Equipetrol',
      calleSola: 'Calle Warnes 45',
      zona: 'Equipetrol',
      municipioConceptId: 'mun-scz',
      ...extra,
    });

    function campo(clave: string, key: string) {
      return component
        .paginasProfesional()
        .find((pagina) => pagina.clave === clave)
        ?.campos.find((c) => c.key === key);
    }

    it('el punto del domicilio va primero en su página y es obligatorio, con su error', () => {
      const pagina = component.paginasProfesional().find((p) => p.clave === 'residence')!;
      expect(pagina.campos[0]?.key).toBe('gpsDomicilio');
      expect(pagina.campos[0]?.required).toBe(true);
      expect(pagina.campos[0]?.mensajeDeError).toBe(
        'Marque el lugar en el mapa y pulse «Confirmar dirección actual».',
      );
      // Ninguna página ofrece escribir calle, zona o localidad a mano.
      const claves = component.paginasProfesional().flatMap((p) => p.campos.map((c) => c.key));
      for (const fijo of [
        'municipio',
        'homeDistrict',
        'homeAddressLines',
        'workAddressLines',
        'municipioConsultorio',
        'officeDistrict',
        'officeAddressLines',
      ]) {
        expect(claves).not.toContain(fijo);
      }
      // El trabajo y el consultorio siguen siendo opcionales, como sus páginas.
      expect(campo('workplace-location', 'gpsTrabajo')?.required).toBeFalsy();
      expect(campo('own-office', 'gpsConsultorio')?.required).toBeFalsy();
    });

    it('sin punto confirmado el alta no sale; al confirmar, el control obligatorio se llena', () => {
      completarProfesional();
      component.confirmarGpsDomicilio(null);
      const control = component.formProfesional.controls.gpsDomicilio;
      expect(control.hasError('required')).toBe(true);

      component.submit();
      http.expectNone('/iam/auth/register-practitioner');

      component.confirmarGpsDomicilio(PUNTO);
      expect(control.value).toEqual(PUNTO);
      expect(component.formProfesional.valid).toBe(true);
    });

    it('lo deducido del punto confirmado llena calle, zona y municipio del domicilio', () => {
      completarProfesional();
      component.aplicarLocalidadDomicilio(localidad(PUNTO));
      // Sin confirmar, nada: la calle de un punto que nadie dio por bueno no se guarda.
      component.confirmarGpsDomicilio(null);
      expect(component.formProfesional.controls.homeAddressLines.value).toBe('');
      expect(component.municipioProfesional()).toBeNull();

      component.confirmarGpsDomicilio(PUNTO);

      const raw = component.formProfesional.getRawValue();
      expect(raw.homeAddressLines).toBe('Calle Warnes 45');
      expect(raw.homeDistrict).toBe('Equipetrol');
      expect(raw.municipio).toBe('mun-scz');
      expect(component.municipioProfesional()).toBe('mun-scz');

      component.submit();
      const req = http.expectOne('/iam/auth/register-practitioner');
      // Calle y distrito viajan separados (ADR-0028 de la API).
      expect(req.request.body.homeAddressLines).toBe('Calle Warnes 45');
      expect(req.request.body.homeDistrict).toBe('Equipetrol');
      expect(req.request.body.residenceMunicipalityConceptId).toBe('mun-scz');
      expect(req.request.body.homeLatitude).toBe(-17.79);
      req.flush(RESPUESTA_PRO);
    });

    it('lo que llega después de confirmar también se vuelca, y quitar el punto lo vacía', () => {
      completarProfesional();
      component.confirmarGpsDomicilio(PUNTO);
      component.aplicarLocalidadDomicilio(localidad(PUNTO, { calle: null, calleSola: null }));
      // Sin calle en el mapa, la calle queda vacía: nunca se inventa.
      expect(component.formProfesional.controls.homeAddressLines.value).toBe('');
      expect(component.formProfesional.controls.homeDistrict.value).toBe('Equipetrol');

      component.aplicarLocalidadDomicilio(localidad(PUNTO));
      expect(component.formProfesional.controls.homeAddressLines.value).toBe('Calle Warnes 45');

      component.confirmarGpsDomicilio(null);
      expect(component.formProfesional.getRawValue()).toEqual(
        expect.objectContaining({ homeAddressLines: '', homeDistrict: '', municipio: null }),
      );
    });

    it('el trabajo guarda la línea entera de su punto', () => {
      completarProfesional();
      component.confirmarGpsTrabajo(PUNTO);
      component.aplicarLocalidadTrabajo(localidad(PUNTO));
      expect(component.formProfesional.controls.workAddressLines.value).toBe(
        'Calle Warnes 45, Equipetrol',
      );
    });

    it('el consultorio guarda calle, zona y municipio de su propio punto', () => {
      completarProfesional();
      component.aplicarLocalidadConsultorio(localidad(PUNTO, { municipioConceptId: 'mun-of' }));
      component.confirmarGpsConsultorio(PUNTO);

      expect(component.formProfesional.controls.officeAddressLines.value).toBe('Calle Warnes 45');
      expect(component.formProfesional.controls.officeDistrict.value).toBe('Equipetrol');
      expect(component.municipioConsultorio()).toBe('mun-of');
      // El del domicilio no se toca.
      expect(component.municipioProfesional()).toBeNull();
    });
  });

  describe('firma y sello médicos del alta (imágenes, opcionales)', () => {
    const FIRMA =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
    const SELLO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD';

    it('el paso existe, es saltable y cierra el alta', () => {
      const claves = component.paginasProfesional().map((pagina) => pagina.clave);
      expect(claves).toContain('signature-seal');
      expect(claves.at(-1)).toBe('signature-seal');
      const pagina = component.paginasProfesional().find((p) => p.clave === 'signature-seal')!;
      // Ninguno de los dos campos es obligatorio: se puede seguir sin cargar nada.
      expect(pagina.campos.map((c) => c.key)).toEqual(['signatureImageBase64', 'sealImageBase64']);
      expect(pagina.campos.some((c) => c.required === true)).toBe(false);
    });

    it('sube firma y sello y envía sus fileId al backend real', () => {
      completarProfesional();
      component.formProfesional.controls.signatureImageBase64.setValue(FIRMA);
      component.formProfesional.controls.sealImageBase64.setValue(SELLO);
      component.submit();

      const firma = http.expectOne('/iam/auth/upload-registration-signature-image');
      expect(firma.request.body instanceof FormData).toBe(true);
      expect((firma.request.body.get('file') as File).type).toBe('image/png');
      http.expectNone('/iam/auth/register-practitioner');
      firma.flush({
        fileId: 'firma-id',
        originalName: 'firma.png',
        sizeBytes: 70,
        mimeType: 'image/png',
      });
      const sello = http.expectOne('/iam/auth/upload-registration-signature-image');
      sello.flush({
        fileId: 'sello-id',
        originalName: 'sello.png',
        sizeBytes: 70,
        mimeType: 'image/png',
      });

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.signatureFileId).toBe('firma-id');
      expect(req.request.body.sealFileId).toBe('sello-id');
      expect(req.request.body.signatureImageBase64).toBeUndefined();
      expect(req.request.body.sealImageBase64).toBeUndefined();
      req.flush(RESPUESTA_PRO);
    });

    it('con el backend real no manda imágenes inline de firma ni sello aunque estén cargadas', () => {
      const original = environment.mockBackend;
      Object.assign(environment, { mockBackend: false });
      try {
        completarProfesional();
        component.formProfesional.controls.signatureImageBase64.setValue(FIRMA);
        component.formProfesional.controls.sealImageBase64.setValue(SELLO);

        component.submit();

        const firma = http.expectOne('/iam/auth/upload-registration-signature-image');
        firma.flush({
          fileId: 'firma-id',
          originalName: 'firma.png',
          sizeBytes: 70,
          mimeType: 'image/png',
        });
        const sello = http.expectOne('/iam/auth/upload-registration-signature-image');
        sello.flush({
          fileId: 'sello-id',
          originalName: 'sello.png',
          sizeBytes: 70,
          mimeType: 'image/png',
        });
        const req = http.expectOne('/iam/auth/register-practitioner');
        expect(req.request.body.signatureImageBase64).toBeUndefined();
        expect(req.request.body.sealImageBase64).toBeUndefined();
        req.flush(RESPUESTA_PRO);
      } finally {
        Object.assign(environment, { mockBackend: original });
      }
    });

    it('con mockBackend envía las dos imágenes en el cuerpo cuando se cargan', () => {
      const original = environment.mockBackend;
      Object.assign(environment, { mockBackend: true });
      try {
        completarProfesional();
        component.formProfesional.controls.signatureImageBase64.setValue(FIRMA);
        component.formProfesional.controls.sealImageBase64.setValue(SELLO);

        component.submit();

        const req = http.expectOne('/iam/auth/register-practitioner');
        expect(req.request.body.signatureImageBase64).toBe(FIRMA);
        expect(req.request.body.sealImageBase64).toBe(SELLO);
        req.flush(RESPUESTA_PRO);
      } finally {
        Object.assign(environment, { mockBackend: original });
      }
    });

    it('con mockBackend envía las dos imágenes en el cuerpo sin subirlas', () => {
      const original = environment.mockBackend;
      Object.assign(environment, { mockBackend: true });
      try {
        completarProfesional();
        component.formProfesional.controls.signatureImageBase64.setValue(FIRMA);
        component.formProfesional.controls.sealImageBase64.setValue(SELLO);

        component.submit();

        http.expectNone('/iam/auth/upload-registration-signature-image');
        const req = http.expectOne('/iam/auth/register-practitioner');
        expect(req.request.body.signatureImageBase64).toBe(FIRMA);
        expect(req.request.body.sealImageBase64).toBe(SELLO);
        req.flush(RESPUESTA_PRO);
      } finally {
        Object.assign(environment, { mockBackend: original });
      }
    });

    it('reintenta el sello sin repetir una firma ya cargada', () => {
      completarProfesional();
      component.formProfesional.controls.signatureImageBase64.setValue(FIRMA);
      component.formProfesional.controls.sealImageBase64.setValue(SELLO);
      component.submit();
      http.expectOne('/iam/auth/upload-registration-signature-image').flush({ fileId: 'firma-id' });
      http
        .expectOne('/iam/auth/upload-registration-signature-image')
        .flush({}, { status: 503, statusText: 'Unavailable' });
      http.expectNone('/iam/auth/register-practitioner');
      expect(component.registered()).toBe(false);

      component.submit();
      http.expectOne('/iam/auth/upload-registration-signature-image').flush({ fileId: 'sello-id' });
      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.signatureFileId).toBe('firma-id');
      expect(req.request.body.sealFileId).toBe('sello-id');
      req.flush(RESPUESTA_PRO);
    });

    it('no registra si la subida no confirma un fileId', () => {
      completarProfesional();
      component.formProfesional.controls.signatureImageBase64.setValue(FIRMA);
      component.submit();
      http.expectOne('/iam/auth/upload-registration-signature-image').flush({ fileId: '' });
      http.expectNone('/iam/auth/register-practitioner');
      expect(component.registered()).toBe(false);
    });

    it('sin firma ni sello el alta viaja igual y no manda ninguna clave', () => {
      completarProfesional();

      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.signatureImageBase64).toBeUndefined();
      expect(req.request.body.sealImageBase64).toBeUndefined();
      req.flush(RESPUESTA_PRO);
    });

    it('quitar limpia la vista y el control de cada imagen', () => {
      component.firmaBase64.set(FIRMA);
      component.selloBase64.set(SELLO);
      component.formProfesional.controls.signatureImageBase64.setValue(FIRMA);
      component.formProfesional.controls.sealImageBase64.setValue(SELLO);

      component.quitarFirma();

      expect(component.firmaBase64()).toBeNull();
      expect(component.formProfesional.controls.signatureImageBase64.value).toBeNull();
      expect(component.selloBase64()).toBe(SELLO);

      component.quitarSello();

      expect(component.selloBase64()).toBeNull();
      expect(component.formProfesional.controls.sealImageBase64.value).toBeNull();
    });

    it.each([
      ['alSeleccionarFirma', 'errorFirma'],
      ['alSeleccionarSello', 'errorSello'],
    ] as const)('%s rechaza un formato que no es imagen', (metodo, error) => {
      const entrada = document.createElement('input');
      Object.defineProperty(entrada, 'files', {
        value: [new File(['hola'], 'firma.txt', { type: 'text/plain' })],
      });

      component[metodo]({ target: entrada } as unknown as Event);

      expect(component[error]()).toContain('JPG, PNG o WebP');
    });

    it.each([
      ['alSeleccionarFirma', 'errorFirma'],
      ['alSeleccionarSello', 'errorSello'],
    ] as const)('%s rechaza una imagen de más de 2 MB', (metodo, error) => {
      const entrada = document.createElement('input');
      const pesada = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'firma.png', {
        type: 'image/png',
      });
      Object.defineProperty(entrada, 'files', { value: [pesada] });

      component[metodo]({ target: entrada } as unknown as Event);

      expect(component[error]()).toContain('2 MB');
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
        expect(SPECIALTY[codigo], codigo).toBeDefined();
      }
    });

    it('deja médicas de sobra del otro lado', () => {
      // La otra mitad del corte: si el complemento quedara vacío, el filtro
      // estaría bien escrito y aun así ninguna profesión médica tendría qué
      // ofrecer. Son las 52 restantes de las 63.
      const medicas = Object.keys(SPECIALTY).filter(
        (codigo) => !ESPECIALIDADES_ODONTOLOGICAS.has(codigo),
      );

      expect(medicas.length).toBeGreaterThan(40);
    });
  });

  /* ==========================================================================
     Dónde trabaja y con qué seguros (28/10/2026).

     Lo elegido vive en dos señales que gobierna `app-workplace-picker`. Lo que
     importa acá es el contrato: viajan los slugs públicos y los ids del
     catálogo, no viaja nada si no eligió nada, y el aviso final cuenta lo que
     la API dice que creó —no lo que se eligió—.
     ========================================================================== */
  describe('instituciones y seguros', () => {
    function enviar(respuesta: object = RESPUESTA_PRO): Record<string, unknown> {
      component.submit();
      const req = http.expectOne('/iam/auth/register-practitioner');
      const cuerpo = req.request.body as Record<string, unknown>;
      req.flush(respuesta);
      return cuerpo;
    }

    it('sin elegir nada, el cuerpo no las menciona', () => {
      completarProfesional();

      const cuerpo = enviar();

      expect(cuerpo['institutionSlugs']).toBeUndefined();
      expect(cuerpo['insurerCarrierIds']).toBeUndefined();
    });

    it('viajan los slugs de las instituciones y los ids de las aseguradoras elegidas', () => {
      completarProfesional();
      component.institucionesElegidas.set([
        { slug: 'clinica-foianini', name: 'Clínica Foianini', city: 'Santa Cruz', verified: true },
        { slug: 'hospital-japones', name: 'Hospital Japonés', city: null, verified: false },
      ]);
      component.aseguradorasElegidas.set(['carrier-a', 'carrier-b']);

      const cuerpo = enviar();

      expect(cuerpo['institutionSlugs']).toEqual(['clinica-foianini', 'hospital-japones']);
      expect(cuerpo['insurerCarrierIds']).toEqual(['carrier-a', 'carrier-b']);
    });

    it('el aviso final cuenta los pedidos que la API confirma, no los elegidos', () => {
      completarProfesional();
      component.institucionesElegidas.set([
        { slug: 'clinica-foianini', name: 'Clínica Foianini', city: null, verified: true },
      ]);
      component.aseguradorasElegidas.set(['carrier-a', 'carrier-b']);

      // La API creó un vínculo y una sola solicitud: la otra ya estaba viva.
      enviar({ ...RESPUESTA_PRO, affiliationIds: ['af-1'], insurerRequestIds: ['ir-1'] });
      fixture.detectChanges();

      expect(component.pedidosEnviados()).toBe(2);
      const aviso = fixture.nativeElement.querySelector(
        '[data-testid="registro-pedidos-enviados"]',
      ) as HTMLElement | null;
      expect(aviso?.textContent).toContain('Enviamos 2');
      expect(aviso?.textContent).toContain('Mis verificaciones');
    });

    it('sin pedidos confirmados no promete ninguno', () => {
      completarProfesional();

      enviar();
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('[data-testid="registro-pedidos-enviados"]'),
      ).toBeNull();
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

    it('el teléfono opcional crea el consultorio y queda dentro de esa sede', () => {
      completarProfesional();
      component.formProfesional.patchValue({ officeContactPhone: '+591 72123456' });

      expect(cuerpoDelAlta()['ownSite']).toEqual({
        name: 'Mi consultorio',
        contactPhone: '+591 72123456',
      });
    });

    it('un teléfono vacío no agrega un campo de contacto al consultorio', () => {
      completarProfesional();
      component.formProfesional.patchValue({
        officeName: 'Consultorio Suárez',
        officeContactPhone: '',
      });

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

    it('el distrito del consultorio viaja aparte de la calle (ADR-0028)', () => {
      completarProfesional();
      component.formProfesional.patchValue({
        officeAddressLines: 'Calle Warnes 45',
        officeDistrict: 'Equipetrol',
      });

      expect(cuerpoDelAlta()['ownSite']).toEqual({
        name: 'Mi consultorio',
        address: { lines: ['Calle Warnes 45'], district: 'Equipetrol' },
      });
    });

    it('un distrito solo alcanza para declarar la dirección del consultorio', () => {
      completarProfesional();
      component.formProfesional.patchValue({ officeDistrict: '  Equipetrol  ' });

      expect(cuerpoDelAlta()['ownSite']).toEqual({
        name: 'Mi consultorio',
        address: { lines: [], district: 'Equipetrol' },
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

  describe('borrador restaurado', () => {
    it('la fecha vuelve como Date y no revienta al enviar (a.getFullYear is not a function)', () => {
      component.restaurarBorrador({
        draftId: 'd-1',
        formType: 'practitioner',
        stepIndex: 1,
        data: { birthDate: '1990-05-10T04:00:00.000Z', licenseIssueDate: 'no-es-fecha' },
        createdAt: '2026-10-26T00:00:00.000Z',
        updatedAt: '2026-10-26T00:00:00.000Z',
        percentComplete: 10,
      });
      const fecha = component.formProfesional.controls.birthDate.value;
      expect(fecha).toBeInstanceOf(Date);
      expect(fecha?.getFullYear()).toBe(1990);
      // Un texto que no es fecha queda vacío en vez de llegar al envío.
      expect(component.formProfesional.controls.licenseIssueDate.value).toBeNull();
    });
  });
});

describe('RegisterPractitioner con mockBackend', () => {
  const originalMockBackend = environment.mockBackend;
  beforeEach(() => Object.assign(environment, { mockBackend: true }));
  afterEach(() => Object.assign(environment, { mockBackend: originalMockBackend }));
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
    const codigosCanonicos = [
      'CREDENTIAL_TYPE_DEGREE',
      'CREDENTIAL_TYPE_DIPLOMA',
      'CREDENTIAL_TYPE_MASTER',
      'CREDENTIAL_TYPE_DOCTORATE',
      'CREDENTIAL_TYPE_SPECIALTY',
    ];

    await vi.waitFor(
      () => {
        fixture.detectChanges();
        const conceptos = (
          component as unknown as {
            conceptoPorCodigo: () => ReadonlyMap<string, string>;
          }
        ).conceptoPorCodigo();
        expect(codigosCanonicos.map((code) => conceptos.get(code))).toEqual(
          enumeracion.options.map((option) => option.conceptId),
        );
      },
      { timeout: 18_000 },
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

