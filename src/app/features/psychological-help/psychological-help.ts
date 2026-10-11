import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Card } from '../../shared/components/molecules/card/card';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';

/** Contención inicial, material audiovisual y acceso al directorio de salud mental. */
@Component({
  selector: 'app-psychological-help',
  imports: [Card, PageHeader, RouterLink],
  templateUrl: './psychological-help.html',
  styleUrl: './psychological-help.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PsychologicalHelp {}
