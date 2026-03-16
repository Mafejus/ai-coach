# Claude Code — Opravy synchronizace a dat

## Kontext
Přečti si `architecture.md`. Aplikace běží, ale má několik problémů se synchronizací dat.

---

## 1. Deduplikace aktivit (Strava vs Garmin)

**Problém:** Každá aktivita se zobrazuje dvakrát — jednou z Garminu, jednou ze Stravy.

**Řešení:**
- Strava aktivity synchronizuj POUZE do 6. března 2026 (včetně). Aktivity po tomto datu ze Stravy IGNORUJ.
- Garmin aktivity synchronizuj VŠECHNY (bez omezení).
- V sync logice pro Stravu přidej filtr: `if (activity.date > new Date('2026-03-06')) skip`
- Na Activities stránce: pokud existují dvě aktivity se stejným datem (±10 minut) a podobnou vzdáleností (±15%), zobraz pouze jednu (preferuj tu s více daty — obvykle Garmin pokud má HR, Training Effect atd.)
- Přidej utilitu na vyčištění existujících duplikátů v DB: `POST /api/admin/deduplicate` — projde všechny aktivity a smaže duplicity

## 2. Kalendář — špatné datum (posunuté o 1 den)

**Problém:** Události z Google Calendar se zobrazují o den posunuté (např. event 15.3. se zobrazí jako 16.3.).

**Řešení:**
- Problém je pravděpodobně v timezone konverzi. Google Calendar vrací časy v UTC nebo v timezone kalendáře.
- Při parsování eventů: používej timezone uživatele (Europe/Prague) pro konverzi, ne UTC.
- Zkontroluj `packages/calendar/src/parsers.ts` — při vytváření `startTime` a `endTime` musíš správně zachovat timezone.
- Pro celodenní události (isAllDay=true): Google vrací datum bez času — nekonvertuj na UTC, použij přímo jako lokální datum.
- Ověř fix: event vytvořený na 15.3. v Google Calendar se musí zobrazit na 15.3. v naší aplikaci.

## 3. Kalendář — synchronizovat i minulé události

**Problém:** Synchronizují se pouze budoucí události. Chci i minulé.

**Řešení:**
- Při calendar sync stahuj události za období: 30 dní zpět až 30 dní dopředu (celkem 60 dní).
- Uprav `calendar-sync` job i manuální `/api/sync/calendar` endpoint.
- `timeMin` = dnes - 30 dní
- `timeMax` = dnes + 30 dní

## 4. Garmin health metriky — neúplné a špatné

**Problém:** Z Garminu se synchronizuje jen pár metrik (Body Battery, klidová HR, stress — a to jen jeden datový bod), chybí spánek, HRV, Training Readiness. Data se synchronizují jen jednou.

**Řešení — kompletní přepis Garmin sync:**

### A) Health metriky — stáhni za posledních 14 dní, KAŽDÝ den zvlášť:

```typescript
// Pro každý den v rozmezí (dnes - 14 dní) až včerejšek:
for (const date of dateRange) {
  // 1. Sleep data
  const sleep = await garmin.getSleep(date);
  // Parsuj: sleepScore, sleepDuration (min), deepSleep (min), remSleep (min), 
  //         lightSleep (min), awakeDuration (min), sleepStart, sleepEnd

  // 2. HRV data
  const hrv = await garmin.getHRVData(date);
  // Parsuj: hrvStatus (overnight avg ms), hrvBaseline (7-day baseline)

  // 3. User Summary (Body Battery, Stress, Training Readiness)
  const summary = await garmin.getUserSummary(date);
  // Parsuj: bodyBattery (ranní hodnota), stressScore (denní průměr),
  //         trainingReadiness, restingHR

  // 4. VO2max
  // Parsuj z summary nebo z getTrainingStatus pokud je dostupné

  // 5. Upsert do health_metrics (jeden záznam na den)
  await db.healthMetric.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...parsedMetrics },
    update: { ...parsedMetrics },
  });

  // RATE LIMITING: počkej 2 sekundy mezi requesty
  await sleep(2000);
}
```

