// Same palette as the landing Hero's rotating word (Listens/Crafts/Maps/Audits/Ships).
export const PHASE_COLORS = {
  amber: "#F59E0B",
  sky: "#38BDF8",
  violet: "#A78BFA",
  orange: "#FB923C",
  emerald: "#34D399",
} as const

export type PhaseColor = (typeof PHASE_COLORS)[keyof typeof PHASE_COLORS]
