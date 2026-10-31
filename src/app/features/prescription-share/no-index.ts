import { DestroyRef, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';

/**
 * Pide a los buscadores que no indexen la página y al navegador que no mande
 * su dirección como `Referer` mientras está abierta (REQ-FAR-01-019); retira
 * las dos marcas al salir.
 *
 * Las dos páginas públicas de la receta llevan en la dirección un token o el
 * id de una receta: indexarlas, o regalarlas en el `Referer` del próximo
 * sitio, sería publicar el enlace del paciente. Se llama desde el constructor
 * del componente, en su contexto de inyección.
 */
export function markPageAsNoIndex(): void {
  const meta = inject(Meta);
  meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
  meta.updateTag({ name: 'referrer', content: 'no-referrer' });
  inject(DestroyRef).onDestroy(() => {
    meta.removeTag('name="robots"');
    meta.removeTag('name="referrer"');
  });
}
