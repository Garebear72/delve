// Pixel sprites defined as text. Each character maps to a palette colour; '.' is transparent.
export const PALETTE: Record<string, string> = {
  k: '#1b1b26', w: '#ffffff', s: '#f1c27d', S: '#c98e57', h: '#f2c14e', b: '#8a4b2a', B: '#5e3119',
  c: '#3b6ea5', C: '#284d78', g: '#6abe30', G: '#37946e', r: '#d95763', R: '#9e2a3a', y: '#fbf236',
  o: '#df7126', p: '#8f56c9', P: '#5b2f8a', e: '#9badb7', E: '#5c6b78', m: '#b0a08f', M: '#6f6559',
  u: '#c27b3e', i: '#d6d6e0', l: '#7bd5f5', n: '#e8b796', x: '#4a3a2a',
};

const SPRITES: Record<string, string[]> = {
  worker: [
    '..hhhh..',
    '.hhhhhh.',
    '.ssssss.',
    '.skssks.',
    '.bbbbbb.',
    '.bbbbbb.',
    'cccbbccc',
    '.cccccc.',
    '.CC..CC.',
    '.kk..kk.',
  ],
  pick: [
    '.eee.',
    'e.b.e',
    '..b..',
    '..b..',
    '..b..',
  ],
  sword: [
    '...i',
    '..i.',
    '.i..',
    'u...',
  ],
  rat: [
    '..........',
    '.nn.......',
    '.Mmmmmm...',
    'Mkmmmmmm..',
    'mmmmmmmmm.',
    '.mmmmmmm.n',
    '..M..M..nn',
  ],
  slime: [
    '...gggg...',
    '..gggggg..',
    '.ggwgggwg.',
    '.ggkgggkg.',
    'gggggggggg',
    'gggGGGGggg',
    'GGGGGGGGGG',
    '.GGGGGGGG.',
  ],
  bat: [
    'P..........P',
    'PP..PPPP..PP',
    'PPPPrPPrPPPP',
    '.PPPPPPPPPP.',
    '..PP.PP.PP..',
    '...P....P...',
  ],
  goblin: [
    'g......g',
    '.gggggg.',
    '.gyggyg.',
    '.gggggg.',
    '..gkkg..',
    '.BBBBBB.',
    'gBBBBBBg',
    '.BBBBBB.',
    '.BB..BB.',
    '.kk..kk.',
  ],
  kobold: [
    '.......o',
    '.oooo..o',
    'oyoooo.o',
    'ooooooo.',
    '..oooo..',
    '.oRRRo..',
    'oooRRoo.',
    '..oooo..',
    '..o..o..',
    '.oo..oo.',
  ],
  shroom: [
    '...rrrr...',
    '.rrwrrrrr.',
    'rrrrrrwrrr',
    'rwrrrrrrrr',
    '.mmmmmmmm.',
    '...mkmk...',
    '...mmmm...',
    '..mmmmmm..',
    '..mmmmmm..',
    '...m..m...',
    '...k..k...',
  ],
  troll: [
    '...GGGGGG...',
    '..GGGGGGGG..',
    '..GyGGGGyG..',
    '..GGGGGGGG..',
    '..GwGwwGwG..',
    '...GGGGGG...',
    '.GGGGGGGGGG.',
    'GGGGGGGGGGGG',
    'GG.GGGGGG.GG',
    'GG.GGGGGG.GG',
    '...BBBBBB...',
    '...GG..GG...',
    '...GG..GG...',
    '..GGG..GGG..',
  ],
  worm: [
    '....nnnnn.....',
    '..nnnnnnnnn...',
    '.nnkwnnnnnnn..',
    'nnnkknnnnnnnn.',
    'nnnnnnnnnnnnnn',
    '.rrrnnnnnnnnnn',
    '..rrnnn..nnnnn',
    '.........nnnnn',
    '........nnnnn.',
    '.......nnnn...',
  ],
  golem: [
    '...MMMMMM...',
    '..MmmmmmmM..',
    '..MmllmlmM..',
    '..MmmmmmmM..',
    '...MMMMMM...',
    '.MMmmmmmmMM.',
    'MmmmMmmMmmmM',
    'MmmmmmmmmmmM',
    'MmM.mmmm.MmM',
    'MM..mMMm..MM',
    '....mm.mm...',
    '...MMM.MMM..',
  ],
  bed: [
    'w.........',
    'wrrrrrrrrr',
    'wrrrrrrrrr',
    'BBBBBBBBBB',
    'B........B',
  ],
  mush: [
    '.rrrr.',
    'rrwrrr',
    'rrrrwr',
    '..mm..',
    '..mm..',
    '.mmmm.',
  ],
  anvil: [
    'EEEEEEE..',
    '.eeeeeeee',
    '...eee...',
    '...EEE...',
    '..EEEEE..',
    '.EEEEEEE.',
  ],
  books: [
    'BBBBBBBBBB',
    'BrcgyprcgB',
    'BrcgyprcgB',
    'BBBBBBBBBB',
    'BgyrcpgyrB',
    'BgyrcpgyrB',
    'BBBBBBBBBB',
    'BcprgycprB',
    'BcprgycprB',
    'BBBBBBBBBB',
  ],
  crate: [
    'BBBBBBBB',
    'BoooooBB',
    'BoBooBoB',
    'BooBBooB',
    'BooBBooB',
    'BoBooBoB',
    'BBoooooB',
    'BBBBBBBB',
  ],
  barrel: [
    '.BBBBB.',
    'BoooooB',
    'EEEEEEE',
    'BoooooB',
    'BoooooB',
    'EEEEEEE',
    'BoooooB',
    '.BBBBB.',
  ],
  altar: [
    '....yy....',
    '...yyyy...',
    '....yy....',
    '..mmmmmm..',
    '.mmmmmmmm.',
    '..MmmmmM..',
    '..MmmmmM..',
    '.MMMMMMMM.',
  ],
  flag: [
    'Brrrr.',
    'Brrrrr',
    'Brrrr.',
    'B.....',
    'B.....',
    'B.....',
    'B.....',
    'BB....',
  ],
  mug: [
    '.www..',
    'yyyyB.',
    'yyyyyB',
    'yyyyyB',
    'yyyyB.',
    '.yyy..',
  ],
  fire: [
    '..y...',
    '.yoy..',
    '.oyoo.',
    'oorooo',
    'orrroo',
    '.rrrr.',
  ],
  hut: [
    '.....bbbb.....',
    '...bbbbbbbb...',
    '.bbbbbbbbbbbb.',
    'bbbbbbbbbbbbbb',
    '.mmmmmmmmmmmm.',
    '.mmBBmmmmyymm.',
    '.mmBBmmmmyymm.',
    '.mmBBmmmmmmmm.',
    '.mmBBmmmmmmmm.',
  ],
  i_food: ['.rrrr.', 'rrwrrr', 'rrrrwr', '..mm..', '..mm..', '.mmmm.'],
  i_stone: ['..mmm..', '.mmmmM.', 'mmmmmMM', 'mmmMmMM', '.mmMMM.', '..MMM..'],
  i_copper: ['..uuu..', '.uuuuo.', 'uuyuuoo', 'uuuouoo', '.uuooo.', '..ooo..'],
  i_iron: ['..iii..', '.iiiie.', 'iiwiiee', 'iiieiee', '.iieee.', '..eee..'],
  i_gold: ['..yyy..', '.yyyyy.', 'yyoyyyy', 'yyoyyyy', 'yyoyyyy', '.yyyyy.', '..yyy..'],
  i_know: ['.rrrrr.', 'rwwwwwr', 'rwkkkwr', 'rwwwwwr', 'rwkkkwr', 'rwwwwwr', '.rrrrr.'],
  i_favor: ['...y...', '...y...', '.yyyyy.', 'yyywyyy', '.yyyyy.', '..y.y..', '.y...y.'],
  i_pop: ['.hhhh.', 'hhhhhh', 'ssssss', 'skssks', 'bbbbbb', '.bbbb.'],
  i_relic: ['..ll..', '.lwll.', 'llllll', 'lllPll', '.lPPl.', '..PP..'],
  i_item: ['.BBBB.', 'BuuuuB', 'BuyyuB', 'BuuuuB', 'BBBBBB'],
};

