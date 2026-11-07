import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { AppButton } from '../../../shared/components/atoms/button/button';
import type { RegisteredSite } from './registered-site';

/**
 * The practice the registration already described, to create with one click instead of typing the
 * name, the site and the point again. «Usar otros datos» goes back to the form.
 */
@Component({
  selector: 'app-registered-site-confirm',
  imports: [AppButton],
  template: `
    <section
      class="confirm"
      aria-labelledby="registered-site-title"
      data-testid="medical-center-setup-registered"
    >
      <h2 id="registered-site-title" class="confirm__title">Ya tenemos los datos de su registro</h2>
      <p class="confirm__text">
        Abra su práctica con la sede que declaró al registrarse. No hace falta escribirlos de nuevo.
      </p>
      <dl class="confirm__facts">
        <div>
          <dt>Organización</dt>
          <dd data-testid="medical-center-setup-registered-name">{{ site().practiceName }}</dd>
        </div>
        <div>
          <dt>Primera sede</dt>
          <dd data-testid="medical-center-setup-registered-site">{{ site().siteName }}</dd>
        </div>
        <div>
          <dt>Dirección</dt>
          <dd>{{ site().addressText }}</dd>
        </div>
      </dl>
      <div class="confirm__actions">
        <button
          app-button
          type="button"
          [isLoading]="pending()"
          data-testid="medical-center-setup-registered-create"
          (clicked)="confirmed.emit()"
        >
          Crear mi práctica
        </button>
        <button
          app-button
          type="button"
          variant="ghost"
          [disabled]="pending()"
          data-testid="medical-center-setup-registered-other"
          (clicked)="other.emit()"
        >
          Usar otros datos
        </button>
      </div>
    </section>
  `,
  styles: `
    .confirm {
      display: grid;
      gap: var(--sp-3);
    }
    .confirm__title {
      margin: 0;
      font-size: var(--fs-h2);
    }
    .confirm__text {
      margin: 0;
      color: var(--text-secondary);
    }
    .confirm__facts {
      display: grid;
      gap: var(--sp-2);
      margin: 0;
    }
    .confirm__facts dt {
      color: var(--text-secondary);
      font-size: var(--fs-caption);
    }
    .confirm__facts dd {
      margin: 0;
      font-weight: 600;
    }
    .confirm__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisteredSiteConfirm {
  readonly site = input.required<RegisteredSite>();
  readonly pending = input(false);
  readonly confirmed = output<void>();
  readonly other = output<void>();
}
