import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';

import { GamificationService } from '../../../core/services/gamification.service';

@Component({
  selector: 'app-crossover-card',
  imports: [CardModule, ProgressBarModule],
  templateUrl: './crossover-card.component.html',
  styleUrl: './crossover-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrossoverCardComponent {
  readonly gamification = inject(GamificationService);
  readonly profile = this.gamification.profile;
}
