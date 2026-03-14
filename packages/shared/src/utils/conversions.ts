/**
 * Convert meters to kilometers
 */
export function metersToKm(meters: number): number {
  return meters / 1000;
}

/**
 * Convert km to miles
 */
export function kmToMiles(km: number): number {
  return km * 0.621371;
}

/**
 * Convert miles to km
 */
export function milesToKm(miles: number): number {
  return miles * 1.60934;
}

/**
 * Convert sec/km pace to min/mile
 */
export function secPerKmToMinPerMile(secPerKm: number): number {
  return (secPerKm * 1.60934) / 60;
}

/**
 * Convert min/mile to sec/km
 */
export function minPerMileToSecPerKm(minPerMile: number): number {
  return (minPerMile * 60) / 1.60934;
}

/**
 * Convert sec/100m swim pace to sec/km equivalent
 */
export function swimPaceToRunEquivalent(secPer100m: number): number {
  return secPer100m * 10;
}

/**
 * Convert Celsius to Fahrenheit
 */
export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

/**
 * Convert meters elevation to feet
 */
export function metersToFeet(meters: number): number {
  return meters * 3.28084;
}
