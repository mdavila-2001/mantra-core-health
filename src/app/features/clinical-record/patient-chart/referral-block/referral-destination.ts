import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { map, of, shareReplay, type Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { DirectoryClient } from '../../../../core/data-access/directory/directory.client';
import type { BranchListItem } from '../../../../core/data-access/directory/directory.types';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import type { PractitionerListItem } from '../../../../core/data-access/profiles/profiles.types';
import { REFERRAL_LIMITS } from '../../../../core/data-access/referrals/referrals.types';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../../shared/components/molecules/radio-group/radio-group';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';

/** A qué clase de destino se deriva. */
export type ModoDeDestino = 'PROFESIONAL' | 'ORGANIZACION' | 'EXTERNO';

const MODOS: readonly ModoDeDestino[] = ['PROFESIONAL', 'ORGANIZACION', 'EXTERNO'];

/** Lo elegido como destino, con lo que hace falta para pintarlo otra vez. */
export interface DestinoElegido {
  readonly modo: ModoDeDestino | null;
  readonly profileId?: string;
  readonly profileOpcion?: ReferenceOption;
  readonly tenantId?: string;
  readonly tenantOpcion?: ReferenceOption;
  readonly branchId?: string;
  readonly nombre?: string;
  readonly contacto?: string;
}

/** Cuántos profesionales se traen de la guía para filtrar al escribir. */
const TOPE_DE_LA_GUIA = 100;

/**
 * **El destino de una derivación**: un profesional, una organización (y su
 * sede) de la plataforma, o alguien de fuera.
 *
 * ## Tres opciones, tres radios; cada una muestra sólo lo suyo
 *
 * Son tres y excluyentes en la cabeza de quien deriva, así que van como radios
 * y no como desplegable. Elegido uno, aparecen sólo sus campos: el contacto
 * externo no tiene sentido si se eligió una clínica de la plataforma.
 *
 * ## Buscadores, no listas
 *
 * Profesionales y organizaciones son listas largas: se escribe y se elige
 * (`app-reference-combobox`, que guarda el uuid y nunca lo muestra). Las sedes
 * de la organización elegida son pocas y van en un desplegable.
 *
 * La guía de profesionales (`GET /profiles/practitioners`) no busca por texto
 * en la API viva: se trae una página y se filtra acá. Organizaciones sí busca
 * (`GET /admin/tenants?q=`). Si alguna búsqueda falla —por rol, por red— el
 * buscador lo dice y queda el destino externo como salida.
 */
@Component({
  selector: 'app-referral-destination',
  imports: [FormField, Input, Radio, RadioGroup, ReferenceCombobox, Select],
  templateUrl: './referral-destination.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DestinoDeDerivacion {
  private readonly profiles = inject(ProfilesClient);
  private readonly directory = inject(DirectoryClient);

  readonly destino = model.required<DestinoElegido>();
  /** El error del destino, ya en palabras, o vacío. */
  readonly error = input('');
  readonly errorDelNombre = input('');
  readonly errorDelContacto = input('');
  /** Se salió de uno de los campos del destino. */
  readonly tocado = output<'destino' | 'targetExternalName' | 'targetExternalContact'>();

  protected readonly limites = REFERRAL_LIMITS;

  /* -- Profesionales ------------------------------------------------------- */

  private guia$: Observable<readonly PractitionerListItem[]> | null = null;
  protected readonly profesionales = signal<readonly ReferenceOption[]>([]);
  protected readonly buscandoProfesional = signal(false);
  protected readonly falloProfesional = signal(false);

  protected buscarProfesional(texto: string): void {
    this.guia$ ??= this.profiles.listPractitioners({ limit: TOPE_DE_LA_GUIA }).pipe(
      map((pagina) => pagina.items),
      shareReplay(1),
    );
    const buscado = normalizar(texto);
    this.buscandoProfesional.set(true);
    this.guia$
      .pipe(
        map((items) =>
          items
            .filter((p) =>
              normalizar(
                [p.displayName, p.professionalTitle, p.practitionerCode, ...p.workplaces].join(' '),
              ).includes(buscado),
            )
            .slice(0, 10)
            .map((p) => ({
              value: p.profileId,
              label: p.displayName ?? p.practitionerCode,
              hint: [p.professionalTitle, p.workplaces[0]].filter(Boolean).join(' · ') || undefined,
            })),
        ),
        catchError(() => {
          this.guia$ = null;
          this.falloProfesional.set(true);
          return of([]);
        }),
      )
      .subscribe((opciones) => {
        this.buscandoProfesional.set(false);
        this.profesionales.set(opciones);
      });
  }

  protected elegirProfesional(opcion: ReferenceOption | null): void {
    this.destino.set({ modo: 'PROFESIONAL', profileId: opcion?.value, profileOpcion: opcion ?? undefined });
  }

  /* -- Organizaciones y sedes --------------------------------------------- */

  protected readonly organizaciones = signal<readonly ReferenceOption[]>([]);
  protected readonly buscandoOrganizacion = signal(false);
  protected readonly falloOrganizacion = signal(false);
  protected readonly sedes = signal<readonly BranchListItem[]>([]);

  protected buscarOrganizacion(texto: string): void {
    this.buscandoOrganizacion.set(true);
    this.directory
      .searchTenants({ query: texto.trim(), limit: 10 })
      .pipe(
        map((pagina) =>
          pagina.items.map((t) => ({
            value: t.id,
            label: t.tradeName ?? t.legalName,
            hint: t.tradeName === undefined ? undefined : t.legalName,
          })),
        ),
        catchError(() => {
          this.falloOrganizacion.set(true);
          return of([]);
        }),
      )
      .subscribe((opciones) => {
        this.buscandoOrganizacion.set(false);
        this.organizaciones.set(opciones);
      });
  }

  protected elegirOrganizacion(opcion: ReferenceOption | null): void {
    this.destino.set({ modo: 'ORGANIZACION', tenantId: opcion?.value, tenantOpcion: opcion ?? undefined });
    this.sedes.set([]);
    if (opcion === null) {
      return;
    }
    this.directory
      .listBranches(opcion.value)
      .pipe(catchError(() => of({ items: [] as readonly BranchListItem[], count: 0 })))
      .subscribe((lista) => this.sedes.set(lista.items));
  }

  protected readonly opcionesDeSede = computed<readonly SelectOption<string | null>[]>(() => [
    { value: null, label: 'Cualquier sede (la organización decide)' },
    ...this.sedes().map((s) => ({ value: s.id, label: s.name })),
  ]);

  protected elegirSede(branchId: string | null): void {
    this.destino.update((d) => ({ ...d, branchId: branchId ?? undefined }));
  }

  /* -- Modo y externo ------------------------------------------------------ */

  protected elegirModo(valor: unknown): void {
    const modo = MODOS.find((m) => m === valor);
    if (modo !== undefined && modo !== this.destino().modo) {
      this.destino.set({ modo });
    }
  }

  protected fijarNombre(nombre: string | number | null): void {
    this.destino.update((d) => ({ ...d, nombre: String(nombre ?? '') }));
  }

  protected fijarContacto(contacto: string | number | null): void {
    this.destino.update((d) => ({ ...d, contacto: String(contacto ?? '') }));
  }
}

/** Minúsculas y sin tildes: «Gutiérrez» se encuentra escribiendo «gutierrez». */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('es')
    .trim();
}
