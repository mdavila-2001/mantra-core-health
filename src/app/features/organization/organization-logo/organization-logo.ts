import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { map, switchMap } from 'rxjs';

import { LogoDeOrganizacionClient } from '../../../core/data-access/directory/logo-de-organizacion.client';
import { describeApiFailure } from '../../../core/http/api-failure';
import { blobToDataUrl } from '../../../core/data-access/files/blob-to-data-url';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Card } from '../../../shared/components/molecules/card/card';
import {
  FileInput,
  type RejectedFile,
} from '../../../shared/components/molecules/file-input/file-input';
import { LogoConsultorio } from '../../../shared/components/molecules/logo-consultorio/logo-consultorio';

/** Formatos que acepta el logo: lo que `upload-policy` admite como imagen. */
const FORMATOS_DEL_LOGO = 'image/png,image/jpeg,image/webp';

/** 2 MiB: sobra para un logo y evita que un documento pese como una foto. */
const MAX_BYTES_DEL_LOGO = 2 * 1024 * 1024;

/**
 * El logo de una organización —farmacia, laboratorio, clínica, aseguradora—, en una
 * tarjeta que se pone igual en todas sus pantallas de ficha.
 *
 * Quien administra la organización lo **sube, cambia y quita** acá; el resto sólo lo ve.
 * A diferencia del editor del médico, que guarda junto con el resto de su perfil, esta
 * tarjeta guarda en el momento: la organización no tiene un formulario de perfil único
 * al que atarla, y un logo subido que no se guardó es un logo que se pierde sin aviso.
 *
 * La caja es la misma del consultorio (`LogoConsultorio`, 2:1, sin recortar) y el acceso
 * a los datos pasa por `LogoDeOrganizacionClient`: cuando la API real tenga su endpoint
 * se cambia ese archivo y no esta tarjeta.
 *
 * ```html
 * <app-organization-logo [tenantId]="org.id" [nombre]="org.tradeName" [puedeEditar]="true" />
 * ```
 */
@Component({
  selector: 'app-organization-logo',
  imports: [AppButton, Card, FileInput, LogoConsultorio],
  templateUrl: './organization-logo.html',
  styleUrl: './organization-logo.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationLogo {
  private readonly logo = inject(LogoDeOrganizacionClient);

  /** La organización cuyo logo se muestra. */
  readonly tenantId = input.required<string>();
  /** Su nombre, para el texto alternativo de la imagen. */
  readonly nombre = input<string>('');
  /** Si quien mira administra la organización. La API vuelve a comprobarlo al guardar. */
  readonly puedeEditar = input<boolean>(false);

  /** La imagen como `data:` URL, o `null` si no hay. */
  protected readonly vista = signal<string | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly error = signal('');
  /** Vacío siempre: el selector sólo dispara; la imagen vive en `vista`. */
  protected readonly archivos = signal<readonly File[]>([]);
  protected readonly formatos = FORMATOS_DEL_LOGO;
  protected readonly maxBytes = MAX_BYTES_DEL_LOGO;

  constructor() {
    // Cada organización distinta vuelve a leer su logo; `untracked` para que escribir las
    // señales de estado no reabra esta lectura.
    effect(() => {
      const id = this.tenantId();
      untracked(() => this.cargar(id));
    });
  }

  private cargar(tenantId: string): void {
    this.error.set('');
    this.vista.set(null);
    this.logo.obtenerUrl(tenantId).subscribe((url) => {
      // Si mientras tanto se pasó a otra organización, esta respuesta ya no es de la que se ve.
      if (tenantId === this.tenantId()) {
        this.vista.set(url);
      }
    });
  }

  protected alElegir(elegidos: readonly File[]): void {
    const archivo = elegidos[0];
    if (archivo === undefined || this.ocupado()) {
      return;
    }
    const tenantId = this.tenantId();
    this.error.set('');
    this.ocupado.set(true);
    this.logo
      .subir(archivo)
      .pipe(
        switchMap((fileId) =>
          this.logo.guardar(tenantId, fileId).pipe(map(() => fileId)),
        ),
        switchMap(() => blobToDataUrl(archivo)),
      )
      .subscribe({
        next: (url) => {
          this.ocupado.set(false);
          this.vista.set(url);
        },
        error: (error: unknown) => {
          this.ocupado.set(false);
          this.error.set(describeApiFailure(error, 'No se pudo guardar el logo. Pruebe de nuevo.'));
        },
      });
  }

  /** El selector descartó un archivo: se dice por qué, sin tocar el logo actual. */
  protected alRechazar(rechazados: readonly RejectedFile[]): void {
    const motivo = rechazados[0]?.reason;
    this.error.set(
      motivo === 'tamaño'
        ? 'El logo pesa más de 2 MB. Elija una imagen más liviana.'
        : 'El logo tiene que ser una imagen PNG, JPG o WEBP.',
    );
  }

  protected quitar(): void {
    if (this.ocupado()) {
      return;
    }
    this.error.set('');
    this.ocupado.set(true);
    this.logo.guardar(this.tenantId(), null).subscribe({
      next: () => {
        this.ocupado.set(false);
        this.vista.set(null);
      },
      error: (error: unknown) => {
        this.ocupado.set(false);
        this.error.set(describeApiFailure(error, 'No se pudo quitar el logo. Pruebe de nuevo.'));
      },
    });
  }
}
