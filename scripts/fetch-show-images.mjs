import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), 'public', 'assets', 'shows');
const queries = {
  arrow: 'Arrow',
  batwoman: 'Batwoman',
  'black-lightning': 'Black Lightning',
  constantine: 'Constantine',
  flash: 'The Flash',
  'freedom-fighters': 'Freedom Fighters The Ray',
  legends: 'Legends of Tomorrow',
  stargirl: 'Stargirl',
  supergirl: 'Supergirl',
  'superman-and-lois': 'Superman and Lois',
  vixen: 'Vixen',
};

for (const [key, query] of Object.entries(queries)) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const searchUrl = `https://api.tvmaze.com/singlesearch/shows?${new URLSearchParams({ q: query })}`;
  const showRes = await fetch(searchUrl);
  const show = await showRes.json();
  const imageUrl = show.image?.medium ?? show.image?.original;

  if (!imageUrl) {
    console.log(`MISSING ${key}: ${show.name ?? query}`);
    continue;
  }

  const imageRes = await fetch(imageUrl);
  const buffer = Buffer.from(await imageRes.arrayBuffer());
  writeFileSync(join(root, `${key}.jpg`), buffer);
  console.log(`OK ${key}: ${show.name} -> ${buffer.length} bytes`);
}
