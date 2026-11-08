import ical from "node-ical";
import { describe, expect, it } from "vitest";
import { presencesDuMois } from "./presences";

// Un créneau récurrent le mercredi 13h30-18h30 (heure de Paris), avec une
// occurrence supprimée (EXDATE) et une occurrence décalée (RECURRENCE-ID),
// plus un événement journée entière qui ne doit pas compter.
const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//test//FR
BEGIN:VEVENT
UID:mercredi@test
DTSTART;TZID=Europe/Paris:20261007T133000
DTEND;TZID=Europe/Paris:20261007T183000
RRULE:FREQ=WEEKLY;BYDAY=WE
EXDATE;TZID=Europe/Paris:20261014T133000
SUMMARY:Garde
END:VEVENT
BEGIN:VEVENT
UID:mercredi@test
RECURRENCE-ID;TZID=Europe/Paris:20261021T133000
DTSTART;TZID=Europe/Paris:20261021T120000
DTEND;TZID=Europe/Paris:20261021T183000
SUMMARY:Garde (plus tôt)
END:VEVENT
BEGIN:VEVENT
UID:vacances@test
DTSTART;VALUE=DATE:20261026
DTEND;VALUE=DATE:20261031
SUMMARY:Vacances
END:VEVENT
END:VCALENDAR`;

describe("presencesDuMois", () => {
  it("déplie la récurrence, applique EXDATE et les occurrences modifiées, ignore les journées entières", () => {
    const { minutesParJour } = presencesDuMois(ical.sync.parseICS(ICS), "2026-10");
    expect(minutesParJour).toEqual({
      "2026-10-07": 300,
      "2026-10-21": 390,
      "2026-10-28": 300, // après le passage à l'heure d'hiver (25/10) : toujours 5 h
    });
  });
});
