import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { RegisterPractitioner } from './register-practitioner';
import { RefreshTokenStorage } from '../../../core/auth/refresh-token.storage';

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
        | 'middleName'
        | 'motherLastName'
        | 'nationalId'
        | 'regulatoryAuthority'
        | 'specialtyPrimary'
        | 'specialtySecond'
        | 'specialtyThird',
        string
      >
    > = {},
  ): void {
    component.formProfesional.setValue({
      name: 'Ana',
      middleName: extra.middleName ?? '',
      lastName: 'Paz',
      motherLastName: extra.motherLastName ?? '',
      nationalId: extra.nationalId ?? '',
      email: 'ana@hospital.test',
      password: 'secreto12',
      licenseNumber: 'MP-12345',
      credentialNumber: 'TIT-6789',
      regulatoryAuthority: extra.regulatoryAuthority ?? '',
      professionalTitle: extra.professionalTitle ?? '',
      phone: extra.phone ?? '',
      birthDate: null,
      licenseIssueDate: null,
      issuerAdministrativeAreaConceptId: null,
      specialtyPrimary: extra.specialtyPrimary ?? '',
      specialtySecond: extra.specialtySecond ?? '',
      specialtyThird: extra.specialtyThird ?? '',
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
   * **La red de seguridad de la mudanza.**
   *
   * El alta de profesional vivía dentro de `register-patient` y salió de ahí
   * tal cual: mismo orden, mismos campos, mismos rótulos y mismos `data-testid`.
   * Este volcado se capturó CORRIENDO el componente viejo antes de moverlo, así
   * que si la mudanza cambió algo sin querer, falla acá y dice exactamente qué.
   *
   * No es un test que haya que preservar para siempre: cuando la tarjeta 05
   * reordene los campos (F2), este literal se actualiza a propósito y **ese
   * diff es la revisión del reordenamiento**.
   */
  it('declara las seis páginas tal como estaban antes de separarse del alta de paciente', () => {
    expect(estructuraDeclarada()).toEqual([
      {
        clave: 'nombre',
        titulo: '¿Cómo te llamás?',
        hint: 'Como figura en tu documento. Si no tenés alguno, dejalo vacío.',
        campos: [
          {
            key: 'name',
            control: 'text',
            label: 'Nombre',
            required: true,
            testId: 'registro-pro-nombre',
            ancho: 'mitad',
            hint: null,
            placeholder: 'Ana',
            autocomplete: 'given-name',
            icono: null,
            mensajeDeError: 'Ingresá tu nombre.',
          },
          {
            key: 'middleName',
            control: 'text',
            label: 'Segundo nombre',
            required: false,
            testId: 'registro-pro-segundo-nombre',
            ancho: 'mitad',
            hint: 'Si no tenés, dejalo vacío.',
            placeholder: 'Lucía',
            autocomplete: 'additional-name',
            icono: null,
            mensajeDeError: null,
          },
          {
            key: 'lastName',
            control: 'text',
            label: 'Apellido paterno',
            required: true,
            testId: 'registro-pro-apellido-paterno',
            ancho: 'mitad',
            hint: null,
            placeholder: 'Rojas',
            autocomplete: 'family-name',
            icono: null,
            mensajeDeError: 'Ingresá tu apellido paterno.',
          },
          {
            key: 'motherLastName',
            control: 'text',
            label: 'Apellido materno',
            required: false,
            testId: 'registro-pro-apellido-materno',
            ancho: 'mitad',
            hint: 'Si no llevás, dejalo vacío.',
            placeholder: 'Paz',
            autocomplete: 'family-name',
            icono: null,
            mensajeDeError: null,
          },
        ],
      },
      {
        clave: 'documento',
        titulo: 'Tus datos',
        hint: 'Todo opcional: se guarda en tu perfil profesional.',
        campos: [
          {
            key: 'nationalId',
            control: 'text',
            label: 'Cédula de identidad (opcional)',
            required: false,
            testId: 'registro-pro-documento',
            ancho: 'mitad',
            hint: 'Se guarda como tu documento oficial.',
            placeholder: '1234567',
            autocomplete: 'off',
            icono: 'patients',
            mensajeDeError: 'Letras, números, punto y guion.',
          },
          {
            key: 'issuerAdministrativeAreaConceptId',
            control: 'select',
            label: 'Departamento de emisión (opcional)',
            required: false,
            testId: 'registro-pro-departamento-ci',
            ancho: 'mitad',
            hint: 'El «SC», «LP»... de tu cédula.',
            placeholder: 'Sin especificar',
            autocomplete: null,
            icono: null,
            mensajeDeError: null,
          },
          {
            key: 'birthDate',
            control: 'date',
            label: 'Fecha de nacimiento (opcional)',
            required: false,
            testId: null,
            ancho: 'completo',
            hint: null,
            placeholder: null,
            autocomplete: null,
            icono: null,
            mensajeDeError: null,
          },
          {
            key: 'municipio',
            control: 'custom',
            label: '¿Dónde vivís? (opcional)',
            required: false,
            testId: null,
            ancho: 'completo',
            hint: 'Buscá tu municipio, o abrí tu departamento.',
            placeholder: null,
            autocomplete: null,
            icono: null,
            mensajeDeError: null,
          },
        ],
      },
      {
        clave: 'habilitacion',
        titulo: 'Tu habilitación para ejercer',
        hint: 'Sin matrícula y número de colegio no podemos darte de alta.',
        campos: [
          {
            key: 'licenseNumber',
            control: 'text',
            label: 'Número de matrícula',
            required: true,
            testId: 'registro-pro-matricula',
            ancho: 'mitad',
            hint: 'La que te habilita a ejercer, la del registro del Ministerio.',
            placeholder: 'MP-12345',
            autocomplete: 'off',
            icono: 'shield',
            mensajeDeError: 'Ingresá tu matrícula profesional.',
          },
          {
            key: 'credentialNumber',
            control: 'text',
            label: 'Número de credencial',
            required: true,
            testId: 'registro-pro-credencial',
            ancho: 'mitad',
            hint: 'El de tu colegio profesional.',
            placeholder: 'TIT-6789',
            autocomplete: 'off',
            icono: 'briefcase',
            mensajeDeError: 'Ingresá el número de tu colegio.',
          },
          {
            key: 'regulatoryAuthority',
            control: 'select',
            label: 'Autoridad reguladora (opcional)',
            required: false,
            testId: 'registro-pro-autoridad',
            ancho: 'completo',
            hint: 'Quién emitió tu matrícula.',
            placeholder: 'Sin especificar',
            autocomplete: null,
            icono: null,
            mensajeDeError: null,
          },
          {
            key: 'licenseIssueDate',
            control: 'date',
            label: 'Fecha de inscripción de la matrícula (opcional)',
            required: false,
            testId: null,
            ancho: 'completo',
            hint: 'Cuándo te registraste, no cuándo vence.',
            placeholder: null,
            autocomplete: null,
            icono: null,
            mensajeDeError: null,
          },
        ],
      },
      {
        clave: 'practica',
        titulo: 'Tu práctica',
        hint: 'Lo que van a ver tus pacientes. Podés completarlo después.',
        campos: [
          {
            key: 'professionalTitle',
            control: 'select',
            label: 'Título profesional (opcional)',
            required: false,
            testId: 'registro-pro-titulo',
            ancho: 'completo',
            hint: 'Cómo aparecés en tu ficha. Al elegirlo, la lista de especialidades y el colegio se acomodan solos.',
            placeholder: 'Sin especificar',
            autocomplete: null,
            icono: null,
            mensajeDeError: null,
          },
          {
            key: 'phone',
            control: 'tel',
            label: 'Teléfono (opcional)',
            required: false,
            testId: 'registro-pro-telefono',
            ancho: 'completo',
            hint: 'Elegí el país si tu número no es de Bolivia.',
            placeholder: null,
            autocomplete: 'tel',
            icono: 'phone',
            mensajeDeError: 'El número está incompleto para el país elegido.',
          },
        ],
      },
      {
        clave: 'especialidades',
        titulo: 'Tus especialidades',
        hint: 'Hasta tres. Son lo que un paciente busca cuando necesita a alguien como vos.',
        campos: [
          {
            key: 'specialtyPrimary',
            control: 'select',
            label: 'Especialidad principal (opcional)',
            required: false,
            testId: 'registro-pro-especialidad-1',
            ancho: 'completo',
            hint: 'La que responde «¿de qué sos?».',
            placeholder: 'Sin especialidad',
            autocomplete: null,
            icono: null,
            mensajeDeError: null,
          },
          {
            key: 'specialtySecond',
            control: 'select',
            label: 'Segunda especialidad (opcional)',
            required: false,
            testId: 'registro-pro-especialidad-2',
            ancho: 'completo',
            hint: null,
            placeholder: 'Sin especificar',
            autocomplete: null,
            icono: null,
            mensajeDeError: null,
          },
          {
            key: 'specialtyThird',
            control: 'select',
            label: 'Tercera especialidad (opcional)',
            required: false,
            testId: 'registro-pro-especialidad-3',
            ancho: 'completo',
            hint: null,
            placeholder: 'Sin especificar',
            autocomplete: null,
            icono: null,
            mensajeDeError: null,
          },
        ],
      },
      {
        clave: 'acceso',
        titulo: 'Tu acceso',
        hint: 'Con este correo y esta contraseña vas a iniciar sesión.',
        campos: [
          {
            key: 'email',
            control: 'email',
            label: 'Correo profesional',
            required: true,
            testId: 'registro-pro-correo',
            ancho: 'completo',
            hint: 'Con este correo vas a iniciar sesión.',
            placeholder: 'matricula@hospital.bo',
            autocomplete: 'username',
            icono: 'mail',
            mensajeDeError: 'Ingresá un correo válido.',
          },
          {
            key: 'password',
            control: 'password',
            label: 'Contraseña',
            required: true,
            testId: 'registro-pro-password',
            ancho: 'completo',
            hint: 'Al menos 8 caracteres.',
            placeholder: 'Tu contraseña',
            autocomplete: 'new-password',
            icono: 'lock',
            mensajeDeError: 'La contraseña necesita al menos 8 caracteres.',
          },
        ],
      },
    ]);
  });

  it('tiene seis páginas, ninguna de más de cuatro preguntas', () => {
    // Seis y no cinco porque el límite es de campos por página, no de
    // páginas: apretar seis en una para tener una página menos es lo que
    // este motor vino a deshacer. La sexta son las especialidades, que
    // entraron con página propia por esa misma regla.
    const paginas = component.paginasProfesional();

    expect(paginas.length).toBe(6);
    for (const pagina of paginas) {
      expect(pagina.campos.length).toBeLessThanOrEqual(4);
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

  it('va a otro endpoint que el alta de paciente y manda los cinco campos obligatorios', () => {
    completarProfesional();
    component.submit();

    const req = http.expectOne('/iam/auth/register-practitioner');
    expect(req.request.method).toBe('POST');
    // El identificador de acceso es el correo, no el documento. El nombre va
    // en partes, igual que en el alta de paciente.
    expect(req.request.body).toEqual({
      name: 'Ana',
      lastName: 'Paz',
      email: 'ana@hospital.test',
      password: 'secreto12',
      licenseNumber: 'MP-12345',
      credentialNumber: 'TIT-6789',
    });

    req.flush(RESPUESTA_PRO);
  });

  it('agrega segundo nombre y apellido materno solo si se completaron', () => {
    completarProfesional({ middleName: 'Lucía', motherLastName: 'Rojas' });
    component.submit();

    const req = http.expectOne('/iam/auth/register-practitioner');
    expect(req.request.body.middleName).toBe('Lucía');
    expect(req.request.body.motherLastName).toBe('Rojas');

    req.flush(RESPUESTA_PRO);
  });

  it('agrega título y teléfono solo si se completaron', () => {
    completarProfesional({ professionalTitle: 'Cardiología', phone: '+591 70012345' });
    component.submit();

    const req = http.expectOne('/iam/auth/register-practitioner');
    expect(req.request.body.professionalTitle).toBe('Cardiología');
    expect(req.request.body.phone).toBe('+591 70012345');

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

  it('exige matrícula y credencial: sin habilitación no hay alta', () => {
    completarProfesional();
    component.formProfesional.patchValue({ licenseNumber: '', credentialNumber: '' });
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
      expect(component.arbolMunicipios()).toEqual([]);
      expect(navegaciones).toEqual([]);
    });
  });
});
