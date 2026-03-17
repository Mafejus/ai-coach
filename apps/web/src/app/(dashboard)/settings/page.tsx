'use client';

import { useState, useEffect } from 'react';
import { Settings, CheckCircle, XCircle, Loader2, RefreshCw, Trash2 } from 'lucide-react';

// ── Sync types ────────────────────────────────────────────────
type SyncKey = 'garmin' | 'garmin/health' | 'strava' | 'calendar' | 'all';

interface SyncResult {
  success?: boolean;
  error?: string;
  total?: number;
  healthUpdated?: number;
  activitiesUpdated?: number;
  eventsUpdated?: number;
  garmin?: { success?: boolean; healthUpdated?: number; activitiesUpdated?: number; error?: string };
  strava?: { success?: boolean; activitiesUpdated?: number; error?: string };
  calendar?: { success?: boolean; eventsUpdated?: number; error?: string };
}

function syncSummary(key: SyncKey, result: SyncResult): string {
  if (result.error) return `Chyba: ${result.error}`;
  if (key === 'garmin/health') return `✓ ${result.healthUpdated ?? 0} zdravotních metrik`;
  if (key === 'garmin') return `✓ ${result.healthUpdated ?? 0} zdravotních + ${result.activitiesUpdated ?? 0} aktivit`;
  if (key === 'strava') return `✓ ${result.activitiesUpdated ?? 0} aktivit`;
  if (key === 'calendar') return `✓ ${result.eventsUpdated ?? 0} událostí`;
  if (key === 'all') {
    const g = result.garmin;
    const s = result.strava;
    const c = result.calendar;
    const parts = [];
    if (g?.success) parts.push(`Garmin: ${(g.healthUpdated ?? 0) + (g.activitiesUpdated ?? 0)}`);
    else if (g?.error) parts.push(`Garmin: chyba`);
    if (s?.success) parts.push(`Strava: ${s.activitiesUpdated ?? 0}`);
    else if (s?.error) parts.push(`Strava: chyba`);
    if (c?.success) parts.push(`Kal: ${c.eventsUpdated ?? 0}`);
    else if (c?.error) parts.push(`Kal: chyba`);
    return `✓ ${parts.join(' · ')}`;
  }
  return '✓ Hotovo';
}

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
  const [syncing, setSyncing] = useState<SyncKey | null>(null);
  const [syncResults, setSyncResults] = useState<Partial<Record<SyncKey, SyncResult>>>({});

  const [invites, setInvites] = useState<{ id: string; code: string; isValid: boolean; inviteUrl: string; usedAt: string | null; expiresAt: string }[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [inviteCreating, setInviteCreating] = useState(false);
  const [deduping, setDeduping] = useState(false);
  const [dedupResult, setDedupResult] = useState<{ deleted: number; checked: number } | null>(null);
  const [syncLog, setSyncLog] = useState<{ key: SyncKey; time: string; result: SyncResult }[]>([]);

  const [lastSync, setLastSync] = useState<string | null>(null);
 
  const loadInvites = async () => {
    setLoadingInvites(true);
    try {
      const res = await fetch('/api/invites');
      if (res.ok) setInvites(await res.json());
    } finally {
      setLoadingInvites(false);
    }
  };

  const loadLastSync = async () => {
    try {
      const res = await fetch('/api/health/metrics?take=1');
      const data = await res.json();
      if (data && data.length > 0) {
        setLastSync(data[0].updatedAt || data[0].createdAt);
      }
    } catch (e) {
      console.error('Failed to load last sync', e);
    }
  };
 
  const createInvite = async () => {
    setInviteCreating(true);
    try {
      const res = await fetch('/api/invites', { method: 'POST' });
      if (res.ok) await loadInvites();
    } finally {
      setInviteCreating(false);
    }
  };
 
  useEffect(() => { 
    loadInvites();
    loadLastSync();
  }, []);

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

  const runSync = async (key: SyncKey) => {
    setSyncing(key);
    setSyncResults(r => ({ ...r, [key]: undefined }));
    try {
      const res = await fetch(`/api/sync/${key}`, { method: 'POST' });
      const data = await res.json() as SyncResult;
      setSyncResults(r => ({ ...r, [key]: data }));
      setSyncLog(log => [{ key, time: new Date().toLocaleTimeString('cs-CZ'), result: data }, ...log].slice(0, 5));
    } catch {
      const err: SyncResult = { error: 'Síťová chyba' };
      setSyncResults(r => ({ ...r, [key]: err }));
      setSyncLog(log => [{ key, time: new Date().toLocaleTimeString('cs-CZ'), result: err }, ...log].slice(0, 5));
    } finally {
      setSyncing(null);
    }
  };

  const runDeduplicate = async () => {
    setDeduping(true);
    setDedupResult(null);
    try {
      const res = await fetch('/api/admin/deduplicate', { method: 'POST' });
      const data = await res.json() as { deleted: number; checked: number };
      setDedupResult(data);
    } catch {
      setDedupResult(null);
    } finally {
      setDeduping(false);
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
        <div className="space-y-3 pt-2" id="garmin">
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

      {/* Synchronizace dat */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-blue-400" />
          <h2 className="font-semibold text-zinc-100">Synchronizace dat</h2>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-400">Ručně spusť stažení dat z propojených služeb.</p>
          {lastSync && (
            <p className="text-[10px] text-zinc-500 uppercase">
              Poslední sync: {new Date(lastSync).toLocaleString('cs-CZ')}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(
            [
              { key: 'garmin/health' as SyncKey, label: 'Sync Garmin Health', desc: 'Spánek, HRV, Body Battery, Stress za 14 dní', color: 'bg-blue-700 hover:bg-blue-800' },
              { key: 'garmin' as SyncKey, label: 'Sync Garmin', desc: 'Health metriky + aktivity za 14 dní', color: 'bg-blue-600 hover:bg-blue-700' },
              { key: 'strava' as SyncKey, label: 'Sync Strava', desc: 'Aktivity za posledních 30 dní', color: 'bg-orange-600 hover:bg-orange-700' },
              { key: 'calendar' as SyncKey, label: 'Sync Kalendář', desc: 'Události na příštích 30 dní', color: 'bg-green-700 hover:bg-green-800' },
              { key: 'all' as SyncKey, label: 'Sync vše', desc: 'Garmin + Strava + Kalendář', color: 'bg-zinc-600 hover:bg-zinc-500' },
            ] as const
          ).map(({ key, label, desc, color }) => {
            const isRunning = syncing === key;
            const result = syncResults[key];
            return (
              <div key={key} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-2">
                <div>
                  <p className="text-sm font-medium text-zinc-100">{label}</p>
                  <p className="text-xs text-zinc-400">{desc}</p>
                </div>
                {result && (
                  <p className={`text-xs ${result.error ? 'text-red-400' : 'text-green-400'}`}>
                    {syncSummary(key, result)}
                  </p>
                )}
                <button
                  onClick={() => runSync(key)}
                  disabled={syncing !== null}
                  className={`flex items-center gap-2 text-xs px-3 py-1.5 ${color} text-white rounded-md disabled:opacity-50 transition-colors`}
                >
                  {isRunning
                    ? <><Loader2 className="h-3 w-3 animate-spin" />Probíhá...</>
                    : <><RefreshCw className="h-3 w-3" />{label}</>
                  }
                </button>
              </div>
            );
          })}
        </div>

        {/* Sync log */}
        {syncLog.length > 0 && (
          <div className="mt-4 space-y-1">
            <p className="text-xs text-zinc-500 font-medium">Poslední syncy</p>
            {syncLog.map((entry, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="text-zinc-600">{entry.time}</span>
                <span className="font-medium text-zinc-300">{entry.key}</span>
                <span className={entry.result.error ? 'text-red-400' : 'text-green-400'}>
                  {syncSummary(entry.key, entry.result)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Deduplicate */}
        <div className="mt-4 pt-4 border-t border-zinc-700 flex items-center gap-3">
          <button
            onClick={runDeduplicate}
            disabled={deduping}
            className="flex items-center gap-2 text-xs px-3 py-1.5 bg-red-900 hover:bg-red-800 text-white rounded-md disabled:opacity-50 transition-colors"
          >
            {deduping ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Odstraň duplikáty aktivit
          </button>
          {dedupResult && (
            <p className="text-xs text-zinc-400">
              Zkontrolováno {dedupResult.checked} aktivit, smazáno {dedupResult.deleted} duplikátů
            </p>
          )}
        </div>
      </div>

      {/* Pozvánky */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Pozvat kamaráda</h2>
          <button
            onClick={createInvite}
            disabled={inviteCreating}
            className="flex items-center gap-2 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {inviteCreating && <Loader2 className="h-3 w-3 animate-spin" />}
            + Nová pozvánka
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Vygeneruj jednorázový odkaz pro kamaráda. Platí 7 dní.</p>
        {loadingInvites ? (
          <div className="h-8 bg-secondary rounded animate-pulse" />
        ) : invites.length === 0 ? (
          <p className="text-xs text-muted-foreground">Zatím žádné pozvánky.</p>
        ) : (
          <div className="space-y-2">
            {invites.map(inv => (
              <div key={inv.id} className="flex items-center gap-3 p-2 bg-secondary/50 rounded-md">
                <code className="text-xs text-foreground flex-1 truncate">{`${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${inv.code}`}</code>
                <span className={`text-xs px-2 py-0.5 rounded-full ${inv.usedAt ? 'bg-green-500/20 text-green-400' : inv.isValid ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-500/20 text-zinc-400'}`}>
                  {inv.usedAt ? 'Použita' : inv.isValid ? 'Aktivní' : 'Expirovaná'}
                </span>
                {inv.isValid && (
                  <button
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/invite/${inv.code}`)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Kopírovat
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
