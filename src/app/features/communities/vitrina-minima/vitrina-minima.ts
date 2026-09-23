import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../../core/auth/auth.service';
import { CommunityClient } from '../../../core/data-access/community/community.client';
import type { OwnPublicProfile } from '../../../core/data-access/community/community.types';
import { FilesClient } from '../../../core/data-access/files/files.client';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { FileInput } from '../../../shared/components/molecules/file-input/file-input';

/** Un enlace de vitrina: minúsculas, números y guiones. Igual que el backend. */
const SLUG_VALIDO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Tope del respaldo, el mismo que el resto de los adjuntos de la plataforma. */
const MAX_BYTES_DE_FOTO = 5 * 1024 * 1024;

/**
 * **Crear la vitrina, donde hace falta tenerla.**
 *
 * ## Por qué existe
 *
 * El 2026-09-10 el propietario pidió sacar el perfil público «de todos lados,
 * hasta de editar la info del médico». Se sacó —la configuración de la vitrina
 * y la vista previa—, y con eso **dos funciones quedaron sin salida**: crear un
 * grupo **público** y «Mis artículos» exigen una vitrina completa, y el
 * rechazo lo firma el servidor, no la pantalla. El aviso que quedó derivaba a
 * «quien administra tu organización», que no tiene dónde hacerlo: el contrato
 * sólo sabe de la vitrina **propia** (`PUT /community/profiles/me`).
 *
 * ## Por qué acá y no de vuelta en el perfil
 *
 * Porque el perfil es exactamente de donde él la mandó sacar. Esto no es una
 * sección de configuración: es **el requisito de una función, pedido en el
 * momento en que la función lo exige** —al ir a publicar un artículo, al ir a
 * crear un grupo público—, y con lo mínimo para que el servidor acepte: nombre
 * visible, enlace y la vitrina en público. Quien no publica ni crea grupos no
 * ve esto nunca.
 *
 * ## Por qué la foto viaja en el mismo PUT
 *
 * `PUT /community/profiles/me` es completo e idempotente: crea o actualiza. La
 * pantalla vieja subía la foto **después** porque editaba una vitrina ya
 * guardada y no quería pisar lo que la persona estuviera escribiendo. Acá no
 * hay nada guardado que pisar: los tres campos están en este formulario, así
 * que la foto se sube primero y su id entra en la misma escritura. Un viaje.
 */
@Component({
  selector: 'app-vitrina-minima',
  imports: [Alert, AppButton, FileInput, FormField, Input],
  templateUrl: './vitrina-minima.html',
  styleUrl: './vitrina-minima.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VitrinaMinima {
  private readonly community = inject(CommunityClient);
  private readonly files = inject(FilesClient);
  private readonly auth = inject(AuthService);

  /** Para qué la está creando. Cambia el texto, no el formulario. */
  readonly motivo = input<'articulos' | 'grupos'>('articulos');

  /** La vitrina recién creada. Quien la pidió sigue desde acá. */
  readonly creada = output<OwnPublicProfile>();

  protected readonly displayName = signal(this.auth.displayName() ?? '');
  protected readonly slug = signal(sugerirEnlace(this.auth.displayName() ?? ''));
  protected readonly foto = signal<readonly File[]>([]);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  protected readonly maxBytesDeFoto = MAX_BYTES_DE_FOTO;
  protected readonly formatosDeFoto = 'image/jpeg,image/png,image/webp';

  protected readonly slugValido = computed(() => SLUG_VALIDO.test(this.slug().trim()));

  /**
   * Si la foto es obligatoria. Depende de para qué se crea la vitrina.
   *
   * Un grupo **público** la exige: el servidor comprueba nombre visible, foto y
   * visibilidad pública, y `Groups.perfilListoParaPublico` repite las tres.
   * Crear la vitrina sin foto dejaría a la persona con el mismo rechazo que la
   * trajo hasta acá, que es la peor forma de resolver un callejón sin salida.
   *
   * Para firmar un artículo no hace falta: el servidor no la pide y una firma
   * sin foto sigue siendo una firma.
   */
  protected readonly fotoObligatoria = computed(() => this.motivo() === 'grupos');

  protected readonly puedeCrear = computed(
    () =>
      this.slugValido() &&
      this.displayName().trim() !== '' &&
      (!this.fotoObligatoria() || this.foto().length > 0) &&
      !this.guardando(),
  );

  /** El enlace tal como va a quedar, para que no haya que imaginárselo. */
  protected readonly enlace = computed(
    () => `alovida.app/p/${this.slug().trim() || 'tu-enlace'}`,
  );

  /**
   * Sin organización activa no hay vitrina posible: `tenantId` es obligatorio
   * en el contrato. Se dice, en vez de fallar al guardar.
   */
  protected readonly sinOrganizacion = computed(() => this.auth.activeTenantId() === null);

  /** El nombre escrito propone el enlace, mientras nadie lo haya tocado a mano. */
  protected readonly alEscribirNombre = (valor: string): void => {
    const anterior = sugerirEnlace(this.displayName());
    this.displayName.set(valor);
    if (this.slug() === anterior) {
      this.slug.set(sugerirEnlace(valor));
    }
  };

  protected crear(): void {
    const tenantId = this.auth.activeTenantId();
    if (tenantId === null || !this.puedeCrear()) return;

    this.guardando.set(true);
    this.error.set('');

    const foto = this.foto()[0];
    if (foto === undefined) {
      this.guardarVitrina(tenantId, undefined);
      return;
    }

    // `IMAGE`/`NORMAL`: es la foto con la que se firma en público, no un dato
    // clínico. El mismo par que usaba la pantalla de vitrina que se sacó.
    this.files.upload(foto, 'IMAGE', 'NORMAL').subscribe({
      next: ({ id }) => this.guardarVitrina(tenantId, id),
      error: () => {
        this.guardando.set(false);
        this.error.set('No pudimos subir la foto, así que no se creó la vitrina. Probá de nuevo.');
      },
    });
  }

  /**
   * La escritura en sí.
   *
   * `visibility: 'PUBLIC'` explícito: el requisito que el servidor comprueba es
   * «el perfil en público», y una vitrina creada en privado dejaría a quien la
   * acaba de crear con el mismo rechazo de antes y sin entender por qué.
   */
  private guardarVitrina(tenantId: string, avatarFileId: string | undefined): void {
    this.community
      .upsertOwnProfile({
        tenantId,
        slug: this.slug().trim(),
        displayName: this.displayName().trim(),
        visibility: 'PUBLIC',
        ...(avatarFileId === undefined ? {} : { avatarFileId }),
      })
      .subscribe({
        next: (perfil) => {
          this.guardando.set(false);
          this.creada.emit(perfil);
        },
        error: (fallo: unknown) => {
          this.guardando.set(false);
          const esConflicto = fallo instanceof HttpErrorResponse && fallo.status === 409;
          this.error.set(
            esConflicto
              ? 'Ese enlace ya lo usa otra persona. Probá con otro.'
              : 'No se pudo crear tu vitrina. Probá de nuevo.',
          );
        },
      });
  }
}

/**
 * Un enlace a partir del nombre: sin tildes, en minúsculas y con guiones.
 *
 * Es una propuesta, no una regla: el campo queda editable. Sin esto, la
 * primera pantalla que ve alguien que sólo quería publicar un artículo le pide
 * inventar una URL.
 */
function sugerirEnlace(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
