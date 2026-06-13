import { ShowDefinition } from '../models/episode.model';

export const SHOWS: ShowDefinition[] = [
  { id: 'arrow', name: 'Arrow', accent: '#1e8449', icon: 'assets/shows/arrow.jpg' },
  { id: 'batwoman', name: 'Batwoman', accent: '#c0392b', icon: 'assets/shows/batwoman.jpg' },
  {
    id: 'black-lightning',
    name: 'Black Lightning',
    accent: '#f1c40f',
    icon: 'assets/shows/black-lightning.jpg',
  },
  { id: 'constantine', name: 'Constantine', accent: '#d35400', icon: 'assets/shows/constantine.jpg' },
  { id: 'flash', name: 'The Flash', accent: '#e74c3c', icon: 'assets/shows/flash.jpg' },
  {
    id: 'freedom-fighters',
    name: 'Freedom Fighters: The Ray',
    accent: '#3498db',
    icon: 'assets/shows/freedom-fighters.jpg',
  },
  {
    id: 'legends',
    name: "DC's Legends of Tomorrow",
    accent: '#8e44ad',
    icon: 'assets/shows/legends.jpg',
  },
  { id: 'stargirl', name: 'Stargirl', accent: '#2980b9', icon: 'assets/shows/stargirl.jpg' },
  { id: 'supergirl', name: 'Supergirl', accent: '#3498db', icon: 'assets/shows/supergirl.jpg' },
  {
    id: 'superman-and-lois',
    name: 'Superman & Lois',
    accent: '#2471a3',
    icon: 'assets/shows/superman-and-lois.jpg',
  },
  { id: 'vixen', name: 'Vixen', accent: '#e67e22', icon: 'assets/shows/vixen.jpg' },
];

export const SHOW_BY_NAME = new Map(SHOWS.map((show) => [show.name, show]));
export const SHOW_BY_ID = new Map(SHOWS.map((show) => [show.id, show]));
