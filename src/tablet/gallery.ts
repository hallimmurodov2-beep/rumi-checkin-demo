// Hotel photos shown by the welcome-screen screensaver (files in public/gallery,
// converted from assets/ by sharp). Captions in English, Russian and Tajik.
// TODO: review the Tajik captions with a native speaker.

export interface Slide {
  src: string
  en: string
  ru: string
  tg: string
}

const CAPTIONS = {
  entrance: ['Entrance', 'Вход', 'Даромадгоҳ'],
  lobby: ['Lobby', 'Лобби', 'Толори қабул'],
  double: ['Deluxe Double Room', 'Делюкс с двуспальной кроватью', 'Ҳуҷраи Deluxe бо кати дунафара'],
  twin: ['Deluxe Twin Room', 'Делюкс с двумя кроватями', 'Ҳуҷраи Deluxe бо ду кат'],
  suite: ['Executive Suite', 'Представительский люкс', 'Люкси Executive'],
  restaurant: ['Restaurant', 'Ресторан', 'Тарабхона'],
  buffet: ['Breakfast buffet', 'Шведский стол', 'Мизи наҳорӣ'],
  corridor: ['Guest floors', 'Жилые этажи', 'Ошёнаҳои меҳмонон'],
  conference: ['Conference hall', 'Конференц-зал', 'Толори конфронс'],
} as const

const s = (file: string, key: keyof typeof CAPTIONS): Slide => {
  const [en, ru, tg] = CAPTIONS[key]
  return { src: `/gallery/${file}.webp`, en, ru, tg }
}

// Alternates public spaces and rooms so the loop never shows two similar shots in a row.
export const SLIDES: Slide[] = [
  s('entrance', 'entrance'),
  s('lobby', 'lobby'),
  s('deluxe-double-room', 'double'),
  s('restaurant', 'restaurant'),
  s('executive-suite1', 'suite'),
  s('lobby1', 'lobby'),
  s('deluxe-twin-room', 'twin'),
  s('buffet-bar', 'buffet'),
  s('executive-suite2', 'suite'),
  s('corridor', 'corridor'),
  s('deluxe-double-room1', 'double'),
  s('restaurant1', 'restaurant'),
  s('conference-hall', 'conference'),
  s('deluxe-twin-room1', 'twin'),
  s('deluxe-double-room2', 'double'),
  s('conference-hall1', 'conference'),
]
