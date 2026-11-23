// A Mega Stone's name, the way the games spell it. Shared by the screens and by tools/build-megastones.mjs, which finds each
// stone's picture by this name (tools/megastones-src/Mega_Stone_<name>.png), so a wrong name here also shows as a missing picture.
import { SPECIES } from '../../core/species.ts'

/**
 * The stones whose name is not simply the species with "ite" on the end, by species (X and Y are added after).
 * Checked against Bulbapedia's list of Mega Stones.
 */
const STEM: Record<string, string> = {
  abomasnow: 'Abomasite', alakazam: 'Alakazite', altaria: 'Altarianite', blastoise: 'Blastoisinite', crabominable: 'Crabominite',
  diancie: 'Diancite', dragonite: 'Dragoninite', drampa: 'Drampanite', excadrill: 'Excadrite', feraligatr: 'Feraligite',
  gallade: 'Galladite', glalie: 'Glalitite', glimmora: 'Glimmoranite', gyarados: 'Gyaradosite', hawlucha: 'Hawluchanite',
  heracross: 'Heracronite', houndoom: 'Houndoominite', lopunny: 'Lopunnite', lucario: 'Lucarionite', manectric: 'Manectite',
  mawile: 'Mawilite', medicham: 'Medichamite', mewtwo: 'Mewtwonite', sableye: 'Sablenite', sharpedo: 'Sharpedonite',
  skarmory: 'Skarmorite', slowbro: 'Slowbronite', starmie: 'Starminite',
}

/** "charizard-megax" is Charizardite X, "kangaskhan-mega" Kangaskhanite, "alakazam-mega" Alakazite. */
export function megaStoneName(mega: string): string {
  const base = mega.replace(/-mega[xy]?$/, '')
  const side = mega.endsWith('megax') ? ' X' : mega.endsWith('megay') ? ' Y' : ''
  if (STEM[base]) return STEM[base] + side
  const name = (SPECIES[base]?.n ?? base).replace(/\s+/g, '')
  const stem = /[aeiou]$/i.test(name) ? name.slice(0, -1) : name
  return `${stem}ite${side}`
}