const cache = new Map<string, HTMLCanvasElement>();

export function sprite(name: string, pal: Record<string, string> = {}): HTMLCanvasElement {
  const key = name + JSON.stringify(pal);
  let c = cache.get(key);
  if (c) return c;
  const rows = SPRITES[name] ?? SPRITES.slime;
  c = document.createElement('canvas');
  c.width = Math.max(...rows.map((r) => r.length));
  c.height = rows.length;
  const ctx = c.getContext('2d')!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      ctx.fillStyle = pal[ch] ?? PALETTE[ch] ?? '#ff00ff';
      ctx.fillRect(x, y, 1, 1);
    }
  });
  cache.set(key, c);
  return c;
}

/** Draw a sprite with its bottom-centre at (x, y). */
export function drawSprite(
  ctx: CanvasRenderingContext2D, name: string, x: number, y: number, scale: number,
  flip = false, pal: Record<string, string> = {},
) {
  const img = sprite(name, pal);
  const w = img.width * scale, h = img.height * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (flip) {
    ctx.translate(Math.round(x), 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, Math.round(-w / 2), Math.round(y - h), w, h);
  } else ctx.drawImage(img, Math.round(x - w / 2), Math.round(y - h), w, h);
  ctx.restore();
}

const urlCache = new Map<string, string>();
/** A data URL of a sprite, for use in <img> tags in the UI. */
export function iconUrl(name: string, pal: Record<string, string> = {}): string {
  const key = name + JSON.stringify(pal);
  let u = urlCache.get(key);
  if (u) return u;
  const src = sprite(name, pal);
  const c = document.createElement('canvas');
  const sc = 4;
  c.width = src.width * sc; c.height = src.height * sc;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  u = c.toDataURL();
  urlCache.set(key, u);
  return u;
}
export const icon = (name: string, pal?: Record<string, string>) => `<img class="ico" src="${iconUrl(name, pal)}" alt="">`;
