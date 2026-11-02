import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Alert } from '../../../../shared/components/molecules/alert/alert';

/**
 * El aviso fijo de las tres pantallas: ocultar no es seguridad. No se puede cerrar, porque es la
 * regla que evita el error más caro de esta función: creer que un botón oculto es un botón
 * protegido. Va en una línea (el aviso plegable del sistema) y el porqué se despliega.
 */
@Component({
  selector: 'app-visibility-notice',
  imports: [Alert],
  template: `
    <app-alert
      tone="warning"
      title="Ocultar no es proteger: estas reglas deciden qué se muestra, no conceden ni quitan acceso."
      collapsible
      data-testid="visibility-notice"
    >
      Un elemento oculto sigue funcionando si alguien llama a su dirección de la API: lo que permite o
      niega cada acción son los permisos del rol, y los decide el servidor en cada petición. Para impedir
      de verdad una acción, quite el permiso.
    </app-alert>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisibilityNotice {}
