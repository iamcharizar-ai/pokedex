// The colour of each Pokemon type, for the glow behind a portrait (a leader, a
// boss, a Pokedex entry). One place, so a Fire leader and a Fire Pokemon match.
export const TYPE_COLOR: Record<string, string> = {
  Normal: '#a8a77a', Fire: '#ee8130', Water: '#6390f0', Electric: '#f7d02c', Grass: '#7ac74c', Ice: '#96d9d6',
  Fighting: '#c22e28', Poison: '#a33ea1', Ground: '#e2bf65', Flying: '#a98ff3', Psychic: '#f95587', Bug: '#a6b91a',
  Rock: '#b6a136', Ghost: '#735797', Dragon: '#6f35fc', Dark: '#705746', Steel: '#b7b7ce', Fairy: '#d685ad',
}
/** A type's colour, whatever case it is written in; a soft blue when it is not known. */
export const typeColor = (t?: string | null): string => (t ? TYPE_COLOR[t[0].toUpperCase() + t.slice(1).toLowerCase()] : undefined) ?? '#5a78c8'
