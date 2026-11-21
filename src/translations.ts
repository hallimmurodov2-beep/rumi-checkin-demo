// ---------------------------------------------------------------------------
// Guest-facing strings for the tablet demo: English (en), Russian (ru), Tajik (tg).
//
// TODO: review by a native Tajik speaker.
// The Tajik (tg) block below is a best-effort draft and has NOT been checked by
// a native speaker. Do not show it to guests until it has been reviewed.
// ---------------------------------------------------------------------------

export type Lang = 'en' | 'ru' | 'tg'

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'tg', label: 'Тоҷикӣ' },
]

const en = {
  stepPassport: 'Passport',
  stepBooking: 'Booking',
  stepDetails: 'Details',
  stepSignature: 'Signature',
  stepDone: 'Done',

  back: 'Back',
  continue: 'Continue',
  startOver: 'Start over',

  chooseLanguage: 'Choose your language',
  startCheckIn: 'Start check-in',
  checkOut: 'Check out',

  passportTitle: 'Scan your passport',
  passportHint: 'Place the photo page of your passport inside the frame.',
  frameLabel: 'Passport photo page',
  useDemoPassport: 'Use demo passport',
  reading: 'Reading passport...',
  noPassport: 'No passport? Enter booking number',
  bookingNumber: 'Booking number',
  bookingNumberHint: 'Any number works in this demo.',
  findBooking: 'Find my booking',
  scanInstead: 'Scan passport instead',
  passportNote:
    'Demo only: the camera is not used and no passport data is read or stored.',

  confirmTitle: 'Is this your booking?',
  guestName: 'Guest',
  source: 'Booked via',
  dates: 'Dates',
  room: 'Room',
  meals: 'Meals',
  nationality: 'Nationality',
  sampleDates: '21-24 Nov (3 nights)',
  sampleRoom: 'Deluxe Double Room',
  breakfastIncluded: 'Breakfast included',
  yesCorrect: 'Yes, this is correct',
  notMine: 'Not my booking',
  teamHelp: 'A team member will help you',
  teamHelpSub: 'Please come to the front desk. We will be with you shortly.',
  backToStart: 'Back to start',

  detailsTitle: 'A few details',
  phone: 'Phone number',
  email: 'Email address',
  shuttleTitle: 'Free airport shuttle',
  shuttleQ: 'Would you like a free shuttle to the airport when you leave?',
  yes: 'Yes',
  no: 'No',
  consent:
    'I agree that the hotel may process my details for my stay, as described in the privacy notice.',
  consentNeeded: 'Please accept to continue.',

  sigTitle: 'Please sign',
  sigHint: 'Sign with your finger inside the box.',
  signHere: 'Sign here',
  clear: 'Clear',
  sigNeeded: 'A signature is required to continue.',
  finish: 'Finish check-in',

  doneTitle: "You're checked in",
  doneSub: 'Please show your passport at the desk',
  wifiTitle: 'Wi-Fi',
  wifiNetwork: 'Network',
  wifiPassword: 'Password',
  breakfastTitle: 'Breakfast',
  breakfastInfo: 'Served daily 07:00 - 10:30 in the restaurant.',
  returning: 'Returning to the start in {n}s',
  startNew: 'Done',

  coTitle: 'Check-out',
  coBill: 'Your bill',
  coNights: 'Deluxe Double Room, 3 nights',
  coBreakfast: 'Breakfast',
  coBreakfastVal: 'Included',
  coMinibar: 'Minibar',
  coTax: 'City tax',
  coTotal: 'Total',
  coSample: 'Sample amounts, not a real bill.',
  rateTitle: 'How was your stay?',
  rateLabel: 'Rate {n} out of 5',
  reviewTitle: 'Thank you! Would you share it publicly?',
  reviewHint: 'Scan the code to leave a review.',
  qrPlaceholder: 'QR placeholder',
  feedbackTitle: 'We are sorry it was not perfect',
  feedbackHint:
    'Tell us privately what we could improve. Only the hotel team will see this.',
  feedbackPlaceholder: 'Your feedback',
  confirmCheckout: 'Complete check-out',
  thanksTitle: 'Thank you, safe travels',
  thanksSub: 'Your check-out is complete. Please leave your key card at the desk.',

  idleWarn: 'Returning to the start in {n}s',
  idleTouch: 'Touch the screen to stay.',
}

export type Key = keyof typeof en
type Dict = Record<Key, string>

