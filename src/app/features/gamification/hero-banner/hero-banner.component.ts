import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';

import { GamificationService } from '../../../core/services/gamification.service';

@Component({
  selector: 'app-hero-banner',
  imports: [DecimalPipe, CardModule, ProgressBarModule, TagModule],
  templateUrl: './hero-banner.component.html',
  styleUrl: './hero-banner.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroBannerComponent {
  readonly gamification = inject(GamificationService);
  readonly profile = this.gamification.profile;
}
