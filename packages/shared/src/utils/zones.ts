import type { HRZones, PaceZones, PowerZones, TrainingZones } from '../types/training';

interface UserProfile {
  maxHR?: number | null;
  restHR?: number | null;
  ftp?: number | null;
  thresholdPace?: number | null; // sec/km at 10K threshold
}

/**
 * Calculate HR training zones using Karvonen method (heart rate reserve)
 */
export function calculateHRZones(profile: UserProfile): HRZones | null {
  if (!profile.maxHR || !profile.restHR) return null;

  const hrr = profile.maxHR - profile.restHR;

  const zone = (minPct: number, maxPct: number) => ({
    min: Math.round(profile.restHR! + hrr * minPct),
    max: Math.round(profile.restHR! + hrr * maxPct),
  });

  return {
    z1: zone(0.5, 0.6),   // Recovery
    z2: zone(0.6, 0.7),   // Aerobic base
    z3: zone(0.7, 0.8),   // Tempo
    z4: zone(0.8, 0.9),   // Threshold
    z5: zone(0.9, 1.0),   // VO2max
  };
}

/**
 * Calculate running pace zones from threshold pace (sec/km)
 */
export function calculatePaceZones(profile: UserProfile): PaceZones | null {
  if (!profile.thresholdPace) return null;

  const tp = profile.thresholdPace;

  return {
    z1: { min: Math.round(tp * 1.35), max: Math.round(tp * 1.5) },   // Easy
    z2: { min: Math.round(tp * 1.2), max: Math.round(tp * 1.35) },   // Aerobic
    z3: { min: Math.round(tp * 1.05), max: Math.round(tp * 1.2) },   // Tempo
    z4: { min: Math.round(tp * 0.95), max: Math.round(tp * 1.05) },  // Threshold
    z5: { min: Math.round(tp * 0.85), max: Math.round(tp * 0.95) },  // VO2max
  };
}

/**
 * Calculate cycling power zones from FTP
 */
export function calculatePowerZones(profile: UserProfile): PowerZones | null {
  if (!profile.ftp) return null;

  const ftp = profile.ftp;

  return {
    z1: { min: 0, max: Math.round(ftp * 0.55) },                              // Active recovery
    z2: { min: Math.round(ftp * 0.55), max: Math.round(ftp * 0.75) },        // Endurance
    z3: { min: Math.round(ftp * 0.75), max: Math.round(ftp * 0.9) },         // Tempo
    z4: { min: Math.round(ftp * 0.9), max: Math.round(ftp * 1.05) },         // Threshold
    z5: { min: Math.round(ftp * 1.05), max: Math.round(ftp * 1.2) },         // VO2max
    z6: { min: Math.round(ftp * 1.2), max: Math.round(ftp * 1.5) },          // Anaerobic
    z7: { min: Math.round(ftp * 1.5), max: Math.round(ftp * 3.0) },          // Neuromuscular
  };
}

/**
 * Calculate all training zones for a user
 */
export function calculateZones(profile: UserProfile): TrainingZones {
  const hr = calculateHRZones(profile);
  const pace = calculatePaceZones(profile);
  const power = calculatePowerZones(profile);

  return {
    hr: hr ?? {
      z1: { min: 0, max: 0 },
      z2: { min: 0, max: 0 },
      z3: { min: 0, max: 0 },
      z4: { min: 0, max: 0 },
      z5: { min: 0, max: 0 },
    },
    ...(pace && { pace }),
    ...(power && { power }),
  };
}
