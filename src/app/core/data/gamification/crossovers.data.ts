import { CrossoverEvent } from '../../models/gamification.model';

export const CROSSOVER_EVENTS: CrossoverEvent[] = [
  {
    id: 'flash-vs-arrow',
    name: 'Flash vs. Arrow',
    tagline: 'Grudging respect in two cities.',
    rows: [67, 68],
    icon: 'pi pi-bolt',
  },
  {
    id: 'legends-of-today',
    name: 'Legends of Today / Yesterday',
    tagline: 'Time masters meet the archer.',
    rows: [132, 133],
    icon: 'pi pi-history',
  },
  {
    id: 'legends-born',
    name: 'Legends Born',
    tagline: 'The Waverider departs.',
    rows: [142, 146],
    icon: 'pi pi-compass',
  },
  {
    id: 'invasion',
    name: 'Invasion!',
    tagline: 'Repel the Dominators.',
    rows: [228, 229, 230],
    icon: 'pi pi-exclamation-triangle',
  },
  {
    id: 'crisis-earth-x',
    name: 'Crisis on Earth-X',
    tagline: 'Freedom fighters assemble.',
    rows: [313, 314, 315, 316],
    icon: 'pi pi-flag-fill',
  },
  {
    id: 'elseworlds',
    name: 'Elseworlds',
    tagline: 'The Monitor reveals the path to Crisis.',
    rows: [436, 437, 438, 439],
    icon: 'pi pi-sparkles',
  },
  {
    id: 'crisis-infinite',
    name: 'Crisis on Infinite Earths',
    tagline: 'Worlds lived. Worlds died.',
    rows: [534, 535, 536, 537, 538, 539],
    icon: 'pi pi-star-fill',
  },
  {
    id: 'armageddon',
    name: 'Armageddon',
    tagline: 'The Flash faces his greatest threat.',
    rows: [731, 734, 737, 738, 739],
    icon: 'pi pi-bolt',
  },
  {
    id: 'new-world',
    name: 'A New World',
    tagline: 'The Flash finale arc.',
    rows: [811, 813, 814, 815, 816],
    icon: 'pi pi-flag',
  },
];