const ru: Dict = {
  stepPassport: 'Паспорт',
  stepBooking: 'Бронь',
  stepDetails: 'Данные',
  stepSignature: 'Подпись',
  stepDone: 'Готово',

  back: 'Назад',
  continue: 'Продолжить',
  startOver: 'Начать заново',

  chooseLanguage: 'Выберите язык',
  startCheckIn: 'Начать заселение',
  checkOut: 'Выселение',

  passportTitle: 'Отсканируйте паспорт',
  passportHint: 'Поместите страницу паспорта с фотографией в рамку.',
  frameLabel: 'Страница паспорта с фото',
  useDemoPassport: 'Использовать демо-паспорт',
  reading: 'Считываем паспорт...',
  noPassport: 'Нет паспорта? Введите номер брони',
  bookingNumber: 'Номер брони',
  bookingNumberHint: 'В демо подойдёт любой номер.',
  findBooking: 'Найти мою бронь',
  scanInstead: 'Сканировать паспорт',
  passportNote:
    'Только демо: камера не используется, данные паспорта не считываются и не сохраняются.',

  confirmTitle: 'Это ваша бронь?',
  guestName: 'Гость',
  source: 'Источник брони',
  dates: 'Даты',
  room: 'Номер',
  meals: 'Питание',
  nationality: 'Гражданство',
  sampleDates: '21-24 ноября (3 ночи)',
  sampleRoom: 'Делюкс с двуспальной кроватью',
  breakfastIncluded: 'Завтрак включён',
  yesCorrect: 'Да, всё верно',
  notMine: 'Это не моя бронь',
  teamHelp: 'Вам поможет сотрудник отеля',
  teamHelpSub: 'Пожалуйста, подойдите к стойке регистрации. Мы скоро будем с вами.',
  backToStart: 'В начало',

  detailsTitle: 'Несколько данных',
  phone: 'Номер телефона',
  email: 'Электронная почта',
  shuttleTitle: 'Бесплатный трансфер в аэропорт',
  shuttleQ: 'Хотите бесплатный трансфер в аэропорт при выезде?',
  yes: 'Да',
  no: 'Нет',
  consent:
    'Я даю согласие на обработку моих данных отелем на время проживания в соответствии с уведомлением о конфиденциальности.',
  consentNeeded: 'Чтобы продолжить, необходимо согласие.',

  sigTitle: 'Поставьте подпись',
  sigHint: 'Распишитесь пальцем в поле ниже.',
  signHere: 'Подпись',
  clear: 'Очистить',
  sigNeeded: 'Для продолжения нужна подпись.',
  finish: 'Завершить заселение',

  doneTitle: 'Регистрация завершена',
  doneSub: 'Пожалуйста, предъявите паспорт на стойке регистрации',
  wifiTitle: 'Wi-Fi',
  wifiNetwork: 'Сеть',
  wifiPassword: 'Пароль',
  breakfastTitle: 'Завтрак',
  breakfastInfo: 'Ежедневно с 07:00 до 10:30 в ресторане.',
  returning: 'Возврат на главный экран через {n} с',
  startNew: 'Готово',

  coTitle: 'Выселение',
  coBill: 'Ваш счёт',
  coNights: 'Делюкс с двуспальной кроватью, 3 ночи',
  coBreakfast: 'Завтрак',
  coBreakfastVal: 'Включён',
  coMinibar: 'Минибар',
  coTax: 'Городской налог',
  coTotal: 'Итого',
  coSample: 'Примерные суммы, это не настоящий счёт.',
  rateTitle: 'Как вам понравилось у нас?',
  rateLabel: 'Оценка {n} из 5',
  reviewTitle: 'Спасибо! Поделитесь отзывом публично?',
  reviewHint: 'Отсканируйте код, чтобы оставить отзыв.',
  qrPlaceholder: 'Место для QR-кода',
  feedbackTitle: 'Нам жаль, что не всё было идеально',
  feedbackHint:
    'Расскажите нам лично, что можно улучшить. Это увидит только команда отеля.',
  feedbackPlaceholder: 'Ваш отзыв',
  confirmCheckout: 'Завершить выселение',
  thanksTitle: 'Спасибо, счастливого пути',
  thanksSub: 'Выселение завершено. Пожалуйста, оставьте ключ-карту на стойке.',

  idleWarn: 'Возврат на главный экран через {n} с',
  idleTouch: 'Коснитесь экрана, чтобы остаться.',
}

