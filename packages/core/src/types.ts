// טיפוסים משותפים לכל שכבת הלוגיקה. בלי תלויות חיצוניות.

export type Intensity = 'recovery' | 'balanced' | 'high';
export const INTENSITY_ORDER: Record<Intensity, number> = { recovery: 0, balanced: 1, high: 2 };

export type Joint = 'lowerBack' | 'hips' | 'knees' | 'wrists' | 'shoulders' | 'neck';
export const JOINTS: Joint[] = ['lowerBack', 'hips', 'knees', 'wrists', 'shoulders', 'neck'];

export type Severity = 'none' | 'mild' | 'severe';
export type BackType = 'flexion' | 'extension' | 'unknown';
export type SpineMotion = 'neutral' | 'flexion' | 'extension';
export type Slot = 'mover' | 'stabilizer';

/** דגלי סינון רפואי (חלק 3 באפיון). */
export type ScreeningFlag =
  | 'cardiac'
  | 'recent_cardiac_event'
  | 'nitrates'
  | 'uncontrolled_bp_diabetes'
  | 'genital_pelvic_pain'
  | 'erectile'
  | 'pelvic_floor'
  | 'pregnancy'
  | 'postpartum'
  | 'surgery'
  | 'hip_replacement'
  | 'knee_replacement'
  | 'osteoporosis'
  | 'hernia'
  | 'eye'
  | 'back_red_flag';

/** דגלים שחוסמים הכול חוץ מנשימה ומגע עד שאיש מקצוע אישר. */
export const BLOCKING_FLAGS: ScreeningFlag[] = [
  'cardiac',
  'recent_cardiac_event',
  'pregnancy',
  'postpartum',
  'surgery',
  'back_red_flag',
];

export interface Person {
  userId: string;
  weightKg: number;
  heightCm: number;
  fitnessLevel: 1 | 2 | 3 | 4 | 5;
  /** undefined = עוד לא נשאל. הלוגיקה מניחה את המקרה הזהיר. */
  limitations: Partial<Record<Joint, Severity>>;
  backType?: BackType;
  hipApproach?: 'posterior' | 'anterior' | 'unknown';
  flags: ScreeningFlag[];
  clearedFlags: ScreeningFlag[];
  intensityCapSelf: Intensity;
  spiceLevel: 1 | 2 | 3 | 4 | 5;
  hardLimits: string[];
  standingOk?: boolean;
}

export interface SlotSpec {
  jointLoad: Record<Joint, number>; // 0–5 (0 = לא מעמיס בכלל)
  spineMotion: SpineMotion;
  kneeling: boolean;
  supine: boolean;
  prone: boolean;
  headDown: boolean;
  abdominalPressure: boolean;
  hip: {
    flexionOver90: boolean;
    crossMidline: boolean;
    internalRotation: boolean;
    extensionExternalRotation: boolean;
  };
}

export interface Pose {
  poseId: string;
  category: 'touch' | 'gentle' | 'core' | 'endurance' | 'flexibility';
  difficulty: 1 | 2 | 3 | 4 | 5;
  spice: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  penetrative: boolean;
  requiresStanding: boolean;
  slots: Record<Slot, SlotSpec>;
  alternatives: string[];
  reviewedBy: string | null;
}

export interface Assignment {
  poseId: string;
  moverUserId: string;
  stabilizerUserId: string;
}
