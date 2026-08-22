import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { DirectoryClient } from '../../core/data-access/directory/directory.client';
import type {
  MembershipListItem,
  MyOrganization,
  PractitionerRequest,
  TenantAgendaItem,
} from '../../core/data-access/directory/directory.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Badge } from '../../shared/components/atoms/badge/badge';
import { Input } from '../../shared/components/atoms/input/input';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { Card } from '../../shared/components/molecules/card/card';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../shared/components/molecules/toast/toast.service';
import { FormActions } from '../../shared/components/organisms/form-actions/form-actions';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';

/**
 * El panel de la organización (TP-1).
 *
 * ## Por qué esta pantalla no existía
 *
 * Porque la organización era un **dato** y no alguien: el tenant al que
 * pertenecés, presente en cada tabla y en cada consulta, pero sin una sola
 * pantalla desde la cual mirarse a sí misma. Una clínica podía tener veinte
 * personas trabajando adentro y ninguna forma de ver quiénes eran, ni de
 * corregir su propio nombre.
 *
 * ## Cómo sabe de qué organización habla
 *
 * Preguntando: `GET /tenants/me` devuelve las organizaciones del actor con su
 * rol en cada una. Antes esto era imposible —toda lectura del directorio
 * empieza por un identificador, y el único lugar de donde sacarlo era la propia
 * ficha—, y por eso el panel no podía abrirse solo.
 *
 * Con más de una organización se ofrecen todas y la persona elige: hay quien
 * recepciona en dos clínicas del mismo grupo, y elegir por ella sería inventar
 * cuál es «la» suya.
 *
 * ## Por qué el permiso lo dice el servidor
 *
 * `canAdminister` viene en la respuesta. Deducirlo acá —mirando el concepto del
 * rol— daría dos definiciones de «admin de la organización», la de la API y la
 * del front, y se separarían en cuanto una de las dos cambie. Acá sirve sólo
 * para no ofrecer botones que van a fallar: quien administra de verdad lo
 * vuelve a decidir la API en cada escritura.
 *
 * ## El lenguaje
 *
 * «Tu organización», nunca «tenant». La palabra es del modelo de datos y no
 * significa nada para quien la administra.
 */
