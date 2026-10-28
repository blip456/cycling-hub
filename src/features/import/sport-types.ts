/**
 * Strava sport types that count as rides (P4, P13). Every other type is stored as "not a ride".
 * The database decides with the same list (generated column `activities.is_ride` in
 * supabase/migrations/20261018100000_activities_and_imports.sql); keep both in sync.
 */
export const RIDE_SPORT_TYPES = [
  "Ride",
  "MountainBikeRide",
  "GravelRide",
  "EBikeRide",
  "EMountainBikeRide",
  "VirtualRide",
  "Velomobile",
  "Handcycle",
] as const;

const rideTypes: ReadonlySet<string> = new Set(RIDE_SPORT_TYPES);

export function isRideSportType(sportType: string): boolean {
  return rideTypes.has(sportType);
}
