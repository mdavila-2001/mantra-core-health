import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

import {
  IMAGE_PROPERTY,
  SPECIALTY_VALUE_SET,
  defaultSpecialtyImage,
  normalizeSpecialtyName,
  safeImageValue,
} from '../../../shared/specialties/specialty-images';
import { ConceptAdminClient } from './concept-admin.client';
import { TerminologyClient } from './terminology.client';

/**
 * La imagen de cada especialidad para las pantallas públicas: la que el admin
 * puso en el catálogo y, si no hay, la ilustración empaquetada. Se lee una vez
 * por sesión; mientras llega (o si falla) rige la ilustración empaquetada.
 */
@Injectable({ providedIn: 'root' })
export class SpecialtyImages {
  private readonly terminology = inject(TerminologyClient);
  private readonly admin = inject(ConceptAdminClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly custom = signal<ReadonlyMap<string, string>>(new Map());
  private requested = false;

  constructor() {
    this.load();
  }

  /** Pide las imágenes propias del catálogo, una sola vez. */
  private load(): void {
    if (!this.isBrowser || this.requested) return;
    this.requested = true;
    this.terminology.listValueSets({ code: SPECIALTY_VALUE_SET }).subscribe({
      next: (page) => {
        const set = page.items.find((s) => s.internalCode === SPECIALTY_VALUE_SET);
        if (set === undefined) return;
        this.admin.readExpansion(set.id).subscribe({
          next: (expansion) => {
            const map = new Map<string, string>();
            for (const item of expansion.items) {
              const url = safeImageValue(item.properties?.[IMAGE_PROPERTY]);
              if (url !== null) map.set(normalizeSpecialtyName(item.display), url);
            }
            this.custom.set(map);
          },
          error: () => (this.requested = false),
        });
      },
      error: () => (this.requested = false),
    });
  }

  /** La imagen de la especialidad llamada `nombre`. Lee una señal: reacciona al cargar. */
  readonly of = (nombre: string): string =>
    this.custom().get(normalizeSpecialtyName(nombre)) ?? defaultSpecialtyImage(nombre);
}