@Component({
  selector: 'app-organization-panel',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
    DatePipe,
    FormsModule,
    EmptyState,
    FormActions,
    FormField,
    Input,
    PageHeader,
    ViewStateHost,
  ],
  templateUrl: './organization-panel.html',
  styleUrl: './organization-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationPanel {
  private readonly directory = inject(DirectoryClient);
  private readonly toasts = inject(ToastService);

  protected readonly organizaciones = signal<ViewState<readonly MyOrganization[]>>(loading());

  /** Cuál se está mirando. `null` mientras carga o si no hay ninguna. */
  protected readonly elegidaId = signal<string | null>(null);

  protected readonly lista = computed<readonly MyOrganization[]>(() => {
    const estado = this.organizaciones();
    return estado.status === 'ready' ? estado.data : [];
  });

  protected readonly elegida = computed<MyOrganization | null>(() => {
    const id = this.elegidaId();
    return this.lista().find((org) => org.id === id) ?? null;
  });

  /** Hay más de una: la pantalla ofrece elegir. */
  protected readonly hayVarias = computed(() => this.lista().length > 1);

  protected readonly puedeAdministrar = computed(() => this.elegida()?.canAdminister === true);

  /**
   * Sin aprobar no aparece en el directorio público, y conviene decirlo.
   *
   * La respuesta trae `isVerified` ya resuelto porque el estado viaja como
   * concepto —un uuid— y el front no tiene forma de saber cuál de todos
   * significa «verificada» sin atarse a un identificador sembrado.
   */
  protected readonly estaVerificada = computed(() => this.elegida()?.isVerified === true);

  /**
   * Es una aseguradora. La señal es la presencia del bloque `payer` en la
   * lectura, **no** decodificar `tenantTypeConceptId`: mismo principio que
   * `estaVerificada` con `isVerified` ya resuelto por la API.
   */
  protected readonly esAseguradora = computed(() => this.elegida()?.payer !== undefined);

  /* -- Datos de la organización -------------------------------------------- */

  protected readonly razonSocial = signal('');
  protected readonly nombreComercial = signal('');
  protected readonly zonaHoraria = signal('');
  protected readonly guardando = signal(false);

  /* -- Datos de aseguradora, sólo si `esAseguradora()` -------------------- */

  protected readonly sigla = signal('');
  protected readonly nit = signal('');
  protected readonly direccion = signal('');

  /* -- Su gente ------------------------------------------------------------- */

  protected readonly gente = signal<ViewState<readonly MembershipListItem[]>>(loading());

  /**
   * Su gente ya resuelta, para que la plantilla no tenga que abrir el estado.
   *
   * `ViewState` es una unión y no todas sus ramas tienen datos; desenvolverla
   * en el HTML obliga a comprobar la variante dentro de la plantilla, que es
   * donde peor se lee.
   */
  protected readonly personas = computed<readonly MembershipListItem[]>(() => {
    const estado = this.gente();
    return estado.status === 'ready' ? estado.data : [];
  });

  constructor() {
    this.cargar();
  }

  protected recargar(): void {
    this.cargar();
  }

  /** Cambiar de organización recarga lo que depende de ella, y sólo eso. */
  protected elegir(tenantId: string): void {
    if (tenantId === this.elegidaId()) return;
    this.elegidaId.set(tenantId);
    const org = this.lista().find((candidata) => candidata.id === tenantId);
    if (org) this.sembrarFormulario(org);
    this.cargarGente(tenantId);
    this.cargarSolicitudes(tenantId);
    this.cargarAgendaDelDia();
  }

  protected guardarDatos(): void {
    const org = this.elegida();
    if (!org || this.guardando()) return;

    this.guardando.set(true);
    this.directory
      .updateOrganization(org.id, {
        legalName: this.razonSocial().trim(),
        tradeName: this.nombreComercial().trim(),
        timeZone: this.zonaHoraria().trim() || undefined,
        // Sólo para aseguradoras: el backend rechaza el bloque `payer` en
        // cualquier otro tipo. `carrierCode` no va acá: es de sólo lectura,
        // esta pantalla no lo edita.
        ...(this.esAseguradora()
          ? {
              payer: {
                sigla: this.sigla().trim(),
                address: this.direccion().trim(),
                regulatorIdentifier: this.nit().trim(),
              },
            }
          : {}),
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.toasts.success('Los datos de tu organización quedaron guardados.');
          // Se recarga la lista y no sólo la ficha: el nombre que se acaba de
          // cambiar es el que rotula el selector de arriba.
          this.cargar();
        },
        error: () => {
          this.guardando.set(false);
          this.toasts.error('No se pudieron guardar los datos. Probá de nuevo.');
        },
      });
  }

  private cargar(): void {
    this.organizaciones.set(loading());
    this.directory.listMyOrganizations().subscribe({
      next: (items) => {
        this.organizaciones.set(ready(items));

        // Se mantiene la elegida si sigue estando; si no, la primera. Cambiar
        // de organización sola después de guardar sería desconcertante.
        const sigue = items.some((org) => org.id === this.elegidaId());
        const destino = sigue ? this.elegidaId() : (items[0]?.id ?? null);
        this.elegidaId.set(destino);

        const org = items.find((candidata) => candidata.id === destino);
        if (org) {
          this.sembrarFormulario(org);
          this.cargarGente(org.id);
          this.cargarSolicitudes(org.id);
          this.cargarAgendaDelDia();
        }
      },
      error: (error: unknown) =>
        this.organizaciones.set(errorToViewState<readonly MyOrganization[]>(error)),
    });
  }

  /* -- Solicitudes de médicos (TP-2) ---------------------------------------- */

  protected readonly solicitudes = signal<ViewState<readonly PractitionerRequest[]>>(loading());

  protected readonly pedidos = computed<readonly PractitionerRequest[]>(() => {
    const estado = this.solicitudes();
    return estado.status === 'ready' ? estado.data : [];
  });

  /**
   * Cuál se está decidiendo, para deshabilitar sus dos botones a la vez.
   *
   * Se guarda el id y no un booleano global: con un booleano, aprobar una
   * solicitud deshabilitaría los botones de todas, y quien tiene diez en la
   * bandeja vería la pantalla congelarse entera por cada decisión.
   */
  protected readonly decidiendo = signal<string | null>(null);

  /** La organización acepta el vínculo. */
  protected aprobar(solicitud: PractitionerRequest): void {
    this.decidir(solicitud, true);
  }

  /** La organización lo rechaza. */
  protected rechazar(solicitud: PractitionerRequest): void {
    this.decidir(solicitud, false);
  }

  private decidir(solicitud: PractitionerRequest, acepta: boolean): void {
    const org = this.elegida();
    if (!org || this.decidiendo() !== null) return;

    this.decidiendo.set(solicitud.id);
    const decision = acepta
      ? this.directory.approvePractitionerRequest(org.id, solicitud.id)
      : this.directory.rejectPractitionerRequest(org.id, solicitud.id);

    decision.subscribe({
      next: () => {
        this.decidiendo.set(null);
        this.toasts.success(
          acepta
            ? 'El profesional ya forma parte de tu organización.'
            : 'La solicitud quedó rechazada.',
        );
        // Se recarga la bandeja en vez de sacar la fila a mano: si alguien más
        // decidió otra solicitud mientras tanto, sacarla localmente dejaría la
        // pantalla mostrando algo que ya no está.
        this.cargarSolicitudes(org.id);
      },
      error: () => {
        this.decidiendo.set(null);
        this.toasts.error('No se pudo registrar la decisión. Probá de nuevo.');
      },
    });
  }

  private cargarSolicitudes(tenantId: string): void {
    this.solicitudes.set(loading());
    this.directory.listPractitionerRequests(tenantId).subscribe({
      next: (items) => this.solicitudes.set(ready(items)),
      error: (error: unknown) =>
        this.solicitudes.set(errorToViewState<readonly PractitionerRequest[]>(error)),
    });
  }

  /* -- La agenda de la organización (TP-5) ---------------------------------- */

  protected readonly agenda = signal<ViewState<readonly TenantAgendaItem[]>>(loading());

  /** Qué día se está mirando, en días desde hoy. */
  protected readonly dia = signal(0);

  /** Filtro rápido por nombre de paciente: «¿a qué hora viene X hoy?». */
  protected readonly buscaPaciente = signal('');

  /** Acotar a un profesional. Vacío = todos los de la organización. */
  protected readonly filtroMedico = signal('');

  protected readonly fechaVisible = computed(() => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + this.dia());
  });

  private readonly citas = computed<readonly TenantAgendaItem[]>(() => {
    const estado = this.agenda();
    return estado.status === 'ready' ? estado.data : [];
  });

  /**
   * Las citas que se muestran, ya filtradas por nombre.
   *
   * El filtro por paciente es del lado del cliente y no una consulta más: la
   * pregunta real de una recepción es «¿a qué hora viene X **hoy**?», y el día
   * entero ya está cargado. Ir al servidor por cada tecla sería pedir de nuevo
   * lo que ya está en la pantalla.
   */
  protected readonly citasVisibles = computed<readonly TenantAgendaItem[]>(() => {
    const busca = this.buscaPaciente().trim().toLocaleLowerCase();
    if (busca === '') return this.citas();
    return this.citas().filter((cita) =>
      (cita.patientName ?? '').toLocaleLowerCase().includes(busca),
    );
  });

  /** Se buscó a alguien y no está en el día: distinto de «no hay citas». */
  protected readonly sinCoincidencias = computed(
    () =>
      this.citas().length > 0 &&
      this.citasVisibles().length === 0 &&
      this.buscaPaciente().trim() !== '',
  );

  protected diaAnterior(): void {
    this.dia.update((n) => n - 1);
    this.cargarAgendaDelDia();
  }

  protected diaSiguiente(): void {
    this.dia.update((n) => n + 1);
    this.cargarAgendaDelDia();
  }

  /** Cambiar el médico recarga: el filtro lo aplica el servidor. */
  protected filtrarPorMedico(profileId: string): void {
    this.filtroMedico.set(profileId);
    this.cargarAgendaDelDia();
  }

  protected cargarAgendaDelDia(): void {
    const org = this.elegida();
    if (!org) return;

    const desde = this.fechaVisible();
    const hasta = new Date(desde.getTime() + 24 * 60 * 60 * 1000);
    const medico = this.filtroMedico().trim();

    this.agenda.set(loading());
    this.directory
      .getTenantAgenda(org.id, {
        from: desde,
        to: hasta,
        ...(medico === '' ? {} : { practitionerProfileId: medico }),
      })
      .subscribe({
        next: (pagina) => this.agenda.set(ready(pagina.items)),
        error: (error: unknown) =>
          this.agenda.set(errorToViewState<readonly TenantAgendaItem[]>(error)),
      });
  }

  /**
   * Llena el formulario con lo que ya está guardado.
   *
   * Sólo al cargar y al cambiar de organización: si se sembrara en cada
   * revalidación, escribir en un campo mientras la pantalla refresca perdería
   * lo que la persona acaba de teclear.
   */
  private sembrarFormulario(org: MyOrganization): void {
    this.razonSocial.set(org.legalName);
    this.nombreComercial.set(org.tradeName ?? '');
    this.zonaHoraria.set(org.timeZone ?? '');

    if (org.payer) {
      this.sigla.set(org.payer.sigla);
      this.nit.set(org.payer.regulatorIdentifier);
      this.direccion.set(org.payer.address);
    }
  }

  private cargarGente(tenantId: string): void {
    this.gente.set(loading());
    this.directory.listMemberships(tenantId).subscribe({
      next: (pagina) => this.gente.set(ready(pagina.items)),
      error: (error: unknown) =>
        this.gente.set(errorToViewState<readonly MembershipListItem[]>(error)),
    });
  }
}
