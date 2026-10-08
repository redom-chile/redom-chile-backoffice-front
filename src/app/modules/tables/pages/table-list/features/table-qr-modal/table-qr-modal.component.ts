import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EntitlementsService, PlanUpsellService } from 'src/app/core/services/entitlements';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { RegenerateTableQrService, TableDto } from '../../data-access';
import { createQrDataUrl, printTableQrs, TableQrCodeComponent } from '../../ui';

export type TableQrModalResult = 'regenerated' | 'closed';

@Component({
  selector: 'app-table-qr-modal',
  standalone: true,
  imports: [ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, TableQrCodeComponent],
  templateUrl: './table-qr-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableQrModalComponent implements OnDestroy {
  private readonly dialogRef = inject<MatDialogRef<TableQrModalComponent, TableQrModalResult>>(MatDialogRef);
  private readonly toast = inject(ToastService);
  private readonly regenerateService = inject(RegenerateTableQrService);
  private readonly entitlements = inject(EntitlementsService);
  private readonly upsell = inject(PlanUpsellService);

  readonly table = inject<TableDto>(MAT_DIALOG_DATA);
  readonly $qrUrl = signal(this.table.qrUrl);
  readonly $qrCode = signal(this.table.qrCode);
  readonly $confirmRegenerate = signal(false);
  readonly $isRegenerating = this.regenerateService.$isLoading;
  // Regenerar el QR requiere la carta digital en el plan.
  readonly $canRegenerate = computed(() => this.entitlements.hasFeature('qr_menu'));
  #regenerated = false;

  constructor() {
    effect(() => {
      const result = this.regenerateService.$result();
      if (!result) return;
      this.$qrUrl.set(result.qrUrl);
      this.$qrCode.set(result.qrCode);
      this.$confirmRegenerate.set(false);
      this.#regenerated = true;
      this.regenerateService.reset();
      this.toast.show('QR regenerado. El anterior ya no funciona.', 'success');
    });

    effect(() => {
      if (this.regenerateService.$error()) this.toast.show('No se pudo regenerar el QR', 'error');
    });
  }

  async copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      this.toast.show('Enlace copiado', 'success');
    } catch {
      this.toast.show('No se pudo copiar el enlace', 'error');
    }
  }

  async download(url: string) {
    const link = document.createElement('a');
    link.href = await createQrDataUrl(url, 1024);
    link.download = `qr-${this.table.name.toLowerCase().replace(/\s+/g, '-')}.png`;
    link.click();
  }

  async print(url: string) {
    const opened = await printTableQrs([{ name: this.table.name, detail: `${this.table.capacity} personas`, url }]);
    if (!opened) this.toast.show('Permite las ventanas emergentes para imprimir', 'warning');
  }

  askRegenerate() {
    if (!this.$canRegenerate()) {
      this.upsell.open({ features: ['qr_menu'] });
      return;
    }
    if (this.$qrCode()) this.$confirmRegenerate.set(true);
    else this.regenerate();
  }

  regenerate() {
    this.regenerateService.regenerate(this.table.id);
  }

  close() {
    this.dialogRef.close(this.#regenerated ? 'regenerated' : 'closed');
  }

  ngOnDestroy(): void {
    this.regenerateService.reset();
  }
}
