export const PALETTES = {
  pico8: [
    '#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
    '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa',
  ],
  gameboy: [
    '#0f380f', '#306230', '#8bac0f', '#9bbc0f',
  ],
  nes: [
    '#000000', '#fcfcfc', '#bcbcbc', '#7c7c7c', '#a4e4fc', '#3cbcfc', '#0078f8', '#0000fc',
    '#d8b8f8', '#6888fc', '#0058f8', '#f8b8f8', '#f8b8b8', '#f8a4c0', '#f85898', '#f878f8',
    '#d8b8f8', '#58f898', '#00a800', '#00a844', '#008888', '#f8d878', '#f8b800', '#ffa044', '#f85800',
  ],
  c64: [
    '#000000', '#ffffff', '#880000', '#aaffee', '#cc44cc', '#00cc55', '#0000aa', '#eeee77',
    '#dd8855', '#664400', '#ff7777', '#333333', '#777777', '#aaff66', '#0088ff', '#bbbbbb',
  ],
} as const;

export type PaletteName = keyof typeof PALETTES;

