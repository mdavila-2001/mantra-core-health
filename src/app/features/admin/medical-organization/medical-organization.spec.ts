import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { MedicalOrganization } from './medical-organization';

/**
 * Consola de organización médica (CARRIL 13) contra
 * `GET /practices` y `GET /practices/:id/organization`.
 *
 * Se monta con `RouterTestingHarness` porque la pantalla lee las migas de
 * `NavigationService`, que necesita una ruta activa de verdad.
 */
const RUTA = '/administration/medical-organization';

const PRACTICA = {
  id: 'prac-1',
  code: 'HOSP-CENTRAL',
  name: 'Hospital Central',
  status: 'activa',
};

const CONCEPTO = (code: string, display: string) => ({ code, display });

function consola(overrides: Record<string, unknown> = {}) {
  return {
    organization: {
      id: 'prac-1',
      code: 'HOSP-CENTRAL',
      name: 'Hospital Central',
      type: CONCEPTO('PR_TYPE_CLINIC', 'Clínica'),
      status: CONCEPTO('PR_ACTIVE', 'Activa'),
      timeZone: 'America/La_Paz',
      currency: null,
    },
    sites: [],
    clinicalUnits: [],
    careSpaces: [],
    healthcareServices: [],
    staff: [],
    legalDocuments: [],
    inventory: [],
    ...overrides,
  };
}

