import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { MenuModule } from 'primeng/menu';
import { ToastModule } from 'primeng/toast';

import { AuthService } from '../../core/services/auth.service';
import { ExtensionBridgeService } from '../../core/services/extension-bridge.service';
import { GamificationService } from '../../core/services/gamification.service';
import { WatchProgressService } from '../../core/services/watch-progress.service';

@Component({
  selector: 'app-shell',
  imports: [DecimalPipe, RouterOutlet, MenuModule, ToastModule],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  private readonly progressService = inject(WatchProgressService);
  private readonly extensionBridge = inject(ExtensionBridgeService);
  private readonly auth = inject(AuthService);
  readonly gamification = inject(GamificationService);
  readonly profile = this.gamification.profile;
  readonly user = this.auth.user;
  readonly extensionConnected = this.extensionBridge.connected;
  readonly extensionLastEvent = this.extensionBridge.lastEvent;
  readonly extensionSyncWarning = this.extensionBridge.syncWarning;

  readonly menuItems: MenuItem[] = [
    {
      label: 'Navigation',
      items: [
        {
          label: 'Watch Order',
          icon: 'pi pi-list',
          routerLink: ['/watch-order'],
        },
        {
          label: 'Hero Codex',
          icon: 'pi pi-star',
          routerLink: ['/hero-codex'],
        },
        {
          label: 'Series',
          icon: 'pi pi-th-large',
          routerLink: ['/series'],
        },
      ],
    },
  ];

  constructor() {
    void this.progressService.init();
    this.extensionBridge.init();
  }

  logout(): void {
    sessionStorage.removeItem('arrowverse.extensionLinked');
    this.auth.logout();
  }
}
