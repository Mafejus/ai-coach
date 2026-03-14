'use client';

import { useState } from 'react';
import { Settings, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface ProfileForm {
  maxHR: string;
  restHR: string;
  ftp: string;
  thresholdPace: string;
  swimCSS: string;
  weeklyHoursMax: string;
  morningReportTime: string;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileForm>({
    maxHR: '',
    restHR: '',
    ftp: '',
    thresholdPace: '',
    swimCSS: '',
    weeklyHoursMax: '',
    morningReportTime: '06:00',
  });

  const [garmin, setGarmin] = useState({ email: '', password: '' });
  const [saving, setSaving] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, 'ok' | 'error' | null>>({});

  const showStatus = (key: string, result: 'ok' | 'error') => {
    setStatus((s) => ({ ...s, [key]: result }));
    setTimeout(() => setStatus((s) => ({ ...s, [key]: null })), 3000);
  };

  const saveProfile = async () => {
    setSaving('profile');
    try {
      const body: Record<string, unknown> = {};
      if (profile.maxHR) body.maxHR = parseInt(profile.maxHR);
      if (profile.restHR) body.restHR = parseInt(profile.restHR);
      if (profile.ftp) body.ftp = parseInt(profile.ftp);
      if (profile.thresholdPace) body.thresholdPace = parseInt(profile.thresholdPace);
      if (profile.swimCSS) body.swimCSS = parseInt(profile.swimCSS);
      if (profile.weeklyHoursMax) body.weeklyHoursMax = parseFloat(profile.weeklyHoursMax);
      if (profile.morningReportTime) body.morningReportTime = profile.morningReportTime;

      const res = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      showStatus('profile', res.ok ? 'ok' : 'error');
    } catch {
      showStatus('profile', 'error');
    } finally {
      setSaving(null);
    }
  };

  const saveGarmin = async () => {
    setSaving('garmin');
    try {
      const res = await fetch('/api/settings/garmin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(garmin),
      });
      showStatus('garmin', res.ok ? 'ok' : 'error');
    } catch {
      showStatus('garmin', 'error');
    } finally {
      setSaving(null);
    }
  };

  const testGarmin = async () => {
    setSaving('garmin-test');
    try {
      const res = await fetch('/api/settings/garmin/test', { method: 'POST' });
      const data = await res.json() as { success: boolean };
      showStatus('garmin-test', data.success ? 'ok' : 'error');
    } catch {
      showStatus('garmin-test', 'error');
    } finally {
      setSaving(null);
    }
  };

  const StatusIcon = ({ k }: { k: string }) => {
    if (status[k] === 'ok') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status[k] === 'error') return <XCircle className="h-4 w-4 text-red-500" />;
    return null;
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Nastavení</h1>
      </div>

      {/* Propojené služby */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <h2 className="font-semibold text-foreground">Propojené služby</h2>

        {/* Google primární */}
        <div className="flex items-center justify-between py-2 border-b border-border">
          <div>
            <p className="text-sm font-medium text-foreground">Google účet (primární)</p>
            <p className="text-xs text-muted-foreground">Kalendář + přihlášení</p>
          </div>
          <a
            href="/api/auth/signin/google"
            className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
          >
            Propojit
          </a>
        </div>

        {/* Google školní */}
        <div className="flex items-center justify-between py-2 border-b border-border">
          <div>
            <p className="text-sm font-medium text-foreground">Google účet (škola)</p>
            <p className="text-xs text-muted-foreground">Školní kalendář</p>
          </div>
          <button
            className="text-xs px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md hover:opacity-90 transition-opacity"
            disabled
          >
            Brzy
          </button>
        </div>

        {/* Strava */}
        <div className="flex items-center justify-between py-2 border-b border-border">
          <div>
            <p className="text-sm font-medium text-foreground">Strava</p>
            <p className="text-xs text-muted-foreground">Aktivity, laps, splits</p>
          </div>
          <a
            href="/api/auth/strava"
            className="text-xs px-3 py-1.5 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
          >
            Propojit se Stravou
          </a>
        </div>

        {/* Garmin */}
        <div className="space-y-3 pt-2">
          <div>
            <p className="text-sm font-medium text-foreground">Garmin Connect</p>
            <p className="text-xs text-muted-foreground mb-2">Spánek, HRV, Body Battery, aktivity</p>
          </div>
          <input
            type="email"
            placeholder="Garmin email"
            value={garmin.email}
            onChange={(e) => setGarmin((g) => ({ ...g, email: e.target.value }))}
            className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            type="password"
            placeholder="Garmin heslo"
            value={garmin.password}
            onChange={(e) => setGarmin((g) => ({ ...g, password: e.target.value }))}
            className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex gap-2">
            <button
              onClick={saveGarmin}
              disabled={saving === 'garmin'}
              className="flex items-center gap-2 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving === 'garmin' && <Loader2 className="h-3 w-3 animate-spin" />}
              Uložit
              <StatusIcon k="garmin" />
            </button>
            <button
              onClick={testGarmin}
              disabled={saving === 'garmin-test'}
              className="flex items-center gap-2 text-xs px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving === 'garmin-test' && <Loader2 className="h-3 w-3 animate-spin" />}
              Test připojení
              <StatusIcon k="garmin-test" />
            </button>
          </div>
        </div>
      </div>

      {/* Fitness profil */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <h2 className="font-semibold text-foreground">Fitness profil</h2>

        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'maxHR', label: 'Max HR (bpm)', placeholder: '190' },
            { key: 'restHR', label: 'Klidová HR (bpm)', placeholder: '45' },
            { key: 'ftp', label: 'FTP - kolo (W)', placeholder: '250' },
            { key: 'thresholdPace', label: 'Threshold tempo (sec/km)', placeholder: '270' },
            { key: 'swimCSS', label: 'CSS - plavání (sec/100m)', placeholder: '95' },
            { key: 'weeklyHoursMax', label: 'Max h/týden', placeholder: '12' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-muted-foreground">{label}</label>
              <input
                type="number"
                placeholder={placeholder}
                value={profile[key as keyof ProfileForm]}
                onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          ))}
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Čas ranního reportu</label>
          <input
            type="time"
            value={profile.morningReportTime}
            onChange={(e) => setProfile((p) => ({ ...p, morningReportTime: e.target.value }))}
            className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <button
          onClick={saveProfile}
          disabled={saving === 'profile'}
          className="flex items-center gap-2 text-sm px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving === 'profile' && <Loader2 className="h-4 w-4 animate-spin" />}
          Uložit profil
          <StatusIcon k="profile" />
        </button>
      </div>
    </div>
  );
}
