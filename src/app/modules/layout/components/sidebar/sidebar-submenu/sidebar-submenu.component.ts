import { NgClass } from '@angular/common';
import { Component, Input, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { SubMenuItem } from 'src/app/core/models/menu.model';
import { MenuService } from '../../../services/menu.service';
import { IconComponent } from 'src/ui';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { PaymentReviewCountService } from 'src/app/modules/platform/features/payment-review-count';

/** Ruta del menú que muestra el badge de transferencias por revisar. */
const PAYMENTS_REVIEW_ROUTE = '/platform/payments-review';

@Component({
  selector: 'app-sidebar-submenu',
  templateUrl: './sidebar-submenu.component.html',
  styleUrls: ['./sidebar-submenu.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [NgClass, RouterLinkActive, IconComponent, RouterLink, AngularSvgIconModule, CheckPermissionDirective],
})
export class SidebarSubmenuComponent implements OnInit {
  @Input() public submenu = <SubMenuItem>{};
  readonly paymentsReviewRoute = PAYMENTS_REVIEW_ROUTE;
  readonly $paymentsReviewCount = inject(PaymentReviewCountService).$count;

  constructor(public menuService: MenuService) {}

  ngOnInit(): void {}

  public toggleMenu(menu: any) {
    this.menuService.toggleSubMenu(menu);
  }

  private collapse(items: Array<any>) {
    items.forEach((item) => {
      item.expanded = false;
      if (item.children) this.collapse(item.children);
    });
  }
}
