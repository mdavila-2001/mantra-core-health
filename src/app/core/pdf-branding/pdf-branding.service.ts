import { effect, inject, Injectable, InjectionToken, untracked } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import { LogoDelConsultorioClient } from '../data-access/practice-sites/logo-del-consultorio.client';
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
 * Mantiene listo el logo del consultorio para el membrete de los PDF.
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
  private readonly preparar = inject(PREPARAR_LOGO);

  /** Para descartar respuestas de un pedido que ya no es el vigente. */
  private pedido = 0;

  constructor() {
    effect(() => {
      const profileId = this.auth.practitionerProfileId();
      untracked(() => this.cargar(profileId));
    });
  }

  /** Vuelve a leer el logo: se llama después de guardar uno nuevo o de quitarlo. */
  recargar(): void {
    this.cargar(this.auth.practitionerProfileId());
  }

  private cargar(profileId: string | null): void {
    const pedido = ++this.pedido;
    if (profileId === null) {
      establecerLogoDeDocumentos(null);
      return;
    }
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
}
