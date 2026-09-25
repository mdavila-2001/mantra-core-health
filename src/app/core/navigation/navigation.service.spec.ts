import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { SessionStore } from '../auth/session.store';
import { NavigationService } from './navigation.service';

/**
 * Lo que se fija acá es el contrato del armazón: **qué se ofrece según quién
 * entró** y **dónde dice la interfaz que estás parado**. Las dos cosas salen
 * del mismo registro, así que una prueba que las viera divergir es la señal de
 * que alguien duplicó la lista.
 */
@Component({ template: '' })
class Vacio {}

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

describe('NavigationService', () => {
  let service: NavigationService;
  let session: SessionStore;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Cualquier ruta pinta el mismo componente vacío: acá se prueba a dónde
        // se puede ir y cómo se llama, no qué se dibuja al llegar.
        provideRouter([{ path: '**', component: Vacio }]),
      ],
    });

    service = TestBed.inject(NavigationService);
    session = TestBed.inject(SessionStore);
    router = TestBed.inject(Router);
  });

  /**
   * Abre una sesión con esos roles y esas organizaciones.
   *
   * Los `tenants` importan tanto como los roles desde F-31: hay secciones cuyo
   * permiso real es una **membresía** y no un rol del token, y se filtran por
   * este claim. Vacío = alguien que no pertenece a ninguna organización, que es
   * el caso del paciente.
   */
  function abrirSesion(roles: readonly string[], tenants: readonly string[] = ['t-1']) {
    session.start({ accessToken: jwt({ sub: 'u-1', roles, tenants }), refreshToken: 'r' });
  }

  /**
   * Todo lo que la barra ofrece, en el orden en que se dibuja: primero los dos
   * destinos fijos de arriba —«Mi perfil» y «Notificaciones», que desde el
   * 07/09/2026 salen sueltos y no cuelgan de «Mi cuenta»— y después los grupos.
   *
   * Los fijos entran acá y no en una prueba aparte porque lo que estas pruebas
   * fijan es **qué se le ofrece a cada sesión**, y eso no cambió al cambiar
   * dónde se dibuja cada cosa.
   */
  function rutasDelMenu(): readonly string[] {
    return [
      ...service.pinnedItems().map((item) => item.route),
      ...service.menu().flatMap((grupo) => grupo.items.map((item) => item.route)),
    ];
  }

  describe('los destinos fijos salen del grupo', () => {
    it('«Mi perfil» y «Notificaciones» van sueltos, y no dentro de «Mi cuenta»', () => {
      abrirSesion(['PRACTITIONER'], ['t-1']);

      expect(service.pinnedItems().map((i) => i.route)).toEqual([
        '/my-account',
        '/notification-center',
      ]);
      // Y no se cuentan dos veces: ningún grupo los vuelve a ofrecer.
      const enGrupos = service.menu().flatMap((g) => g.items.map((i) => i.route));
      expect(enGrupos).not.toContain('/my-account');
      expect(enGrupos).not.toContain('/notification-center');
    });

    it('al médico le desaparece «Mi cuenta», porque se queda sin secciones', () => {
      abrirSesion(['PRACTITIONER'], ['t-1']);

      expect(service.menu().map((g) => g.label)).not.toContain('Mi cuenta');
    });

    it('un destino fijo no nombra su grupo en la ruta de navegación', async () => {
      abrirSesion(['PRACTITIONER'], ['t-1']);
      await router.navigateByUrl('/my-account');

      // Dos escalones y no tres: el del medio sería «Mi cuenta», que en la
      // barra de esta sesión ni se dibuja.
      expect(service.breadcrumbs().map((b) => b.label)).toEqual(['Panel', 'Mi perfil']);
    });
  });

  describe('el menú se arma con los roles del token', () => {
    it('una sesión sin roles solo ve lo que no exige ninguno', () => {
      // Sin roles **y sin organización**: el paciente. «Tu organización» no
      // pide rol pero sí membresía (F-31), así que sin `tenants` no aparece.
      abrirSesion([], []);

      // Panel y autoservicio: lo que cualquiera puede hacer con su propia cuenta.
      // «Mis turnos» entra acá porque su filtro real es tener perfil de
      // paciente —un dato de la cuenta, no un rol—, y eso lo resuelve la
      // pantalla, no el menú.
      //
      // El directorio de laboratorios entra por una razón parecida: lo consulta
      // cualquiera que necesite un estudio, y no hay rol que exprese eso.
      //
      // La **Guía de profesionales** ya NO entra: desde la corrección #2 del
      // 15/08/2026 declara `roles: ['PATIENT']`, y una sesión sin roles no es
      // una sesión de paciente.
      expect(rutasDelMenu()).toEqual([
        // Los dos fijos, arriba de todo y fuera de su grupo.
        '/my-account',
        '/notification-center',
        '/dashboard',
        // Tutoriales y Chats YA NO entran acá (N-01, 2026-09-22): los dos
        // pasan a `fueraDelMenuPara: [ANY_ROLE]` — son un ícono con globo en
        // la cabecera para cualquier sesión, calcado de «Ajustes». Siguen sin
        // exigir rol y se siguen alcanzando por su ruta; lo que dejan de
        // hacer es ocupar un renglón de primer nivel, para cualquier cuenta.
        // Grupos y foros ya NO entra: desde el 18/08/2026 (recorrida de QA,
        // F-20) declara los roles de quien ejerce o administra — son foros
        // profesionales, y una sesión sin roles no es de nadie que ejerza.
        // La portada de directorios (FT-18, `roles: [ANY_ROLE]`) sí entra:
        // no exige rol, a diferencia de sus cuatro hijos específicos.
        //
        // **Y es la única del bloque que entra** (08/09/2026). Los cuatro
        // directorios —laboratorios, clínicas, farmacias y el de médicos—
        // siguen sin exigir rol y se siguen alcanzando; lo que dejaron de
        // hacer es ocupar un renglón, porque se entra por esta portada. Ojo
        // con leer esta lista como una pérdida de acceso: es la lista del
        // **menú**, y lo que se alcanza lo fija `visibleSections` — hay una
        // prueba dedicada más abajo.
        '/directories',
        // El glosario ya NO entra: desde el 18/08/2026 (feedback de la analista,
        // F-03) declara los roles de quien atiende, y una sesión sin roles no
        // es de nadie que atienda.
        //
        // «Mi perfil» tampoco aparece acá: desde el 07/09/2026 es un destino
        // fijo y se dibuja arriba de todo, fuera de «Mi cuenta». Sigue estando
        // —encabeza la lista—, sólo que ya no cuelga del grupo.
        // Los dependientes (B.1) tampoco exigen rol: el filtro real es tener
        // perfil de paciente, que no es un rol sino un dato de la cuenta, y la
        // pantalla lo dice cuando falta. Mismo criterio que «Mis citas».
        '/my-account/dependents',
        '/my-account/appointments',
        // El archivo clínico propio (carril 09), por lo mismo que «Mis turnos»:
        // el filtro real es tener perfil de paciente, y lo resuelve la pantalla.
        '/my-account/medical-record',
        // Los resultados propios no exigen rol por lo mismo que los turnos: el
        // filtro real es tener perfil de paciente, que es un dato de la cuenta.
        '/my-account/diagnostic-results',
        // Las órdenes propias entran por lo mismo que los resultados: son las
        // dos mitades del mismo circuito y ninguna exige rol — el filtro real
        // es tener perfil de paciente, que la pantalla resuelve.
        '/my-account/diagnostic-orders',
        '/my-account/cotizaciones',
        // Los cuestionarios propios tampoco exigen rol: el filtro real es tener
        // perfil de paciente, que es un dato de la cuenta y no un rol.
        '/my-account/questionnaires',
        // «Notificaciones» tampoco: es el otro destino fijo, y encabeza la
        // lista junto a «Mi perfil». La bandeja sigue sin exigir rol —es de la
        // persona y el backend sólo devuelve la propia—; lo que cambió es
        // dónde se dibuja.
        // «Preferencias de avisos» **no** entra: dejó de ser una sección y pasó
        // a ser un panel de Ajustes. Y Ajustes tampoco, aunque la ve cualquier
        // sesión: declara `fueraDelMenuPara: [ANY_ROLE]` porque se entra por el
        // ícono del encabezado — configurar no es un destino de trabajo.
        //
        // La verificación de identidad y su historial **no** entran: el
        // producto no la ofrece de momento y las dos secciones salieron del
        // menú con `fueraDelMenuPara: [ANY_ROLE]`. Se siguen alcanzando por su
        // ruta — ver `VERIFICACION_DE_IDENTIDAD_OFRECIDA`.
      ]);
    });

    it('un administrador de seguridad ve las secciones de administración', () => {
      abrirSesion(['SECURITY_ADMIN']);

      expect(rutasDelMenu()).toContain('/administration/users');
      expect(rutasDelMenu()).toContain('/administration/patients');
      // Carriles 13 y 16: las dos consolas de organización entran con el mismo
      // rol que el resto de la configuración.
      expect(rutasDelMenu()).toContain('/administration/medical-organization');
      expect(rutasDelMenu()).toContain('/administration/medical-laboratory');
    });

    it('la consola del laboratorio no se ofrece a quien sólo ejerce (C16)', () => {
      abrirSesion(['PRACTITIONER']);

      // Configurar precios de convenios y permisos de firma es administración,
      // no atención: el backend exige `SECURITY_ADMIN` y el menú no ofrece una
      // puerta que la API va a cerrar.
      expect(rutasDelMenu()).not.toContain('/administration/medical-laboratory');
    });

    it('el menú del médico son las opciones del cliente, el generador y la portada de directorios', () => {
      // §4.H del plan de UX del 22/08/2026. El cliente dio una lista **cerrada**
      // —«las opciones únicas que se requiere en el panel del doctor son…»— y el
      // menú tenía dieciséis entradas de primer nivel. Esta prueba es la lista,
      // en el orden en que se dibuja, y falla si alguien agrega la siguiente.
      //
      // **Los directorios ocupan UN renglón, no tres** (08/09/2026). Entraron
      // por la funcionalidad 9 (FT-09-R01, 04/09/2026) con aval explícito del
      // propietario —el pedido era «Directorio, Administración, Chats»— y
      // siguen siendo del médico: el de clínicas y el de farmacias se abren
      // desde la portada, y la prueba de abajo lo fija. Lo que cambió es que
      // la portada dejó de ser un desplegable con los tres adentro: era el
      // mismo destino ofrecido dos veces, una encima de la otra.
      //
      // Para la lista cerrada esto **descuenta** dos renglones de los trece,
      // que es la dirección correcta: §4.H existe para que el panel no crezca.
      //
      // **«Mis servicios» es la doceava, y entra por la funcionalidad 22
      // (FT-22, 04/09/2026), también con aval explícito.** Nació fuera del menú
      // cuando la pantalla era sólo lectura: llegar por «Tus accesos»
      // alcanzaba. Dejó de alcanzar el día que el precio se edita ahí — un
      // lugar donde se escribe no puede depender de que alguien recuerde la
      // ruta.
      //
      // **«Cotizaciones» es la treceava, por la funcionalidad 24 (FT-24).**
      // Cambio deliberado de esta misma tanda: cotizar es el paso que sigue a
      // «Mis servicios» —se arma la oferta concreta con su plan de pagos sobre
      // el precio que esa pantalla ya deja puesto— y, a diferencia de una
      // ficha (que cuelga sin entrada propia del listado del que depende), acá
      // el listado de cotizaciones sí es un destino al que se vuelve por su
      // cuenta para revisar lo ya ofrecido. Mismo razonamiento que le dio
      // renglón a «Mis servicios»: un lugar donde se arma una oferta con
      // dinero de por medio no puede depender de que alguien recuerde la
      // ruta. Quien agregue la catorceava sigue teniendo que discutirla.
      //
      // Lo que la decisión **no** toca: «Directorio de médicos» (`directory`)
      // sigue siendo exclusivo del paciente —corrección #2, fijada dos pruebas
      // más abajo— y «Administración» no entra, porque el médico no tiene
      // ninguna de sus secciones y mostrar un grupo vacío no es una función.
      //
      // **«Formularios» es la novena, y entra a propósito.** El generador del
      // doctor se pidió el 21/08 y llegó el 22 (PR #212), un día antes de esta
      // lista; es su única puerta, y sacarlo del menú habría dejado huérfana
      // una pantalla que el mismo cliente pidió. Las dos cosas son suyas: la
      // lista dice que el panel no se llena de renglones, no que se tire lo
      // encargado. Cualquier décima sí tiene que discutirse.
      //
      // La otra que apareció en el mismo merge, «Promociones» de la farmacia,
      // NO entra: cumplía `requiresTenant` porque el médico pertenece a su
      // clínica, no porque atienda un mostrador. Sale por `fueraDelMenuPara`,
      // y se sigue llegando por la ruta —lo fija la prueba de abajo—.
      //
      // **«Activos y pasivos» SALIÓ el 19/09/2026, y la lista bajó a diez —
      // y a nueve el 22/09/2026, cuando «Chats» pasó a la cabecera (N-01,
      // ver la nota de más abajo).**
      // Lo pidió el propietario con esas palabras: «esto debe estar integrado
      // en contabilidad (lo de activos y pasivos)». Es la dirección que §4.H
      // persigue —el panel no crece—, y además arregla un defecto propio de
      // esta lista: «Contabilidad» y «Activos y pasivos» eran dos renglones
      // seguidos, con el mismo ícono, que sólo se distinguen si uno ya sabe
      // que «activo» no es «gasto». Ahora es un bloque del resumen de
      // Contabilidad, y la pantalla de alta vive en
      // `administration/accounting/assets-liabilities` con los mismos roles.
      //
      // Bajar un renglón no afloja la regla: quien quiera agregar la
      // undécima la sigue teniendo que discutir.
      //
      // **«Chats» SALIÓ el 23/09/2026 (N-01), y la lista baja a nueve.** El
      // doctor pidió Chats y Tutoriales en la cabecera: Chats es ahora un
      // ícono con globo y no leídos al lado de la campana, y el renglón sobra.
      // La ruta sigue abierta (ver la prueba de N-01 más abajo).
      abrirSesion(['PRACTITIONER']);

      const fueraDeMiCuenta = service
        .menu()
        .filter((grupo) => grupo.label !== 'Mi cuenta')
        .flatMap((grupo) => grupo.items.map((item) => item.label));

      expect(fueraDeMiCuenta).toEqual([
        // «Chats» YA NO entra acá (N-01, 2026-09-22): pasa a un ícono con
        // globo en la cabecera, `fueraDelMenuPara: [ANY_ROLE]` — sigue
        // alcanzándose por `/messaging`, sólo que ya no ocupa un renglón.
        'Directorios',
        'Consultas médicas',
        'Archivo clínico',
        'Notas médicas',
        'Glosario',
        'Formularios',
        'Mis servicios',
        'Cotizaciones',
        'Contabilidad',
      ]);
    });

    it('el médico alcanza los directorios de lugares y, desde el 24/09, el de médicos', () => {
      // FT-09-R01. El pedido decía «Directorio» a secas y hay cuatro. Esta
      // prueba fija cuáles entraron y cuál no: si alguien lee la funcionalidad
      // 9 como «devolverle la Guía de profesionales», falla acá y no en
      // producción.
      //
      // **Se mide sobre `visibleSections` y no sobre el menú** desde el
      // 08/09/2026, y no es una rebaja: los cuatro directorios salieron del
      // menú para que se entre por la portada, así que preguntarle al menú
      // cuáles son del médico dejó de tener respuesta. Lo que FT-09-R01
      // decidió nunca fue un renglón —fue el acceso—, y acá es donde vive.
      abrirSesion(['PRACTITIONER']);

      const alcanzables = service.visibleSections().map((seccion) => `/${seccion.path}`);
      expect(alcanzables).toContain('/clinics-directory');
      expect(alcanzables).toContain('/pharmacies-directory');
      // Pedido del cliente del 24/09/2026: el médico también busca médicos.
      expect(alcanzables).toContain('/directory');
    });

    it('lo que sale del menú del médico NO le cierra la puerta', () => {
      // La distinción entera de `fueraDelMenuPara`: la organización médica, sus
      // encuestas y su bandeja de visitas dejaron de ocupar un renglón y siguen
      // siendo suyas — se llega por su ruta y por el enlace de otra pantalla.
      // Si esto se rompiera, una limpieza de menú habría sido una pérdida
      // silenciosa de acceso, que es justo lo que no puede pasar.
      abrirSesion(['PRACTITIONER']);

      const alcanzables = service.visibleSections().map((seccion) => `/${seccion.path}`);
      expect(alcanzables).toContain('/administration/medical-organization');
      expect(alcanzables).toContain('/questionnaires');
      expect(alcanzables).toContain('/lab-visits');
      expect(alcanzables).toContain('/dashboard');

      expect(alcanzables).toContain('/administration/pharmacy-campaigns');

      expect(rutasDelMenu()).not.toContain('/administration/medical-organization');
      expect(rutasDelMenu()).not.toContain('/administration/pharmacy-campaigns');
      expect(rutasDelMenu()).not.toContain('/questionnaires');
      expect(rutasDelMenu()).not.toContain('/lab-visits');
    });

    it('Tutoriales y Chats salen del menú de todos, y la puerta sigue abierta', () => {
      // N-01 · 2026-09-23 · acceso desde cabecera. Los dos pasaron al
      // encabezado (íconos con globo y nombre accesible, Chats con no leídos),
      // así que ningún rol tiene su renglón. Lo que no puede pasar es que la
      // limpieza del menú les cierre la ruta: los dos siguen sin exigir rol.
      const sesiones: [readonly string[], readonly string[]][] = [
        [[], []],
        [['PATIENT'], []],
        [['PRACTITIONER'], ['t-1']],
        [['SECURITY_ADMIN', 'CLINICIAN', 'BILLING', 'PATIENT'], ['t-1']],
      ];
      for (const [roles, tenants] of sesiones) {
        abrirSesion([...roles], [...tenants]);
        const alcanzables = service.visibleSections().map((seccion) => `/${seccion.path}`);
        expect(alcanzables, roles.join(',')).toContain('/tutorials');
        expect(alcanzables, roles.join(',')).toContain('/messaging');
        expect(rutasDelMenu(), roles.join(',')).not.toContain('/tutorials');
        expect(rutasDelMenu(), roles.join(',')).not.toContain('/messaging');
      }
    });

    it('el Directorio de médicos lo alcanzan el paciente y el médico, no quien administra', () => {
      // Corrección #2. La medición del carril 01 la encontró en el menú de la
      // doctora, que es exactamente lo que el cliente pidió sacar.
      //
      // **También se mudó a `visibleSections`** (08/09/2026): desde que los
      // cuatro directorios se abren por la portada, `/directory` no está en el
      // menú de NADIE, y una prueba que sólo mirara ahí pasaría en verde
      // aunque alguien le devolviera la pantalla al médico por descuido. Lo
      // que el cliente pidió —«no debe aparecer ni ser accesible para doctor u
      // otros roles»— es esto, y `exclusiveRoles` es quien lo cumple.
      abrirSesion(['PATIENT']);
      const delPaciente = service.visibleSections().map((seccion) => `/${seccion.path}`);
      expect(delPaciente).toContain('/directory');

      // Ampliada el 24/09/2026: el médico también (pedido del cliente).
      abrirSesion(['PRACTITIONER', 'CLINICIAN']);
      expect(service.visibleSections().map((seccion) => `/${seccion.path}`)).toContain('/directory');

      abrirSesion(['SECURITY_ADMIN']);
      expect(service.visibleSections().map((seccion) => `/${seccion.path}`)).not.toContain('/directory');
    });

    it('los cuatro directorios no ocupan renglón, y ninguno perdió la puerta', () => {
      // La otra mitad del cambio del 08/09/2026, y la que importa: sacar algo
      // del menú no puede ser sacárselo a nadie. El paciente es quien más
      // tiene que perder —es el único que ve los cuatro—, así que se mide con
      // él. La portada los ofrece a los cuatro; el menú, sólo a la portada.
      abrirSesion(['PATIENT']);

      const alcanzables = service.visibleSections().map((seccion) => `/${seccion.path}`);
      for (const ruta of [
        '/directory',
        '/laboratory-directory',
        '/clinics-directory',
        '/pharmacies-directory',
      ]) {
        expect(alcanzables, ruta).toContain(ruta);
        expect(rutasDelMenu(), ruta).not.toContain(ruta);
      }

      expect(rutasDelMenu()).toContain('/directories');
    });

    it('«Farmacia» sólo aparece en el menú del paciente, y «Mis pedidos» sigue alcanzable sin renglón propio', () => {
      // FAR-I2 + 24/09/2026: «Mis pedidos» y «Cotizaciones» del paciente se
      // absorbieron dentro de «Farmacia» (pestañas de `PharmacyHub`), así que
      // el renglón propio de «Mis pedidos» sale del menú (`fueraDelMenuPara`)
      // y lo reemplaza «Farmacia», que hereda su rol declarado — el pedido
      // nace de una receta propia, y la guardia lo exige en la sección.
      abrirSesion(['PATIENT']);
      expect(rutasDelMenu()).toContain('/my-account/pharmacy');
      expect(rutasDelMenu()).not.toContain('/my-account/pharmacy-orders');

      // La ruta sigue viva: el detalle, el checkout, el recibo y las
      // notificaciones vuelven a `/my-account/pharmacy-orders` sin pasar por
      // el menú.
      expect(service.visibleSections().map((s) => `/${s.path}`)).toContain(
        '/my-account/pharmacy-orders',
      );

      abrirSesion([]);
      expect(rutasDelMenu()).not.toContain('/my-account/pharmacy');

      abrirSesion(['PRACTITIONER', 'CLINICIAN']);
      expect(rutasDelMenu()).not.toContain('/my-account/pharmacy');
    });

    it('un rol clínico no ve administración, y un administrador no ve el archivo clínico', () => {
      abrirSesion(['CLINICIAN']);
      expect(rutasDelMenu()).toContain('/medical-records');
      expect(rutasDelMenu()).not.toContain('/administration/users');

      abrirSesion(['SECURITY_ADMIN']);
      expect(rutasDelMenu()).not.toContain('/medical-records');
    });

    it('no quedan grupos vacíos: un rótulo sin ítems anuncia lo que no se puede ver', () => {
      abrirSesion([], []);

      for (const grupo of service.menu()) {
        expect(grupo.items.length, grupo.label).toBeGreaterThan(0);
      }
      // «Atención» ya no aparece: su único ítem sin rol era el glosario, y desde
      // F-03 es de quien atiende. Para el paciente, sus cosas viven en «Mi cuenta».
      // «Administración» tampoco: su único ítem sin rol —«Tu organización»— pide
      // membresía desde F-31, y quien no pertenece a ninguna no ve el rótulo.
      expect(service.menu().map((g) => g.label)).toEqual(['General', 'Mi cuenta']);
    });

    it('con membresía pero sin rol global sí se ve «Tu organización»', () => {
      // El caso que F-31 no podía romper: la recepcionista. Su permiso es una
      // fila de `tenant_memberships`, no un rol del token — filtrar la sección
      // por `roles` la habría dejado afuera de la pantalla que es suya.
      abrirSesion([], ['t-1']);

      expect(rutasDelMenu()).toContain('/administration/my-organization');
      expect(service.menu().map((g) => g.label)).toContain('Administración');
    });

    it('sólo «Administración» sigue plegada; los otros cuatro dominios vienen aplanados', () => {
      // Lo que la barra necesita para no dibujar un contenedor (AC-E1-02). El
      // paciente llegaba a «Mis citas» abriendo dos desplegables que no llevan
      // a ninguna pantalla; aplanado, el dominio suelta sus destinos en la
      // barra y sigue ofreciendo exactamente los mismos. Desde el 13/09/2026
      // vale lo mismo para quien ejerce: «Atención» y «Facturación» son los dos
      // únicos dominios de trabajo que ve, y eran lo único que le hacían abrir.
      abrirSesion(['SECURITY_ADMIN', 'CLINICIAN', 'BILLING']);

      const aplanados = service
        .menu()
        .filter((grupo) => grupo.aplanado)
        .map((grupo) => grupo.label);

      expect(aplanados).toEqual(['General', 'Atención', 'Facturación', 'Mi cuenta']);
      // Aplanar no filtra: el grupo conserva su reparto en bloques, que es lo
      // que lo deja volver a plegarse sin recalcular nada.
      for (const grupo of service.menu()) {
        expect(grupo.blocks.length, grupo.label).toBeGreaterThan(0);
      }
    });

    it('quien ejerce no abre ningún dominio: su menú entero viene aplanado', () => {
      // El caso que motivó el pedido. El médico veía «Atención» y
      // «Facturación» plegadas y no veía «Administración», así que los dos
      // desplegables eran todo lo que su barra le ofrecía abrir.
      abrirSesion(['PRACTITIONER']);

      for (const grupo of service.menu()) {
        expect(grupo.aplanado, grupo.label).toBe(true);
      }

      // Y no perdió un destino en el camino: los que colgaban del desplegable
      // siguen ahí, ahora sueltos.
      expect(rutasDelMenu()).toContain('/schedule');
      expect(rutasDelMenu()).toContain('/medical-records');
    });

    it('los grupos salen en el orden declarado, no en el del registro', () => {
      abrirSesion(['SECURITY_ADMIN', 'CLINICIAN', 'BILLING']);

      expect(service.menu().map((g) => g.label)).toEqual([
        'General',
        'Atención',
        'Administración',
        'Facturación',
        'Mi cuenta',
      ]);
    });
  });

  /**
   * El segundo escalón del menú: dentro del dominio, los destinos se reparten
   * en bloques de cosas parecidas, que es lo que la barra dibuja plegable.
   *
   * Lo que estas pruebas cuidan es que el reparto sea **sólo** un reparto: la
   * misma lista de destinos ordenada de otra forma. Un bloque que se traga un
   * destino o que le cambia el orden al menú es un error mucho más difícil de
   * ver que uno que rompe la compilación.
   */
  describe('el reparto en bloques', () => {
    it('los bloques no agregan ni pierden destinos: son los mismos ítems', () => {
      abrirSesion(['SECURITY_ADMIN', 'CLINICIAN', 'BILLING', 'PATIENT'], ['t-1']);

      for (const grupo of service.menu()) {
        const enBloques = grupo.blocks.flatMap((bloque) => bloque.items.map((i) => i.route));

        // **Ordenados para comparar, y a propósito.** Repartir reordena: en
        // «General», «Grupos y foros» sube a juntarse con «Chats» en el bloque
        // de comunidad y adelanta a los directorios. Eso es lo que el reparto
        // hace, y exigir el orden plano acá sería prohibírselo. Lo que no puede
        // pasar —y es lo que esta prueba cuida— es que un destino se pierda por
        // el camino o aparezca dos veces.
        expect([...enBloques].sort(), grupo.label).toEqual([...grupo.items.map((i) => i.route)].sort());
      }
    });

    it('cada grupo y cada bloque llevan su ícono: la barra plegada no muestra otra cosa', () => {
      abrirSesion(['SECURITY_ADMIN'], ['t-1']);

      for (const grupo of service.menu()) {
        expect(grupo.icon, grupo.label).toBeTruthy();
        for (const bloque of grupo.blocks) {
          expect(bloque.icon, `${grupo.label}/${bloque.label}`).toBeTruthy();
          expect(bloque.items.length, `${grupo.label}/${bloque.label}`).toBeGreaterThan(0);
        }
      }
    });

    it('el bloque de directorios se queda con la portada, y el armazón la dibuja suelta', () => {
      // Hasta el 08/09/2026 este bloque traía los cinco y se dibujaba como
      // desplegable. Ahora los cuatro directorios declaran
      // `fueraDelMenuPara: [ANY_ROLE]` y queda sólo la portada: un bloque de
      // uno, que `shell-layout.html` dibuja como renglón suelto. Es el cambio
      // entero, visto desde donde se decide — apretar «Directorios» lleva a la
      // pantalla que deja elegir, en vez de abrir una lista que ofrecía lo
      // mismo un clic antes.
      abrirSesion(['PATIENT']);

      const general = service.menu().find((grupo) => grupo.label === 'General');
      const directorios = general?.blocks.find((bloque) => bloque.label === 'Directorios');

      expect(directorios?.items.map((item) => item.route)).toEqual(['/directories']);
    });

    it('el bloque se dibuja donde está su primera sección visible, no donde se declaró', () => {
      // Quien ejerce no ve ni el panel ni los tutoriales, así que «Inicio» no
      // existe para él. Hasta el 21/09/2026 «Comunidad» pasaba a ser el primer
      // bloque de General (le quedaba «Chats»). Desde N-01 (22/09/2026) «Chats»
      // pasa a la cabecera para cualquier sesión (`fueraDelMenuPara:
      // [ANY_ROLE]`), y «Grupos y foros» ya excluía a `PRACTITIONER` — así que
      // «Comunidad» se queda sin ningún renglón visible para este rol y no se
      // dibuja. El primer bloque que le queda a General es «Directorios». El
      // orden sigue sin recalcularse ni reordenarse: sale del registro,
      // filtrado.
      abrirSesion(['PRACTITIONER']);

      const general = service.menu().find((grupo) => grupo.label === 'General');
      expect(general?.blocks[0]?.label).toBe('Directorios');
    });

    it('un bloque sólo trae lo que la sesión puede ver', () => {
      // El filtrado dentro de un bloque, que es el motivo de existir de esta
      // prueba. Se demostraba con los directorios hasta el 08/09/2026; desde
      // que los cuatro se abren por la portada, ese bloque tiene un solo
      // renglón para todo el mundo y dejó de poder mostrar nada. «Formularios
      // y referencia» ocupa su lugar: declara cinco secciones y quien ejerce
      // ve cuatro — «Mis cuestionarios» sale por la lista cerrada de §4.H.
      abrirSesion(['PRACTITIONER']);

      const atencion = service.menu().find((grupo) => grupo.label === 'Atención');
      const formularios = atencion?.blocks.find((bloque) => bloque.label === 'Formularios y referencia');

      expect(formularios?.items.map((item) => item.route)).toEqual([
        '/glossary',
        '/form-builder',
        '/my-services',
        '/my-quotations',
      ]);
    });

    it('un bloque de un solo renglón sigue existiendo, y el armazón lo dibuja suelto', () => {
      // Es la otra mitad de lo de arriba, que se demostraba con los directorios
      // cuando al médico le quedaba uno solo. «Comunidad» ocupaba ese lugar
      // con PRACTITIONER hasta el 21/09/2026: de sus dos destinos, quien
      // ejerce veía Chats —«Grupos y foros» declara los roles de quien ejerce
      // o administra desde F-20, pero no entraba en la lista cerrada del
      // panel del médico—.
      //
      // Desde N-01 (22/09/2026) «Chats» pasa a la cabecera para **cualquier**
      // sesión (`fueraDelMenuPara: [ANY_ROLE]`), así que con PRACTITIONER
      // «Comunidad» ya no tiene ningún renglón (el caso de arriba). El bloque
      // de un solo renglón sigue existiendo igual, sólo que ahora hace falta
      // un rol que vea «Grupos y foros» sin ver «Chats» en el menú —CLINICIAN
      // está en `ROLES_QUE_EJERCEN_O_ADMINISTRAN` y no en el
      // `fueraDelMenuPara` de `groups`, que sólo excluye a PRACTITIONER.
      abrirSesion(['CLINICIAN']);

      const general = service.menu().find((grupo) => grupo.label === 'General');
      const comunidad = general?.blocks.find((bloque) => bloque.label === 'Comunidad');

      expect(comunidad?.items.map((item) => item.route)).toEqual(['/groups']);
    });
  });

  describe('dónde estás parado', () => {
    it('fuera del armazón no hay sección ni ruta de navegación', async () => {
      await router.navigateByUrl('/design-system');

      expect(service.currentSection()).toBeNull();
      expect(service.breadcrumbs()).toEqual([]);
    });

    it('en el panel el breadcrumb es un solo escalón, y sin enlace: es donde estás', async () => {
      await router.navigateByUrl('/dashboard');

      expect(service.breadcrumbs()).toEqual([{ label: 'Panel' }]);
    });

    it('en una sección el breadcrumb dice de dónde venís, el dominio y dónde estás', async () => {
      await router.navigateByUrl('/administration/users');

      expect(service.breadcrumbs()).toEqual([
        { label: 'Panel', routerLink: '/dashboard' },
        // El dominio no es una pantalla: va sin enlace a propósito.
        { label: 'Administración' },
        { label: 'Usuarios' },
      ]);
    });

    it('una pantalla hija resuelve a su sección padre', async () => {
      // El alta todavía no existe, pero cuando exista no debe dejar el menú sin
      // marcar ni la pantalla sin ruta de navegación.
      await router.navigateByUrl('/administration/users/new');

      expect(service.currentSection()?.label).toBe('Usuarios');
    });

    it('gana la coincidencia más larga, no la primera que empareja', async () => {
      await router.navigateByUrl('/administration/patients');

      // `/administration/users` y `/administration/patients` comparten
      // prefijo: comparar de a segmentos completos es lo que evita que una
      // sección se coma a su vecina.
      expect(service.currentSection()?.label).toBe('Pacientes');
    });

    it('los parámetros de consulta no confunden a la sección', async () => {
      await router.navigateByUrl('/schedule?fecha=2026-08-04');

      // «Consultas» desde ALV-016 (antes «Turnos», §4.H del plan de UX):
      // la ruta sigue siendo `schedule`.
      expect(service.currentSection()?.label).toBe('Consultas médicas');
    });
  });
});
