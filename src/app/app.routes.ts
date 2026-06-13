import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/guards/auth.guard';
import { LoginComponent } from './features/auth/login/login.component';
import { HeroCodexComponent } from './features/gamification/hero-codex/hero-codex.component';
import { SeasonDetailComponent } from './features/series/season-detail/season-detail.component';
import { SeriesDetailComponent } from './features/series/series-detail/series-detail.component';
import { SeriesListComponent } from './features/series/series-list/series-list.component';
import { WatchOrderComponent } from './features/watch-order/watch-order.component';
import { ShellComponent } from './layout/shell/shell.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard],
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'watch-order' },
      { path: 'watch-order', component: WatchOrderComponent },
      { path: 'hero-codex', component: HeroCodexComponent },
      { path: 'series', component: SeriesListComponent },
      { path: 'series/:showId', component: SeriesDetailComponent },
      { path: 'series/:showId/season/:season', component: SeasonDetailComponent },
    ],
  },
  { path: '**', redirectTo: 'watch-order' },
];
