import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { readApiError } from '../../../core/http/api-error';
import { AppButton } from '../../components/atoms/button/button';
import { Alert } from '../../components/molecules/alert/alert';

/** Whether the API refused a registration because a live patient has that name. */
export function isPossibleDuplicatePatient(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status === 409 &&
    readApiError(error)?.reason === 'POSSIBLE_DUPLICATE_PATIENT'
  );
}

/**
 * Warning shown when a patient registration hits a homonym (409
 * `POSSIBLE_DUPLICATE_PATIENT`): look the person up first, or confirm that it
 * is someone else and register anyway.
 */
@Component({
  selector: 'app-homonym-warning',
  imports: [Alert, AppButton],
  templateUrl: './homonym-warning.html',
  styleUrl: './homonym-warning.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomonymWarning {
  /** Disables the confirmation while the request is in flight. */
  readonly sending = input(false);
  /** The operator confirmed it is a different person. */
  readonly confirm = output();
}
