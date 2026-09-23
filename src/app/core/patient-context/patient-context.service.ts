import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { AuthService } from '../auth/auth.service';
import { ProfilesClient } from '../data-access/profiles/profiles.client';
import type { Dependent } from '../data-access/profiles/profiles.types';

/**
 * Por quién está operando el titular ahora mismo.
 *
 * ## Qué problema resuelve
 *
 * Hasta acá «el paciente» era una constante: el `pid` del token, leído una vez
 * al construir cada pantalla. Con dependientes deja de serlo — la misma sesión
 * pide turno para su hijo y después mira los suyos —, así que hace falta un
 * lugar donde viva esa elección y del que las pantallas puedan colgarse.
 *
 * Es el mismo patrón que `SessionStore` ya usa para la organización activa: una
 * señal con lo elegido y un computado que cae al valor por defecto cuando no
 * hay elección.
 *
 * ## Lo que NO hace
 *
 * **No autoriza.** Elegir a un dependiente acá no habilita nada: quien decide
 * es la API, que exige apoderamiento vigente y responde 403 si no lo hay.
 * Mostrar u ocultar un nombre en un desplegable no es seguridad.
 *
 * Tampoco persiste. La elección dura lo que la pestaña, igual que la sesión: si
 * quedara guardada, alguien que vuelve al día siguiente abriría el portal
 * operando por otra persona sin haberlo pedido.
 */
@Injectable({
  providedIn: 'root',
})
export class PatientContextService {
  private readonly auth = inject(AuthService);
  private readonly profiles = inject(ProfilesClient);
  private readonly platformId = inject(PLATFORM_ID);

  /** Los dependientes cargados, o `null` mientras no se pidieron. */
  private readonly dependientes = signal<readonly Dependent[] | null>(null);

  /** A quién eligió el titular; `null` es «a mí mismo». */
  private readonly elegido = signal<string | null>(null);

  /** Si la carga está en curso, para que la pantalla pueda decirlo. */
  private readonly cargando = signal(false);

  /** Los dependientes del titular; vacío mientras no se cargaron. */
  readonly dependents = computed<readonly Dependent[]>(() => this.dependientes() ?? []);

  /** Si hay una carga en curso. */
  readonly loading = this.cargando.asReadonly();

  /** Si ya se preguntó por los dependientes al menos una vez. */
  readonly loaded = computed(() => this.dependientes() !== null);

  /**
   * El perfil de paciente sobre el que operan las pantallas.
   *
   * El elegido, o el propio del token. Es lo que tienen que consumir las citas,
   * la historia clínica y la reserva: leer `auth.patientProfileId()` directo
   * deja la pantalla sorda a la conmutación.
   */
  readonly activePatientProfileId = computed<string | null>(
    () => this.elegido() ?? this.auth.patientProfileId(),
  );

  /** El dependiente activo, o `null` si el titular opera por sí mismo. */
  readonly activeDependent = computed<Dependent | null>(() => {
    const elegido = this.elegido();
    if (elegido === null) return null;
    return this.dependents().find((d) => d.patientProfileId === elegido) ?? null;
  });

  /** Si se está operando en representación de otra persona. */
  readonly isActingForDependent = computed(() => this.activeDependent() !== null);

  /**
   * El nombre de quien está siendo atendido, para el rótulo de la cabecera.
   *
   * El del dependiente, o el del titular. Nunca vacío mientras haya sesión.
   */
  readonly activePatientName = computed<string | null>(
    () => this.activeDependent()?.fullName ?? this.auth.displayName(),
  );

  constructor() {
    // La elección se descarta al cambiar de cuenta. `SessionStore` no expone un
    // gancho de cierre de sesión, así que se vigila el usuario: sin esto, quien
    // cierra sesión y entra con otra cuenta seguiría con el dependiente de la
    // anterior elegido —y con su nombre en la cabecera—.
    let ultimo: string | null = null;
    effect(() => {
      const usuario = this.auth.userId();
      if (usuario !== ultimo) {
        ultimo = usuario;
        this.elegido.set(null);
        this.dependientes.set(null);
      }
    });
  }

  /**
   * Pide los dependientes del titular.
   *
   * No hace nada bajo SSR ni en una cuenta sin perfil de paciente: quien
   * atiende no tiene dependientes que listar, y pedirlos igual sería una
   * llamada segura de fallar en cada render del servidor.
   *
   * Un fallo deja la lista vacía y no rompe la pantalla: el conmutador es una
   * comodidad, y sin él el titular sigue operando por sí mismo.
   */
  loadDependents(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.auth.patientProfileId() === null) return;
    if (this.cargando()) return;

    this.cargando.set(true);
    this.profiles.listOwnDependents().subscribe({
      next: (dependientes) => {
        this.dependientes.set(dependientes);
        this.cargando.set(false);
        // Si el elegido ya no está —lo revocaron, o cambió la sesión—, se
        // vuelve al titular en vez de quedar operando por un id fantasma.
        const elegido = this.elegido();
        if (elegido !== null && !dependientes.some((d) => d.patientProfileId === elegido)) {
          this.elegido.set(null);
        }
      },
      error: () => {
        this.dependientes.set([]);
        this.cargando.set(false);
      },
    });
  }

  /**
   * Pasa a operar por ese dependiente.
   *
   * Sólo acepta a alguien de la lista cargada: un identificador que no está no
   * cambia nada. No es una barrera de seguridad —la API tiene la suya—, es no
   * dejar la interfaz en un estado que no puede explicar.
   *
   * @param patientProfileId - El dependiente elegido.
   */
  selectPatient(patientProfileId: string): void {
    if (!this.dependents().some((d) => d.patientProfileId === patientProfileId)) return;
    this.elegido.set(patientProfileId);
  }

  /** Vuelve a operar por uno mismo. */
  resetToSelf(): void {
    this.elegido.set(null);
  }

  /**
   * Suma un dependiente recién registrado y pasa a operar por él.
   *
   * Es lo que hace el alta al terminar: quien acaba de registrar a su hijo
   * quiere pedirle turno, no volver a buscarlo en una lista. Evita además una
   * segunda llamada para leer lo que la respuesta del alta ya trajo.
   *
   * @param dependiente - El que devolvió el alta.
   */
  addDependent(dependiente: Dependent): void {
    this.dependientes.set([dependiente, ...this.dependents()]);
  }
}