// TODO: review by a native Tajik speaker.
const tg: Dict = {
  stepPassport: 'Шиноснома',
  stepBooking: 'Брон',
  stepDetails: 'Маълумот',
  stepSignature: 'Имзо',
  stepDone: 'Анҷом',

  back: 'Бозгашт',
  continue: 'Идома',
  startOver: 'Аз нав оғоз кардан',

  chooseLanguage: 'Забонро интихоб кунед',
  startCheckIn: 'Оғози сабти ном',
  checkOut: 'Баромадан',

  passportTitle: 'Шиносномаи худро скан кунед',
  passportHint: 'Саҳифаи шиносномаро бо акс дар даруни чорчӯба ҷойгир кунед.',
  frameLabel: 'Саҳифаи шиноснома бо акс',
  useDemoPassport: 'Шиносномаи намунавӣ',
  reading: 'Шиноснома хонда мешавад...',
  noPassport: 'Шиноснома надоред? Рақами бронро ворид кунед',
  bookingNumber: 'Рақами брон',
  bookingNumberHint: 'Дар ин намуна ҳар рақам мувофиқ аст.',
  findBooking: 'Бронамро ёбед',
  scanInstead: 'Скан кардани шиноснома',
  passportNote:
    'Танҳо намуна: камера истифода намешавад ва маълумоти шиноснома хонда ё нигоҳ дошта намешавад.',

  confirmTitle: 'Ин бронии шумост?',
  guestName: 'Меҳмон',
  source: 'Брон тавассути',
  dates: 'Санаҳо',
  room: 'Ҳуҷра',
  meals: 'Хӯрок',
  nationality: 'Шаҳрвандӣ',
  sampleDates: '21-24 ноябр (3 шаб)',
  sampleRoom: 'Ҳуҷраи Deluxe бо кати дунафара',
  breakfastIncluded: 'Наҳорӣ дохил аст',
  yesCorrect: 'Ҳа, дуруст аст',
  notMine: 'Ин брони ман нест',
  teamHelp: 'Кормандони меҳмонхона ба шумо кӯмак мекунанд',
  teamHelpSub: 'Лутфан ба мизи қабул биёед. Мо ба зудӣ бо шумо хоҳем буд.',
  backToStart: 'Ба оғоз',

  detailsTitle: 'Чанд маълумот',
  phone: 'Рақами телефон',
  email: 'Суроғаи почтаи электронӣ',
  shuttleTitle: 'Трансфери ройгон ба фурудгоҳ',
  shuttleQ: 'Оё ҳангоми баромад трансфери ройгон ба фурудгоҳ мехоҳед?',
  yes: 'Ҳа',
  no: 'Не',
  consent:
    'Ман розигӣ медиҳам, ки меҳмонхона маълумоти маро барои муддати иқомат мувофиқи огоҳиномаи махфият коркард кунад.',
  consentNeeded: 'Барои идома додан розигӣ лозим аст.',

  sigTitle: 'Лутфан имзо гузоред',
  sigHint: 'Бо ангушт дар қуттии зер имзо гузоред.',
  signHere: 'Имзо',
  clear: 'Тоза кардан',
  sigNeeded: 'Барои идома додан имзо лозим аст.',
  finish: 'Анҷоми сабти ном',

  doneTitle: 'Сабти номи шумо анҷом ёфт',
  doneSub: 'Лутфан шиносномаро дар мизи қабул нишон диҳед',
  wifiTitle: 'Wi-Fi',
  wifiNetwork: 'Шабака',
  wifiPassword: 'Рамз',
  breakfastTitle: 'Наҳорӣ',
  breakfastInfo: 'Ҳар рӯз аз 07:00 то 10:30 дар тарабхона.',
  returning: 'Бозгашт ба саҳифаи аввал баъд аз {n} сония',
  startNew: 'Тайёр',

  coTitle: 'Баромад',
  coBill: 'Ҳисоби шумо',
  coNights: 'Ҳуҷраи Deluxe бо кати дунафара, 3 шаб',
  coBreakfast: 'Наҳорӣ',
  coBreakfastVal: 'Дохил аст',
  coMinibar: 'Минибар',
  coTax: 'Андози шаҳрӣ',
  coTotal: 'Ҷамъ',
  coSample: 'Маблағҳои намунавӣ, ин ҳисоби воқеӣ нест.',
  rateTitle: 'Иқомат дар меҳмонхонаи мо чӣ гуна буд?',
  rateLabel: 'Баҳо {n} аз 5',
  reviewTitle: 'Ташаккур! Мехоҳед фикри худро ошкоро нависед?',
  reviewHint: 'Барои гузоштани фикр рамзро скан кунед.',
  qrPlaceholder: 'Ҷои рамзи QR',
  feedbackTitle: 'Афсӯс, ки ҳама чиз комил набуд',
  feedbackHint:
    'Ба мо шахсӣ нависед, ки чиро беҳтар кардан мумкин аст. Инро танҳо дастаи меҳмонхона мебинад.',
  feedbackPlaceholder: 'Фикри шумо',
  confirmCheckout: 'Анҷоми баромад',
  thanksTitle: 'Ташаккур, роҳи сафед',
  thanksSub: 'Баромади шумо анҷом ёфт. Лутфан корти калидро дар мизи қабул гузоред.',

  idleWarn: 'Бозгашт ба саҳифаи аввал баъд аз {n} сония',
  idleTouch: 'Барои мондан ба экран даст расонед.',
}

export const translations: Record<Lang, Dict> = { en, ru, tg }
