import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { shareReplay, type Observable } from 'rxjs';

import { OrganizationLogoClient } from '../../../../core/data-access/directory/organization-logo.client';

const TAMANOS = { sm: 36, md: 48, lg: 64 } as const;
export type OrganizationIdentitySize = keyof typeof TAMANOS;

/**
 * La identidad de una organización: su logo y su nombre (06/11/2026).
 *
 * El logo se contiene (`object-fit: contain`) sobre una baldosa blanca —los logos
 * se diseñan para papel— y, sin logo o si no carga, la baldosa muestra las
 * iniciales **del mismo tamaño**: nada se mueve cuando llega o falta una imagen.
 *
 * Lo usan las pantallas donde una persona tiene que reconocer un centro (derivar
 * una orden, aceptar una derivación, el encabezado del laboratorio). Lee el logo
 * por `OrganizationLogoClient`, que **nunca falla**, y recuerda cada lectura:
 * una lista de veinte centros no pide veinte veces el mismo archivo.
 *
 * ```html
 * <app-organization-identity [tenantId]="centro.tenantId" [name]="centro.name" subtitle="Laboratorio" />
 * ```
 */
@Component({
  selector: 'app-organization-identity',
  templateUrl: './organization-identity.html',
  styleUrl: './organization-identity.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationIdentity {
  private readonly logos = inject(OrganizationLogoClient);

  readonly tenantId = input<string | null>(null);
  readonly name = input.required<string>();
  /** Una segunda línea: el tipo de centro, la ciudad. */
  readonly subtitle = input<string | null>(null);
  readonly size = input<OrganizationIdentitySize>('md');
  /** Sólo la baldosa, sin nombre (el nombre ya está en el texto de al lado). */
  readonly compact = input(false);

  protected readonly logo = signal<string | null>(null);
  protected readonly failed = signal(false);
  protected readonly side = computed(() => `${TAMANOS[this.size()]}px`);
  protected readonly initials = computed(() => {
    const words = this.name()
      .split(/\s+/)
      .filter((w) => w.length > 2 || /^[A-ZÁÉÍÓÚÑ]/.test(w));
    return (
      words
        .slice(0, 2)
        .map((w) => w[0]!.toLocaleUpperCase('es'))
        .join('') || '?'
    );
  });

  constructor() {
    effect(() => {
      const id = this.tenantId();
      untracked(() => {
        this.logo.set(null);
        this.failed.set(false);
        if (id === null) return;
        leer(this.logos, id).subscribe((url) => {
          if (id === this.tenantId()) this.logo.set(url);
        });
      });
    });
  }

  protected onError(): void {
    this.failed.set(true);
  }
}

/** Las lecturas ya hechas, por organización: una lista repetida no repite el pedido. */
const LECTURAS = new Map<string, Observable<string | null>>();

function leer(client: OrganizationLogoClient, tenantId: string): Observable<string | null> {
  let lectura = LECTURAS.get(tenantId);
  if (lectura === undefined) {
    lectura = client.getUrl(tenantId).pipe(shareReplay(1));
    LECTURAS.set(tenantId, lectura);
  }
  return lectura;
}
