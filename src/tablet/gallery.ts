// Hotel photos shown by the welcome-screen screensaver (files in public/gallery,
// converted from assets/ by sharp). Captions in English, Russian and Tajik.
// TODO: review the Tajik captions with a native speaker.

export type Category = 'rooms' | 'dining' | 'spaces'

export interface Slide {
  src: string
  en: string
  ru: string
  tg: string
  cat: Category
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
} as const

const s = (file: string, key: keyof typeof CAPTIONS): Slide => {
  const [en, ru, tg, cat] = CAPTIONS[key]
  return { src: `/gallery/${file}.webp`, en, ru, tg, cat }
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

/** Photo of a room type, for the check-in Done screen. Matches eZee names like "Deluxe Double" or "Executive Suite". */
export function roomTypePhoto(roomType: string | null | undefined): Slide | null {
  const t = (roomType ?? '').toLowerCase()
  const file = /suite|люкс/.test(t)
    ? 'executive-suite1'
    : /twin|2 ?beds|двумя/.test(t)
      ? 'deluxe-twin-room'
      : /double|king|queen|двусп/.test(t)
        ? 'deluxe-double-room'
        : null
  return file ? SLIDES.find((sl) => sl.src === `/gallery/${file}.webp`) ?? null : null
}
