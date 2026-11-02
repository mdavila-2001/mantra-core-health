import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { finalize, type Observable, type Subscription } from 'rxjs';

import type { IntegrationErrorReason } from '../../../../core/data-access/pharmacy/pharmacy-integration.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { integrationErrorMessage } from '../integration-error-message';

type Operation = 'save' | 'probe' | 'remove';

/** Una petición por ámbito; cancelación y versión impiden publicar respuestas anteriores. */
export class IntegrationSystemRequests {
  readonly activity = signal<Operation | null>(null);
  readonly error = signal<string | null>(null);
  readonly accessState = signal<ViewState<true>>(ready(true));
  private request?: Subscription;
  private version = 0;

  constructor(
    private readonly clearKey: () => void,
    private readonly scope: () => string,
  ) {}

  get generation(): number {
    return this.version;
  }

  cancel(): void {
    ++this.version;
    this.request?.unsubscribe();
    this.activity.set(null);
    this.error.set(null);
    this.accessState.set(ready(true));
    this.clearKey();
  }

  run<T>(
    activity: Operation,
    operation: Observable<T>,
    onSuccess: (value: T) => void,
    options: {
      fallback: string;
      overrides?: Partial<Readonly<Record<IntegrationErrorReason, string>>>;
      onError?: () => void;
    },
  ): void {
    if (this.activity() !== null) return;
    const version = this.version;
    const scope = this.scope();
    const current = () => version === this.version && scope === this.scope();
    this.activity.set(activity);
    this.error.set(null);
    this.request = operation.pipe(finalize(() => {
      if (current()) {
        this.activity.set(null);
        this.clearKey();
      }
    })).subscribe({
      next: (value) => {
        if (current()) onSuccess(value);
      },
      error: (error: unknown) => {
        if (!current()) return;
        if (error instanceof HttpErrorResponse && [401, 403, 404].includes(error.status)) {
          this.accessState.set(errorToViewState<true>(error));
        }
        this.error.set(integrationErrorMessage(error, options.fallback, options.overrides));
        options.onError?.();
      },
    });
  }
}
