// Hotel photos shown by the welcome-screen screensaver (files in public/gallery,
// converted from assets/ by sharp). Captions in English, Russian and Tajik.
// TODO: review the Tajik captions with a native speaker.

export type Category = 'rooms' | 'dining' | 'spaces' | 'wellness'

export interface Slide {
  src: string
  /** Small copy for the filmstrip (public/gallery/thumbs, 240x160). */
  thumb: string
  en: string
  ru: string
  tg: string
  cat: Category
  /** Taller than wide: shown whole over a blurred copy instead of being cropped to the wide screen. */
  portrait: boolean
}

const CAPTIONS = {
  entrance: ['Entrance', 'Вход', 'Даромадгоҳ', 'spaces'],
  lobby: ['Lobby', 'Лобби', 'Толори қабул', 'spaces'],
  double: ['Deluxe Double Room', 'Делюкс с двуспальной кроватью', 'Ҳуҷраи Deluxe бо кати дунафара', 'rooms'],
  twin: ['Deluxe Twin Room', 'Делюкс с двумя кроватями', 'Ҳуҷраи Deluxe бо ду кат', 'rooms'],
  suite: ['Executive Suite', 'Представительский люкс', 'Люкси Executive', 'rooms'],
  restaurant: ['Restaurant', 'Ресторан', 'Тарабхона', 'dining'],
  buffet: ['Breakfast buffet', 'Шведский стол', 'Мизи наҳорӣ', 'dining'],
  corridor: ['Guest floors', 'Жилые этажи', 'Ошёнаҳои меҳмонон', 'spaces'],
  conference: ['Conference hall', 'Конференц-зал', 'Толори конфронс', 'spaces'],
  floor2: ['Second floor', 'Второй этаж', 'Ошёнаи дуюм', 'spaces'],
  king: ['Deluxe King Room', 'Делюкс с кроватью king-size', 'Ҳуҷраи Deluxe бо кати king', 'rooms'],
  pool: ['Swimming pool', 'Бассейн', 'Ҳавзи шиноварӣ', 'wellness'],
  gym: ['Fitness centre', 'Тренажёрный зал', 'Толори варзишӣ', 'wellness'],
} as const

const s = (file: string, key: keyof typeof CAPTIONS, portrait = false): Slide => {
  const [en, ru, tg, cat] = CAPTIONS[key]
  return { src: `/gallery/${file}.webp`, thumb: `/gallery/thumbs/${file}.webp`, en, ru, tg, cat, portrait }
}

// Alternates public spaces and rooms so the loop never shows two similar shots in a row.
export const SLIDES: Slide[] = [
  s('entrance', 'entrance'),
  s('lobby', 'lobby'),
  s('deluxe-double-room', 'double'),
  s('pool', 'pool', true),
  s('restaurant', 'restaurant'),
  s('executive-suite1', 'suite'),
  s('lobby-atrium', 'lobby', true),
  s('deluxe-twin-room', 'twin'),
  s('buffet-bar', 'buffet'),
  s('gym', 'gym', true),
  s('executive-suite2', 'suite'),
  s('second-floor', 'floor2'),
  s('deluxe-king-room', 'king'),
  s('restaurant1', 'restaurant'),
  s('conference-hall', 'conference'),
  s('executive-suite3', 'suite', true),
  s('deluxe-twin-room1', 'twin'),
  s('corridor', 'corridor'),
  s('deluxe-double-room1', 'double'),
  s('restaurant3', 'restaurant', true),
  s('conference-hall2', 'conference', true),
  s('deluxe-double-room2', 'double'),
  s('lobby1', 'lobby'),
  s('conference-hall1', 'conference'),
]

/** Photo of a room type, for the check-in Done screen. Matches eZee names like "Deluxe Double" or "Executive Suite". */
export function roomTypePhoto(roomType: string | null | undefined): Slide | null {
  const t = (roomType ?? '').toLowerCase()
  // «Делюкс» is Deluxe. Only a standalone «люкс» (or Tajik «люкси») means suite.
  const file = /suite|(?:^|[^\p{L}])люкси?(?!\p{L})/u.test(t)
    ? 'executive-suite1'
    : /twin|2 ?beds|двумя|ду кат/.test(t)
      ? 'deluxe-twin-room'
      : /king/.test(t)
        ? 'deluxe-king-room'
        : /double|queen|двусп|дунафара/.test(t)
          ? 'deluxe-double-room'
          : null
  return file ? SLIDES.find((sl) => sl.src === `/gallery/${file}.webp`) ?? null : null
}