### B) Parsery — oprav `packages/garmin/src/parsers.ts`:

Garmin API vrací data v různých formátech. Hlavní problémy:
- Sleep duration může být v milisekundách (ne minutách) — detekuj a převeď
- Body Battery: hledej ranní hodnotu (ne průměr) — `startTimestampGMT` nejblíže k probuzení
- HRV: `hrvSummary.lastNight.hrvValue` nebo `hrvSummary.weeklyAvg`
- Training Readiness: `trainingReadinessScore` nebo `score`
- Stress: `overallStressLevel` nebo `averageStressLevel` (0-100, nižší = lepší)

### C) Aktivity z Garminu — stáhni detailnější data:

Pro každou aktivitu stáhni i:
- Laps/splits (pokud jsou dostupné)
- Training Effect (aerobic + anaerobic)
- Recovery time
- Uložení do `rawData` JSON pole pro budoucí use

## 5. Sync frekvence — každých 5 minut

**Problém:** Data se synchronizují jen jednou (manuálně). Chci automatický sync.

**Řešení:**
- V `apps/worker/src/schedules.ts` nastav cron joby:
  - `garmin-sync`: každých 5 minut (`*/5 * * * *`) — ale stahuj jen dnešní data (ne 14 dní)
  - `calendar-sync`: každých 15 minut (`*/15 * * * *`)
  - `strava-sync`: každých 30 minut (`*/30 * * * *`) — Strava má přísnější rate limits
- Quick sync (každých 5 min): stáhni jen DNEŠNÍ health metriky + nové aktivity za poslední hodinu
- Full sync (každé 2 hodiny): stáhni zdravotní metriky za posledních 3 dny + všechny nové aktivity
- Implementuj `lastSyncAt` timestamp v DB (přidej do User modelu) aby se nestahovala stále stejná data

### Worker entry point update:
```typescript
// Quick sync - každých 5 minut
scheduler.add('garmin-quick-sync', { cron: '*/5 * * * *', data: { mode: 'quick' } });
scheduler.add('calendar-sync', { cron: '*/15 * * * *' });

// Full sync - každé 2 hodiny
scheduler.add('garmin-full-sync', { cron: '0 */2 * * *', data: { mode: 'full' } });
scheduler.add('strava-sync', { cron: '0 */2 * * *' });
```

### Garmin rate limiting:
- Max 1 request / 2 sekundy (povinné)
- Quick sync = max 3-5 API callů (dnešní summary, sleep, HRV)
- Full sync = může trvat déle, ale respektuj rate limit
- Pokud Garmin vrátí 429 (too many requests): zastav sync, zkus za 5 minut

## 6. Synchronizace závodů z Garminu

**Problém:** Závody zadané v Garmin Connect se nesynchronizují.

**Řešení:**
- Přidej do Garmin clientu metodu `getEvents()` nebo `getRaceCalendar()` — záleží co garmin-connect knihovna podporuje
- Pokud knihovna nepodporuje stahování závodů, přidej možnost manuálního zadání v UI (to už máme v Events stránce)
- Pokud podporuje: synchronizuj závody do `events` tabulky s `source: 'GARMIN'`
- Deduplikace: pokud závod se stejným názvem a datem už existuje, nezduplikuj

## 7. Settings — Sync status a ovládání

Na Settings stránku přidej sekci zobrazující:
- Poslední sync: datum a čas posledního úspěšného syncu pro každou službu
- Sync status: zelená tečka = OK, červená = chyba, šedá = nepropojeno
- Tlačítka pro manuální sync jednotlivých služeb
- Tlačítko "Full sync" — stáhne kompletní data za posledních 30 dní
- Log: posledních 5 sync výsledků (čas, počet stažených záznamů, chyby)

---

## Technické požadavky
- Po všech opravách spusť `npx turbo build` a ověř že projde bez chyb
- Otestuj: spusť sync a ověř že health_metrics tabulka obsahuje záznamy za posledních 14 dní
- Otestuj: kalendářní události mají správná data (ne posunutá o den)
- Otestuj: žádné duplicitní aktivity
- Worker musí startovat bez chyb a cron joby musí běžet
