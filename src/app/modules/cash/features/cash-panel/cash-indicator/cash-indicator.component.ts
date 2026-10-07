import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { filter, fromEvent, merge } from 'rxjs';
import { IconComponent } from 'src/ui';
import { openCashSessionModal } from '../../open-session-modal/open-session-modal.component';
import { CashContextStore } from '../cash-context.store';
import { cashSessionLabel } from '../cash-format';
import { CashPanelData, CashPanelModalComponent } from '../cash-panel-modal/cash-panel-modal.component';
import { openRegisterPicker } from '../register-picker-modal/register-picker-modal.component';

/** Estado de la caja del dispositivo en el POS. Con el módulo apagado no se muestra. */
@Component({
  selector: 'app-cash-indicator',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './cash-indicator.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashIndicatorComponent {
  private readonly dialog = inject(MatDialog);
  readonly context = inject(CashContextStore);

  readonly $visible = computed(() => this.context.$enabled() && !!this.context.$locationId());
  readonly $label = computed(() => {
    const register = this.context.$register();
    const session = register?.openSession;
    return register && session ? cashSessionLabel(register.name, session.openedByName, session.openedAt) : null;
  });
  readonly $canChange = computed(() => this.context.$activeRegisters().length > 1);

  // Locales donde ya se preguntó qué caja usar (una vez por local).
  readonly #asked = new Set<number>();

  constructor() {
    effect(() => {
      const locationId = this.context.$locationId();
      if (!this.$visible() || !this.context.$needsChoice() || !locationId || this.#asked.has(locationId)) return;
      this.#asked.add(locationId);
      untracked(() => this.changeRegister());
    });

    // Al volver a la pestaña se actualiza (otro equipo pudo abrir o cerrar la caja).
    merge(fromEvent(window, 'focus'), fromEvent(document, 'visibilitychange').pipe(filter(() => !document.hidden)))
      .pipe(
        filter(() => this.$visible()),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.context.refresh());
  }

  changeRegister() {
    const registers = this.context.$activeRegisters();
    if (!registers.length) return;
    openRegisterPicker(this.dialog, {
      title: 'Elige la caja de este equipo',
      message: 'Hay varias cajas en este local. Los cobros de este equipo quedarán en la que elijas.',
      registers,
      selectedId: this.context.$register()?.id ?? null,
    }).subscribe((registerId) => {
      if (registerId) this.context.selectRegister(registerId);
    });
  }

  openSession() {
    openCashSessionModal(this.dialog, {
      locationId: this.context.$locationId(),
      registerId: this.context.$register()?.id ?? null,
    }).subscribe();
  }

  openPanel() {
    const register = this.context.$register();
    if (!register) return;
    this.dialog
      .open<CashPanelModalComponent, CashPanelData>(CashPanelModalComponent, {
        width: '560px',
        maxWidth: '95vw',
        maxHeight: '95vh',
        data: { registerId: register.id, registerName: register.name },
      })
      .afterClosed()
      .subscribe(() => this.context.refresh());
  }
}
