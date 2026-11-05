import { concat, map, toArray, type Observable } from 'rxjs';

import type { LabPortalClient } from '../../../core/data-access/lab-portal/lab-portal.client';
import type { LabOrder } from '../../../core/data-access/lab-portal/lab-portal.types';

/** Downloads every uploaded file of an order, one after the other, each under its own name. */
export function downloadOrderFiles(lab: LabPortalClient, order: LabOrder): Observable<unknown> {
  return concat(
    ...order.files.map((file) =>
      lab.resultContent(file.id).pipe(
        map((blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = file.fileName;
          link.click();
          URL.revokeObjectURL(url);
        }),
      ),
    ),
  ).pipe(toArray());
}
