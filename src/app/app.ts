import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastContainer } from '@shared/components/organisms/toast-container/toast-container';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainer],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
