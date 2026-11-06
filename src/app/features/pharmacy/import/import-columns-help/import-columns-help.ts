import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { AppButton } from '../../../../shared/components/atoms/button/button';

/** One column of an import file: its header and what goes in it. */
export interface ImportHelpColumn {
  readonly header: string;
  readonly description: string;
}

/** A downloadable template: what the button emits, its label and its test id. */
export interface ImportTemplateLink {
  readonly value: string;
  readonly label: string;
  readonly testId: string;
}

/**
 * The format guide of a CSV import: the columns of the file and the buttons to
 * download its templates. Presentational, with no data access, so the import
 * screens can show it even before a pharmacy is chosen or when there is none:
 * the format does not depend on the pharmacy.
 */
@Component({
  selector: 'app-import-columns-help',
  imports: [AppButton],
  templateUrl: './import-columns-help.html',
  styleUrl: './import-columns-help.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'complementary', '[attr.aria-labelledby]': 'headingId()' },
})
export class ImportColumnsHelp {
  readonly headingId = input.required<string>();
  readonly columns = input.required<readonly ImportHelpColumn[]>();
  readonly templates = input.required<readonly ImportTemplateLink[]>();
  /** Optional hint under the columns, e.g. how to update only prices. */
  readonly note = input('');
  /** The `value` of the template the person asked to download. */
  readonly download = output<string>();
}
