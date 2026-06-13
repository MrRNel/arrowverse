import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { MenuModule } from 'primeng/menu';
import { ToastModule } from 'primeng/toast';

import { SHOW_BY_NAME } from '../../core/data/shows.data';
import { AuthService } from '../../core/services/auth.service';
import { ExtensionBridgeService } from '../../core/services/extension-bridge.service';
import { GamificationService } from '../../core/services/gamification.service';
import { UserSettingsService } from '../../core/services/user-settings.service';
import { WatchProgressService } from '../../core/services/watch-progress.service';
import { formatEpisodeCode } from '../../core/utils/episode.utils';

@Component({
  selector: 'app-shell',
  imports: [DecimalPipe, RouterOutlet, MenuModule, ToastModule],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  private readonly progressService = inject(WatchProgressService);
  private readonly settingsService = inject(UserSettingsService);
  private readonly extensionBridge = inject(ExtensionBridgeService);
  private readonly auth = inject(AuthService);
  readonly gamification = inject(GamificationService);
  readonly profile = this.gamification.profile;
  readonly user = this.auth.user;
  readonly extensionConnected = this.extensionBridge.connected;
  readonly extensionLastEvent = this.extensionBridge.lastEvent;
  readonly currentlyPlaying = this.extensionBridge.currentlyPlaying;
  readonly extensionSyncWarning = this.extensionBridge.syncWarning;

  readonly menuItems: MenuItem[] = [
    {
      label: 'Navigation',
      items: [
        {
          label: 'Dashboard',
          icon: 'pi pi-home',
          routerLink: ['/dashboard'],
        },
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
        {
          label: 'Options',
          icon: 'pi pi-cog',
          routerLink: ['/options'],
        },
      ],
    },
  ];

  constructor() {
    void this.progressService.init();
    void this.settingsService.init();
    this.extensionBridge.init();
  }

  logout(): void {
    sessionStorage.removeItem('arrowverse.extensionLinked');
    this.auth.logout();
  }

  iconFor(series: string): string {
    return SHOW_BY_NAME.get(series)?.icon ?? 'assets/shows/arrow.jpg';
  }

  providerLabel(provider: string | undefined): string {
    if (provider === 'netflix') {
      return 'Netflix';
    }
    if (provider === 'jellyfin') {
      return 'Jellyfin';
    }
    return 'Player';
  }

  formatCode(episodeId: string): string {
    return formatEpisodeCode(episodeId);
  }
}
