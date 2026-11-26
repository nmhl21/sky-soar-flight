// config.js — every tunable number for Sky Soar: Canyon Run, in one place.
// The course, the plane's flight envelope, fuel, damage and scoring.
export const CONFIG = {
  title: 'SKY SOAR',
  subtitle: 'CANYON RUN',
  // Course: a winding canyon valley running from z=+80 (runway) to z=-2900.
  courseLength: 3000,
  ringCount: 14,
  ringSpacing: 195,
  firstRingZ: -190,
  ringRadius: 15,
  ringScore: 100,
  // Flight envelope.
  minSpeed: 25,          // m/s, throttle idle
  maxSpeed: 82,          // m/s at full throttle (~295 km/h)
  boostSpeed: 26,        // extra m/s while Space is held
  pitchRate: 0.85,       // rad/s at full stick
  rollRate: 1.5,         // rad/s at full stick
  turnRate: 0.55,        // yaw rad/s per rad of bank
  maxPitch: 0.62,
  maxRoll: 1.05,
  climbSink: 6,          // m/s sink at idle throttle, keeps throttle honest
  // Resources.
  timeLimit: 120,        // seconds per sortie
  fuelMax: 100,
  fuelDrain: 0.55,       // per second at full throttle
  fuelBoostDrain: 2.6,   // extra per second while boosting
  fuelIdleDrain: 0.08,
  hitsToCrash: 3,
  // Presentation.
  skyDay: 0x7ec8f7,      // bright midday sky
  skyDawn: 0xffb36b,     // warm dawn sky for the title shot
  fogDay: 0xa8d8f0,
  fogNear: 260,
  fogFar: 1500,
  sunDay: 0xfff2cc,
  sunDawn: 0xff9a4d,
  planeOrange: 0xff7a1a,
  planeWhite: 0xf5f2ea,
  ringGlow: 0x39ff88,
  ringNext: 0xffd23f,
};

export const SHOT_SEED = 1;
