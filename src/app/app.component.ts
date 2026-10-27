import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgxSonnerToaster } from 'ngx-sonner';
import { ThemeService } from './core/services/theme.service';
import { ResponsiveHelperComponent } from './shared/components/responsive-helper/responsive-helper.component';
import { ToastComponent } from 'src/ui';
import { WhoamiService } from './core/services/whoami/whoami.service';
import { BrandColorService } from './core/services/brand-color';
import { LegalPromptService } from './core/services/legal/legal-prompt.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterOutlet, ResponsiveHelperComponent, NgxSonnerToaster, ToastComponent],
})
export class AppComponent {
  title = 'Redom';

  // BrandColorService aplica el color del restaurante en cuanto whoami trae el restaurantId.
  // LegalPromptService pide aceptar los documentos legales cuando whoami trae pendientes.
  constructor(public themeService: ThemeService, whoamiService: WhoamiService, brandColor: BrandColorService, legalPrompt: LegalPromptService) {}
}
