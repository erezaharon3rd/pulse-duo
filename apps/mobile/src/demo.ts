// נתוני תצוגה בלבד, למצב בלי שרת (תצוגה מקדימה ב-Netlify). אין כאן לוגיקה.
export interface UiStep { title: string; subtitle: string; seconds: number }
export interface UiPlan { steps: UiStep[] }

export const DEMO_PLAN: UiPlan = {
  steps: [
    { title: 'חימום 🌬️', subtitle: 'נשימה משותפת + ירכיים', seconds: 30 },
    { title: '"הגל השקט"', subtitle: 'קל · חדש!', seconds: 30 },
    { title: '"מגדלור"', subtitle: 'השיא של הערב 🔥', seconds: 30 },
    { title: 'שחרור 🌙', subtitle: 'מגע איטי', seconds: 30 },
  ],
};
