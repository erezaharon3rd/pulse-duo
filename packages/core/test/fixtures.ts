import type { Joint, Person, Pose, SlotSpec } from '../src/types.ts';

const zeroLoad = (): Record<Joint, number> => ({ lowerBack: 0, hips: 0, knees: 0, wrists: 0, shoulders: 0, neck: 0 });

export function slot(over: Partial<SlotSpec> = {}, load: Partial<Record<Joint, number>> = {}): SlotSpec {
  return {
    jointLoad: { ...zeroLoad(), ...load },
    spineMotion: 'neutral',
    kneeling: false,
    supine: false,
    prone: false,
    headDown: false,
    abdominalPressure: false,
    hip: { flexionOver90: false, crossMidline: false, internalRotation: false, extensionExternalRotation: false },
    ...over,
  };
}

export function pose(id: string, over: Partial<Pose> = {}): Pose {
  return {
    poseId: id,
    category: 'core',
    difficulty: 2,
    spice: 1,
    tags: [],
    penetrative: false,
    requiresStanding: false,
    slots: { mover: slot(), stabilizer: slot() },
    alternatives: [],
    reviewedBy: 'physio_1',
    ...over,
  };
}

export function person(id: string, over: Partial<Person> = {}): Person {
  return {
    userId: id,
    weightKg: 70,
    heightCm: 170,
    fitnessLevel: 3,
    limitations: { lowerBack: 'none', hips: 'none', knees: 'none', wrists: 'none', shoulders: 'none', neck: 'none' },
    flags: [],
    clearedFlags: [],
    intensityCapSelf: 'high',
    spiceLevel: 5,
    hardLimits: [],
    standingOk: true,
    ...over,
  };
}

/** מאגר של 12 תנוחות בקשיים 1–5. */
export function library(): Pose[] {
  return Array.from({ length: 12 }, (_, k) =>
    pose(`p${k + 1}`, { difficulty: ((k % 5) + 1) as Pose['difficulty'], spice: ((k % 3) + 1) as Pose['spice'] }),
  );
}

/** rand דטרמיניסטי. */
export function seeded(seed = 42): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}
