interface WeeklyPlanInput {
  user: {
    name: string;
    maxHR?: number | null;
    restHR?: number | null;
    ftp?: number | null;
    thresholdPace?: number | null;
    swimCSS?: number | null;
    weeklyHoursMax?: number | null;
  };
  weekStart: string;
  recentActivities: Array<{
    sport: string;
    date: Date | string;
    duration: number;
    distance?: number | null;
    trainingLoad?: number | null;
    avgHR?: number | null;
  }>;
  calendar: Array<{
    title: string;
    startTime: Date | string;
    endTime: Date | string;
    isAllDay: boolean;
    category?: string | null;
  }>;
  injuries: Array<{
    bodyPart: string;
    severity: string;
    description: string;
    restrictions?: Record<string, unknown> | null;
  }>;
  events: Array<{
    name: string;
    sport: string;
    date: Date | string;
    daysUntil: number;
  }>;
  recentCompliance: number | null;
}

export function weeklyPlanPrompt(input: WeeklyPlanInput): string {
  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  };

  const activitiesSummary = input.recentActivities
    .slice(0, 20)
    .map(a => `- ${new Date(a.date).toLocaleDateString('cs-CZ')}: ${a.sport} ${formatDuration(a.duration)}${a.distance ? ` ${(a.distance / 1000).toFixed(1)}km` : ''}${a.trainingLoad ? ` TSS:${a.trainingLoad.toFixed(0)}` : ''}`)
    .join('\n');

  const calendarSummary = input.calendar.length > 0
    ? input.calendar
        .map(e => `- ${new Date(e.startTime).toLocaleString('cs-CZ')} – ${new Date(e.endTime).toLocaleString('cs-CZ')}: ${e.title} (${e.category ?? 'personal'})`)
        .join('\n')
    : 'Žádné události';

  const injuriesSummary = input.injuries.length > 0
    ? input.injuries.map(i => `- ${i.bodyPart}: ${i.description} (${i.severity})${i.restrictions ? ` — omezení: ${JSON.stringify(i.restrictions)}` : ''}`).join('\n')
    : 'Žádná';

  const eventsSummary = input.events.length > 0
    ? input.events.map(e => `- ${e.name} (${e.sport}) — za ${e.daysUntil} dní`).join('\n')
    : 'Žádné';

  return `
Jsi elitní triatlonový a běžecký trenér. Vytvoř týdenní tréninkový plán pro závodníka ${input.user.name}.

## PROFIL
- Max HR: ${input.user.maxHR ?? '?'} bpm | Klidová HR: ${input.user.restHR ?? '?'} bpm
- FTP: ${input.user.ftp ?? '?'}W | Práh (běh): ${input.user.thresholdPace ? `${Math.floor(input.user.thresholdPace / 60)}:${(input.user.thresholdPace % 60).toString().padStart(2, '0')}/km` : '?'}
- CSS (plavání): ${input.user.swimCSS ? `${Math.floor(input.user.swimCSS / 60)}:${(input.user.swimCSS % 60).toString().padStart(2, '0')}/100m` : '?'}
- Max hodin/týden: ${input.user.weeklyHoursMax ?? '?'}h
- Plnění minulého plánu: ${input.recentCompliance !== null ? `${input.recentCompliance.toFixed(0)}%` : 'N/A'}

## AKTIVITY ZA POSLEDNÍCH 4 TÝDNY
${activitiesSummary || 'Žádné'}

## KALENDÁŘ NA PLÁNOVANÝ TÝDEN (od ${input.weekStart})
${calendarSummary}

## AKTIVNÍ ZRANĚNÍ
${injuriesSummary}

## NADCHÁZEJÍCÍ ZÁVODY
${eventsSummary}

## PRAVIDLA
1. Nepřekroč max ${input.user.weeklyHoursMax ?? '?'}h/týden
2. Po tvrdém tréninku vždy easy nebo odpočinkový den
3. Respektuj kalendář — neplánuj tréninky na čas kalendářních událostí
4. Respektuj zranění — žádné sporty/pohyby zhoršující zranění
5. Týden začíná ${input.weekStart} (pondělí)

Vrať POUZE validní JSON bez markdown obalení v tomto přesném formátu:
{
  "weekStart": "${input.weekStart}",
  "phase": "BASE|BUILD|PEAK|TAPER",
  "focus": "Krátký popis zaměření týdne",
  "totalHours": 8.5,
  "totalTSS": 450,
  "days": [
    {
      "date": "YYYY-MM-DD",
      "dayOfWeek": "Pondělí",
      "isRestDay": false,
      "workouts": [
        {
          "id": "1",
          "sport": "RUN",
          "workoutType": "EASY",
          "title": "Regenerační běh",
          "description": "Pomalý běh v Z1-Z2, konverzační tempo",
          "duration": 60,
          "distance": 10,
          "intensity": "easy",
          "tss": 40,
          "completed": false
        }
      ],
      "notes": "Volitelná poznámka k dni"
    }
  ]
}
`.trim();
}
