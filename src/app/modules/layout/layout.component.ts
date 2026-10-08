import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Event, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { FooterComponent } from './components/footer/footer.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { BottomNavbarComponent } from 'src/ui';
import { HelpPanelComponent } from 'src/app/modules/help/features/help-panel/help-panel.component';
import { HelpFabComponent } from 'src/app/modules/help/features/help-fab';
import { SubscriptionBannerComponent } from 'src/app/modules/billing/features/subscription-banner';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [SidebarComponent, NavbarComponent, RouterOutlet, FooterComponent, BottomNavbarComponent, HelpPanelComponent, HelpFabComponent, SubscriptionBannerComponent],
})
export class LayoutComponent implements OnInit {
  private mainContent: HTMLElement | null = null;

  constructor(private router: Router) {
    this.router.events.subscribe((event: Event) => {
      if (event instanceof NavigationEnd) {
        if (this.mainContent) {
          this.mainContent!.scrollTop = 0;
        }
      }
    });
  }

  ngOnInit(): void {
    this.mainContent = document.getElementById('main-content');
  }
}
