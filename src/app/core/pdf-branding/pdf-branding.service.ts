import { effect, inject, Injectable, InjectionToken, untracked } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { FirmaYSelloClient } from '../data-access/profiles/signature-and-seal.client';
import { ProfilesClient } from '../data-access/profiles/profiles.client';
import { LogoDelConsultorioClient } from '../data-access/practice-sites/practice-logo.client';
import { establecerFirmaDeDocumentos } from '../../shared/utils/pdf-export/pdf-signature';
import {
  establecerFuentesDeDocumentos,
  prepararFuentes,
  type PdfFuentes,
} from '../../shared/utils/pdf-export/pdf-fonts';
import {
  establecerLogoDeDocumentos,
  prepararLogo,
  type PdfLogo,
} from '../../shared/utils/pdf-export/pdf-logo';

/**
 * Cómo se prepara una imagen para el PDF. Es un token para poder sustituirlo en
 * pruebas: `prepararLogo` decodifica con `canvas`, que no existe fuera de un
 * navegador de verdad.
 */
export const PREPARAR_LOGO = new InjectionToken<(dataUrl: string) => Promise<PdfLogo | null>>(
  'PREPARAR_LOGO',
  { providedIn: 'root', factory: () => prepararLogo },
);

/**
 * Cómo se bajan las fuentes del papel. Token por lo mismo que `PREPARAR_LOGO`:
 * `prepararFuentes` usa `fetch` contra la carpeta pública, que en una prueba no
 * existe.
 */
export const PREPARAR_FUENTES = new InjectionToken<() => Promise<PdfFuentes | null>>(
  'PREPARAR_FUENTES',
  { providedIn: 'root', factory: () => prepararFuentes },
);

/**
 * Mantiene listos el logo del consultorio, la firma y el sello del médico y las
 * fuentes de marca para el membrete, el cuerpo y el pie de los PDF.
 *
 * ## Por qué existe
 *
 * El maquetador (`buildBlocksPdf`) es síncrono y lo llaman doce documentos
 * desde pantallas distintas; ninguno puede esperar a bajar una imagen. Este
 * servicio la baja **antes**, en cuanto hay un profesional en la sesión, la deja
 * lista en `pdf-logo.ts` y desde ahí sale en todos los documentos sin que cada
 * uno lo pida.
 *
 * ## Qué garantiza
 *
 * - **Nunca rompe un documento.** Sin logo, con error de red o con una imagen
 *   ilegible, el logo queda en `null` y el PDF sale con la ranura vacía.
 * - **No sobrevive a su dueño.** Al cerrar sesión o cambiar de profesional se
 *   limpia; y una respuesta lenta del profesional anterior no lo pisa.
 * - **Habla sólo con `LogoDelConsultorioClient`**, así que no sabe dónde vive el
 *   logo: mudarlo al backend real no lo toca.
 *
 * Se instancia desde el shell (`inject`) para que ese efecto corra durante toda
 * la sesión. {@link PdfBrandingService.recargar} es para quien cambia el logo.
 */
@Injectable({ providedIn: 'root' })
export class PdfBrandingService {
  private readonly auth = inject(AuthService);
  private readonly logo = inject(LogoDelConsultorioClient);
  private readonly firmaYSello = inject(FirmaYSelloClient);
  private readonly perfiles = inject(ProfilesClient);
  private readonly preparar = inject(PREPARAR_LOGO);
  private readonly prepararFuentes = inject(PREPARAR_FUENTES);

  /** Para descartar respuestas de un pedido que ya no es el vigente. */
  private pedido = 0;

  constructor() {
    // Las fuentes no son de nadie: se bajan una vez por sesión, no por
    // profesional, y no se limpian al cerrar sesión.
    void this.prepararFuentes().then(establecerFuentesDeDocumentos);
    effect(() => {
      const profileId = this.auth.practitionerProfileId();
      untracked(() => this.cargar(profileId));
    });
  }

  /**
   * Vuelve a leer el logo, la firma y el sello: se llama después de guardar uno
   * nuevo o de quitarlo.
   */
  recargar(): void {
    this.cargar(this.auth.practitionerProfileId());
  }

  private cargar(profileId: string | null): void {
    const pedido = ++this.pedido;
    if (profileId === null) {
      establecerLogoDeDocumentos(null);
      establecerFirmaDeDocumentos(null);
      return;
    }
    this.cargarFirma(pedido);
    this.logo.obtenerUrl(profileId).subscribe((url) => {
      if (url === null) {
        if (pedido === this.pedido) establecerLogoDeDocumentos(null);
        return;
      }
      void this.preparar(url).then((listo) => {
        // Una respuesta lenta del pedido anterior no pisa a la del vigente.
        if (pedido === this.pedido) establecerLogoDeDocumentos(listo);
      });
    });
  }

  /**
   * La firma y el sello del profesional, más el nombre y la matrícula que se
   * imprimen bajo la línea. Son **imágenes**, no una firma electrónica.
   *
   * Si el perfil no se puede leer el bloque sale igual, con la línea de firma y
   * sin nombre: un documento firmado a mano después no necesita más.
   */
  private cargarFirma(pedido: number): void {
    forkJoin([
      this.firmaYSello.obtener(),
      this.perfiles.getOwnPractitionerProfile().pipe(catchError(() => of(null))),
    ]).subscribe(([imagenes, perfil]) => {
      void Promise.all([
        imagenes.firmaUrl === null ? null : this.preparar(imagenes.firmaUrl),
        imagenes.selloUrl === null ? null : this.preparar(imagenes.selloUrl),
      ]).then(([firma, sello]) => {
        // Una respuesta lenta del pedido anterior no pisa a la del vigente.
        if (pedido !== this.pedido) return;
        establecerFirmaDeDocumentos({
          nombre: perfil?.displayName ?? '',
          matricula: perfil?.licenses[0]?.licenseNumber ?? null,
          firma,
          sello,
        });
      });
    });
  }
}
