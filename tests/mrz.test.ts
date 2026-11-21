import { strict as assert } from 'node:assert'
import { checkDigit, parseMrz, reconcileNames } from '../src/lib/mrz.ts'

// ICAO 9303 specimen passport (TD3)
const td3 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10'
const r = parseMrz(td3)!
assert.ok(r, 'td3 parsed')
assert.equal(r.valid, true)
assert.equal(r.surname, 'ERIKSSON')
assert.equal(r.givenNames, 'ANNA MARIA')
assert.equal(r.documentNumber, 'L898902C3')
assert.equal(r.nationality, 'UTO')
assert.equal(r.birthDate, '1974-08-12')
assert.equal(r.expiryDate, '2012-04-15')
assert.equal(r.sex, 'F')
assert.equal(checkDigit('L898902C3'), 6)

// Same specimen with typical OCR noise: spaces, O instead of 0, K filler, junk lines around it.
const noisy = 'REPUBLIC OF UTOPIA\nP<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<KKKKK<<<<<\nL898902C36UTO74O8122F12O4159ZE184226B<<<<<1O\nfoo'
const n = parseMrz(noisy)!
assert.ok(n && n.valid, 'noisy td3 valid')
assert.equal(n.birthDate, '1974-08-12')
assert.equal(n.givenNames, 'ANNA MARIA')

// Document number with an OCR letter/digit swap fixed by its check digit (C3 read as G3? use 0/O in doc no.)
const swapped = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL8989O2C36UTO7408122F1204159ZE184226B<<<<<10'
const s = parseMrz(swapped)!
assert.ok(s && s.valid, 'doc number corrected')
assert.equal(s.documentNumber, 'L898902C3')

// ICAO TD1 specimen ID card
const td1 = 'I<UTOD231458907<<<<<<<<<<<<<<<\n7408122F1204159UTO<<<<<<<<<<<6\nERIKSSON<<ANNA<MARIA<<<<<<<<<<'
const t = parseMrz(td1)!
assert.ok(t && t.valid, 'td1 valid')
assert.equal(t.documentNumber, 'D23145890')
assert.equal(t.surname, 'ERIKSSON')

// Wrong check digit must not validate
assert.equal(parseMrz('P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C37UTO7408122F1204159ZE184226B<<<<<10'), null)
// Real OCR output seen in testing: filler read as L/K, Z read as 7, O as 0.
const ocr1 = parseMrz('P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<LLLLLLLLLLK\nL898902C36UT07408122F12041597E184226B<<<<<10')!
assert.ok(ocr1 && ocr1.valid, 'ocr1 valid')
assert.equal(ocr1.givenNames, 'ANNA MARIA')
assert.equal(ocr1.nationality, 'UTO')
const ocr2 = parseMrz('P<UTOERIKSSON<<ANNA<KMARIALLLLLLLLLLLLLLLLLKLKL\nL898902C36UT07408122F12041592E184226B<<<<<10')!
assert.ok(ocr2 && ocr2.valid, 'ocr2 valid')
assert.equal(ocr2.surname, 'ERIKSSON')
// Booking reconciliation fixes the stray K, and keeps names ending in L.
assert.equal(reconcileNames(ocr2, 'Anna Maria Eriksson').givenNames, 'ANNA MARIA')
assert.equal(reconcileNames({ ...ocr2, givenNames: 'MICHAE' }, 'Michael Eriksson').givenNames, 'MICHAEL')
assert.equal(reconcileNames({ ...ocr2, givenNames: 'JOHN' }, 'Jon Smith').givenNames, 'JOHN', 'a real spelling difference is kept')
console.log('mrz tests passed')
