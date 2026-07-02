type PRDLike = {
  problemStatement: string | null
  goals: unknown
  nonGoals: unknown
  userStories: unknown
  acceptanceCriteria: unknown
  assumptions: unknown
}

type TaskLike = {
  title: string
  description: string | null
  status: string
  priority: string
}

function asList(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : []
}

function bulletSection(title: string, items: string[]) {
  if (items.length === 0) return ""
  return `## ${title}\n\n${items.map((item) => `- ${item}`).join("\n")}\n\n`
}

export function prdToMarkdown(title: string, prd: PRDLike): string {
  const goals = asList(prd.goals)
  const nonGoals = asList(prd.nonGoals)
  const userStories = asList(prd.userStories)
  const acceptanceCriteria = asList(prd.acceptanceCriteria)
  const assumptions = asList(prd.assumptions)

  let md = `# ${title}\n\n`
  if (prd.problemStatement) {
    md += `## Problem Statement\n\n${prd.problemStatement}\n\n`
  }
  md += bulletSection("Goals", goals)
  md += bulletSection("Non-Goals", nonGoals)
  md += bulletSection("User Stories", userStories)
  md += bulletSection("Acceptance Criteria", acceptanceCriteria)
  md += bulletSection("Assumptions", assumptions)

  return md.trimEnd() + "\n"
}

const STATUS_LABELS: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
}

export function tasksToMarkdown(title: string, tasks: TaskLike[]): string {
  let md = `# ${title} — Tasks\n\n`

  for (const status of ["TODO", "IN_PROGRESS", "DONE"]) {
    const tasksInStatus = tasks.filter((task) => task.status === status)
    if (tasksInStatus.length === 0) continue

    md += `## ${STATUS_LABELS[status]}\n\n`
    for (const task of tasksInStatus) {
      md += `- [${status === "DONE" ? "x" : " "}] ${task.title} (priority: ${task.priority})\n`
      if (task.description) {
        md += `      ${task.description}\n`
      }
    }
    md += "\n"
  }

  return md.trimEnd() + "\n"
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