describe('MedicalOrganization', () => {
  let harness: RouterTestingHarness;
  let componente: MedicalOrganization;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'administration/medical-organization', component: MedicalOrganization },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl(RUTA, MedicalOrganization);
  });

  afterEach(() => http.verify());

  /** Resuelve el listado de prácticas y la consola de la primera. */
  function cargar(datos: object = consola()): void {
    http.expectOne('/practices').flush([PRACTICA]);
    harness.detectChanges();
    http.expectOne('/practices/prac-1/organization').flush(datos);
    harness.detectChanges();
  }

  it('elige la primera práctica sola y carga su árbol', () => {
    cargar();

    // Sin esto la pantalla abriría pidiendo un uuid que nadie conoce, que es el
    // defecto que el carril viene a cerrar.
    const texto = harness.routeNativeElement?.textContent ?? '';
    expect(texto).toContain('Hospital Central');
    expect(texto).toContain('HOSP-CENTRAL');
  });

  it('no ofrece selector con una sola organización', () => {
    cargar();

    expect(harness.routeNativeElement?.querySelector('#practica-elegida')).toBeNull();
  });

  it('ofrece selector cuando hay más de una, y cambia de árbol al elegir', () => {
    http
      .expectOne('/practices')
      .flush([PRACTICA, { ...PRACTICA, id: 'prac-2', code: 'CLIN-NORTE', name: 'Clínica Norte' }]);
    harness.detectChanges();
    http.expectOne('/practices/prac-1/organization').flush(consola());
    harness.detectChanges();

    expect(harness.routeNativeElement?.querySelector('#practica-elegida')).not.toBeNull();

    componente['elegirPractica']('prac-2');
    harness.detectChanges();
    http.expectOne('/practices/prac-2/organization').flush(
      consola({
        organization: {
          ...consola().organization,
          id: 'prac-2',
          code: 'CLIN-NORTE',
          name: 'Clínica Norte',
        },
      }),
    );
    harness.detectChanges();

    expect(harness.routeNativeElement?.textContent).toContain('Clínica Norte');
  });

  it('no vuelve a pedir el árbol si se elige la práctica que ya está abierta', () => {
    cargar();

    componente['elegirPractica']('prac-1');

    // Sin la guarda, cada repintado del selector dispararía una petición: el
    // `verify()` del `afterEach` fallaría con una petición pendiente.
    http.verify();
  });

  it('dice que no hay nada que administrar cuando el tenant no tiene prácticas', () => {
    http.expectOne('/practices').flush([]);
    harness.detectChanges();

    // Un vacío legítimo, no un fallo: no se pide el árbol de nada.
    expect(harness.routeNativeElement?.textContent).toContain(
      'todavía no tiene ninguna organización médica dada de alta',
    );
  });

  it('avisa de la documentación por vencer con datos ya calculados por el servidor', () => {
    cargar(
      consola({
        legalDocuments: [
          {
            id: 'doc-1',
            siteId: null,
            type: CONCEPTO('ACCRED_TYPE_ISO', 'Licencia de funcionamiento'),
            number: 'LF-9001',
            issuerName: 'Municipio',
            evidenceFileId: null,
            validFrom: '2025-01-01',
            validTo: '2026-08-20',
            daysToExpiry: 5,
            verificationStatus: CONCEPTO('ACCRED_VERIFIED', 'Verificada'),
          },
          {
            id: 'doc-2',
            siteId: null,
            type: CONCEPTO('ACCRED_TYPE_ISO', 'Registro sanitario'),
            number: null,
            issuerName: null,
            evidenceFileId: null,
            validFrom: null,
            validTo: '2027-01-01',
            daysToExpiry: 400,
            verificationStatus: CONCEPTO('ACCRED_VERIFIED', 'Verificada'),
          },
        ],
      }),
    );

    // Sólo el que vence dentro del mes: el otro está en la tabla y no en el aviso.
    expect(componente['documentosPorVencer']()).toHaveLength(1);
  });

  it('traduce los días a vencimiento en palabras, no en una cifra con signo', () => {
    cargar();

    expect(componente['vencimientoEnPalabras'](-14)).toBe('vencido hace 14 días');
    expect(componente['vencimientoEnPalabras'](-1)).toBe('vencido hace 1 día');
    expect(componente['vencimientoEnPalabras'](0)).toBe('vence hoy');
    expect(componente['vencimientoEnPalabras'](1)).toBe('vence en 1 día');
    expect(componente['vencimientoEnPalabras'](null)).toBe('sin vencimiento declarado');
  });

  it('pinta el vencimiento con la severidad que corresponde', () => {
    cargar();

    expect(componente['varianteDeVencimiento'](-1)).toBe('error');
    expect(componente['varianteDeVencimiento'](10)).toBe('warning');
    expect(componente['varianteDeVencimiento'](400)).toBe('success');
    expect(componente['varianteDeVencimiento'](null)).toBe('info');
  });

  it('resuelve el nombre de la sede que las otras pestañas devuelven como uuid', () => {
    cargar(
      consola({
        sites: [
          {
            id: 'sede-1',
            code: 'S1',
            name: 'Sede Central',
            type: CONCEPTO('SITE_TYPE_HOSPITAL', 'Hospital'),
            physicalType: null,
            operationalStatus: null,
            status: CONCEPTO('SITE_ACTIVE', 'Activa'),
            timeZone: null,
            branchId: null,
            clinicalUnitCount: 1,
            careSpaceCount: 0,
          },
        ],
        careSpaces: [
          {
            id: 'esp-1',
            siteId: 'sede-1',
            clinicalUnitId: null,
            parentSpaceId: null,
            code: 'Q1',
            name: 'Quirófano 1',
            type: CONCEPTO('SPACE_TYPE_ROOM', 'Sala'),
            capacity: 1,
            operationalStatus: CONCEPTO('SPACE_OP_AVAILABLE', 'Disponible'),
            status: CONCEPTO('SPACE_ACTIVE', 'Activo'),
          },
        ],
      }),
    );

    expect(componente['sedeDe']('sede-1')).toBe('Sede Central');
    // Un uuid que no está entre las sedes cargadas devuelve `null`, y la
    // plantilla lo dice: nunca se muestra el identificador crudo.
    expect(componente['sedeDe']('sede-inexistente')).toBeNull();
    expect(componente['sedeDe'](null)).toBeNull();
  });

  it('cada pestaña vacía trae su propio mensaje y su propia salida', () => {
    cargar();

    const sedes = componente['sedes']();
    const plantilla = componente['plantilla']();
    expect(sedes.status).toBe('empty');
    expect(plantilla.status).toBe('empty');
    // El contrato del M34 exige acción en el vacío, y «no hay sedes» y «no hay
    // plantilla» no se resuelven con el mismo paso.
    if (sedes.status === 'empty' && plantilla.status === 'empty') {
      expect(sedes.nextAction.label).not.toBe(plantilla.nextAction.label);
    }
  });

  it('un fallo del árbol no deja la pantalla muda y se puede reintentar', () => {
    http.expectOne('/practices').flush([PRACTICA]);
    harness.detectChanges();
    http
      .expectOne('/practices/prac-1/organization')
      .flush({ message: 'Falló' }, { status: 500, statusText: 'Server Error' });
    harness.detectChanges();

    expect(componente['consola']().status).toBe('error');

    componente['recargar']();
    http.expectOne('/practices/prac-1/organization').flush(consola());
    harness.detectChanges();

    expect(componente['consola']().status).toBe('ready');
  });

  /* -- La pestaña absorbida (2026-09-10) ------------------------------------ */

  it('«Mis vinculaciones» es la última pestaña, y el índice constante apunta a ella', async () => {
    // El índice vive en una constante (`PESTANA_VINCULACIONES`) porque lo usan
    // el aterrizaje del login y el `?tab=memberships`. La primera vez apuntó a
    // «Inventario»: la pestaña se había insertado antes y nadie lo notó hasta
    // ver la foto. Esto lo impide.
    cargar();

    const rotulos = Array.from(
      harness.routeNativeElement!.querySelectorAll('[role="tab"]'),
    ).map((t) => t.textContent?.trim());

    expect(rotulos.at(-1)).toBe('Mis vinculaciones');
    expect(componente['pestanaDeVinculaciones']).toBe(rotulos.length - 1);
  });

  it('con ?tab=memberships abre esa pestaña, no la primera', async () => {
    // Es el aterrizaje de quien entra sin ninguna organización: sin esto caería
    // en «Sedes», siete tablas vacías de una organización que no tiene.
    //
    // Se resuelve primero lo que dejó pendiente el `beforeEach`: navegar de
    // nuevo sin hacerlo deja dos `/practices` en vuelo y el fallo se lee como
    // si lo causara la pestaña.
    cargar();

    await harness.navigateByUrl(`${RUTA}?tab=memberships`);
    harness.detectChanges();

    // Angular **reutiliza** el componente cuando sólo cambia la query, así que
    // esto además comprueba que la pestaña se recalcula sin volver a construir.
    const activa = harness.routeNativeElement!.querySelector('[role="tab"][aria-selected="true"]');
    expect(activa?.textContent?.trim()).toBe('Mis vinculaciones');

    // Al abrirse, la pestaña monta «Mis vinculaciones», que pide lo suyo: la
    // lista de organizaciones para el selector y las vinculaciones propias.
    // Que aparezcan **acá y no antes** es la prueba de que el contenido de una
    // pestaña cerrada no se instancia — que es lo que evita pedir `/practices`
    // dos veces en cada visita al panel.
    http.expectOne('/practices').flush([PRACTICA]);
    http.expectOne('/practitioners/me/role-assignments').flush([]);
  });
});
