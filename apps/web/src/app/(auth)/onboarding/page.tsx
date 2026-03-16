'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronLeft, CheckCircle, Loader2 } from 'lucide-react';

// Steps: 1=BasicInfo, 2=FitnessProfile, 3=ConnectServices, 4=MainEvent, 5=InitialSync
// Each step saves data via API calls

interface OnboardingData {
  // Step 1
  name: string;
  timezone: string;
  // Step 2
  maxHR: string;
  restHR: string;
  ftp: string;
  thresholdPace: string;
  swimCSS: string;
  weeklyHoursMax: string;
  // Step 4
  eventName: string;
  eventDate: string;
  eventSport: string;
  eventDistance: string;
  eventTargetTime: string;
  hasEvent: boolean | null;
}

const STEPS = ['Základní info', 'Fitness profil', 'Propojení', 'Závod', 'Synchronizace'];
const TIMEZONES = ['Europe/Prague', 'Europe/Berlin', 'Europe/London', 'Europe/Warsaw', 'UTC'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    name: '', timezone: 'Europe/Prague',
    maxHR: '', restHR: '', ftp: '', thresholdPace: '', swimCSS: '', weeklyHoursMax: '',
    eventName: '', eventDate: '', eventSport: 'TRIATHLON', eventDistance: '', eventTargetTime: '',
    hasEvent: null,
  });

  const update = (field: keyof OnboardingData, value: string | boolean) =>
    setData(d => ({ ...d, [field]: value }));

  const saveStep = async (currentStep: number) => {
    setSaving(true);
    try {
      if (currentStep === 1) {
        await fetch('/api/settings/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: data.name, timezone: data.timezone }),
        });
      }
      if (currentStep === 2) {
        const body: Record<string, unknown> = {};
        if (data.maxHR) body.maxHR = parseInt(data.maxHR);
        if (data.restHR) body.restHR = parseInt(data.restHR);
        if (data.ftp) body.ftp = parseInt(data.ftp);
        if (data.thresholdPace) body.thresholdPace = parseInt(data.thresholdPace);
        if (data.swimCSS) body.swimCSS = parseInt(data.swimCSS);
        if (data.weeklyHoursMax) body.weeklyHoursMax = parseFloat(data.weeklyHoursMax);
        await fetch('/api/settings/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      if (currentStep === 4 && data.hasEvent && data.eventName && data.eventDate) {
        const timeToSeconds = (t: string) => {
          const parts = t.split(':').map(Number);
          if (parts.length === 3) return (parts[0]! * 3600) + (parts[1]! * 60) + (parts[2]!);
          return undefined;
        };
        await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.eventName,
            sport: data.eventSport,
            priority: 'MAIN',
            date: data.eventDate,
            distance: data.eventDistance ? parseFloat(data.eventDistance) : undefined,
            targetTime: data.eventTargetTime ? timeToSeconds(data.eventTargetTime) : undefined,
          }),
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const runInitialSync = async () => {
    setSaving(true);
    try {
      await fetch('/api/sync/all', { method: 'POST' });
      // Mark onboarding complete
      await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingCompleted: true }),
      });
      setSyncDone(true);
    } catch {
      setSyncDone(true); // Continue even if sync fails
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    await saveStep(step);
    if (step === 5) {
      router.push('/');
    } else {
      setStep(s => s + 1);
    }
  };

  const prev = () => setStep(s => Math.max(1, s - 1));

  const inputClass = "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelClass = "text-xs text-zinc-400 mb-1 block";

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="text-4xl mb-2">🏋️</div>
          <h1 className="text-xl font-bold text-zinc-100">Nastavení AI Coach</h1>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center flex-1">
              <div className={`flex items-center gap-1.5 ${i + 1 < step ? 'text-green-400' : i + 1 === step ? 'text-blue-400' : 'text-zinc-600'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${i + 1 < step ? 'bg-green-500/20 border-green-500/40' : i + 1 === step ? 'bg-blue-500/20 border-blue-500/40' : 'border-zinc-700'}`}>
                  {i + 1 < step ? '✓' : i + 1}
                </div>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-1 ${i + 1 < step ? 'bg-green-500/30' : 'bg-zinc-700'}`} />}
            </div>
          ))}
        </div>

        <p className="text-sm font-medium text-zinc-300">{STEPS[step - 1]}</p>

        {/* Step content */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Jméno</label>
              <input className={inputClass} placeholder="Jan Novák" value={data.name} onChange={e => update('name', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Časové pásmo</label>
              <select className={inputClass} value={data.timezone} onChange={e => update('timezone', e.target.value)}>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-500">Všechna pole jsou volitelná — AI trenér bude personalizovanější s více daty.</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'maxHR', label: 'Max HR (bpm)', placeholder: '190' },
                { key: 'restHR', label: 'Klidová HR (bpm)', placeholder: '45' },
                { key: 'ftp', label: 'FTP - kolo (W)', placeholder: '250' },
                { key: 'thresholdPace', label: 'Práh tempo (sec/km)', placeholder: '270' },
                { key: 'swimCSS', label: 'CSS - plavání (s/100m)', placeholder: '95' },
                { key: 'weeklyHoursMax', label: 'Max h/týden', placeholder: '10' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className={labelClass}>{label}</label>
                  <input type="number" className={inputClass} placeholder={placeholder} value={data[key as keyof OnboardingData] as string} onChange={e => update(key as keyof OnboardingData, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-400">Google Calendar byl automaticky propojen při přihlášení.</p>
            <div className="space-y-3">
              <a href="/api/auth/strava" className="flex items-center justify-between p-3 bg-zinc-800 border border-zinc-700 rounded-xl hover:border-orange-500/40 transition-colors">
                <div>
                  <p className="text-sm font-medium text-zinc-100">Strava</p>
                  <p className="text-xs text-zinc-400">Aktivity, laps, splits</p>
                </div>
                <span className="text-xs px-2.5 py-1 bg-orange-600 text-white rounded-lg">Propojit</span>
              </a>
              <div className="flex items-center justify-between p-3 bg-zinc-800 border border-zinc-700 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-zinc-100">Garmin Connect</p>
                  <p className="text-xs text-zinc-400">Spánek, HRV, Body Battery, aktivity</p>
                </div>
                <a href="/settings#garmin" className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Nastavit</a>
              </div>
            </div>
            <p className="text-xs text-zinc-500">Propojení lze přeskočit a nastavit later v Settings.</p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">Máš naplánovaný závod?</p>
            <div className="flex gap-3">
              {([true, false] as const).map(v => (
                <button key={String(v)} onClick={() => update('hasEvent', v)}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${data.hasEvent === v ? 'border-blue-500 bg-blue-500/20 text-blue-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                  {v ? 'Ano' : 'Ne'}
                </button>
              ))}
            </div>
            {data.hasEvent && (
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Název závodu</label>
                  <input className={inputClass} placeholder="Ironman 70.3 Zell am See" value={data.eventName} onChange={e => update('eventName', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Sport</label>
                    <select className={inputClass} value={data.eventSport} onChange={e => update('eventSport', e.target.value)}>
                      <option value="TRIATHLON">Triatlon</option>
                      <option value="RUN">Běh</option>
                      <option value="BIKE">Kolo</option>
                      <option value="SWIM">Plavání</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Datum</label>
                    <input type="date" className={inputClass} value={data.eventDate} onChange={e => update('eventDate', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Vzdálenost (km)</label>
                    <input type="number" className={inputClass} placeholder="113" value={data.eventDistance} onChange={e => update('eventDistance', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Cílový čas (H:MM:SS)</label>
                    <input className={inputClass} placeholder="5:30:00" value={data.eventTargetTime} onChange={e => update('eventTargetTime', e.target.value)} />
                  </div>
                </div>
              </div>
            )}
            {data.hasEvent === false && (
              <p className="text-sm text-zinc-400 bg-zinc-800/50 rounded-lg p-3">
                AI trenér se zaměří na obecné zlepšení kondice a konzistenci tréninku.
              </p>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4 text-center">
            {!syncDone ? (
              <>
                <p className="text-zinc-300">Spustíme úvodní synchronizaci dat ze všech propojených služeb.</p>
                <button
                  onClick={runInitialSync}
                  disabled={saving}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Synchronizuji...</> : 'Spustit synchronizaci'}
                </button>
                <button onClick={() => { setSyncDone(true); }} className="text-xs text-zinc-500 hover:text-zinc-300">Přeskočit</button>
              </>
            ) : (
              <div className="space-y-3">
                <CheckCircle className="h-12 w-12 text-green-400 mx-auto" />
                <p className="text-lg font-semibold text-zinc-100">Tvůj AI trenér je připravený! 🎉</p>
                <p className="text-sm text-zinc-400">Data jsou synchronizována. Přejdeme na dashboard.</p>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 1 && step < 5 && (
            <button onClick={prev} className="flex items-center gap-1 px-4 py-2.5 border border-zinc-700 text-zinc-400 rounded-xl hover:border-zinc-500 text-sm">
              <ChevronLeft className="h-4 w-4" />Zpět
            </button>
          )}
          {step < 5 && (
            <button
              onClick={next}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {step === 4 ? 'Pokračovat' : 'Další'}
              {!saving && <ChevronRight className="h-4 w-4" />}
            </button>
          )}
          {step === 5 && syncDone && (
            <button onClick={() => router.push('/')} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 text-sm">
              Přejít na Dashboard →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
