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
 * An organization's identity: its logo and its name.
 *
 * The logo is contained on a white tile (logos are designed for paper); without a logo, or if it
 * fails to load, the tile shows the initials at the SAME size, so nothing moves. Reads go through
 * `OrganizationLogoClient` (never fails) and are remembered per organization.
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
  /** A second line: center type, city. */
  readonly subtitle = input<string | null>(null);
  readonly size = input<OrganizationIdentitySize>('md');
  /** Tile only, no name (the name is already in the surrounding text). */
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

/** Reads already made, per organization: a repeated list does not repeat the request. */
const LECTURAS = new Map<string, Observable<string | null>>();

function leer(client: OrganizationLogoClient, tenantId: string): Observable<string | null> {
  let lectura = LECTURAS.get(tenantId);
  if (lectura === undefined) {
    lectura = client.getUrl(tenantId).pipe(shareReplay(1));
    LECTURAS.set(tenantId, lectura);
  }
  return lectura;
}
