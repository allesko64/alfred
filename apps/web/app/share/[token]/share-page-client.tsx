"use client"

import { useQuery } from "@tanstack/react-query"
import { WarningCircleIcon } from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoaderOne } from "@/components/ui/loader"
import { DecisionPills } from "@/components/workspace/conversation"

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <ul className="flex flex-col gap-1.5 text-sm text-foreground">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-muted-foreground">·</span>
          {item}
        </li>
      ))}
    </ul>
  )
}

function NumberedList({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <ol className="flex flex-col gap-1.5 text-sm text-foreground">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-muted-foreground">{i + 1}.</span>
          {item}
        </li>
      ))}
    </ol>
  )
}

function asList(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : []
}

const COLUMNS: { status: string; label: string }[] = [
  { status: "TODO", label: "To Do" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "DONE", label: "Done" },
]

export function SharePageClient({ token }: { token: string }) {
  const trpc = useTRPC()
  const { data, isLoading, isError } = useQuery(trpc.share.getPublic.queryOptions({ token }))

  if (isLoading) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4">
        <LoaderOne />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 text-center">
        <WarningCircleIcon className="size-8 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">This link is invalid or has been revoked</span>
      </div>
    )
  }

  const goals = asList(data.prd?.goals)
  const nonGoals = asList(data.prd?.nonGoals)
  const userStories = asList(data.prd?.userStories)
  const acceptanceCriteria = asList(data.prd?.acceptanceCriteria)
  const assumptions = asList(data.prd?.assumptions)

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Shared via Alfred</span>
        <h1 className="text-xl font-semibold text-foreground">{data.title}</h1>
        {data.decisionPills.length > 0 && <DecisionPills pills={data.decisionPills} variant="inline" />}
      </div>

      {data.prd && (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-foreground">PRD</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Problem Statement</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground">{data.prd.problemStatement}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Goals</CardTitle>
              </CardHeader>
              <CardContent>
                <BulletList items={goals} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Non Goals</CardTitle>
              </CardHeader>
              <CardContent>
                <BulletList items={nonGoals} />
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>User Stories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {userStories.map((story, i) => (
                    <div key={i} className="rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
                      {story}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Acceptance Criteria</CardTitle>
              </CardHeader>
              <CardContent>
                <NumberedList items={acceptanceCriteria} />
              </CardContent>
            </Card>

            {assumptions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Assumptions</CardTitle>
                </CardHeader>
                <CardContent>
                  <BulletList items={assumptions} />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {data.tasks.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-foreground">Tasks</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {COLUMNS.map((column) => {
              const tasksInColumn = data.tasks.filter((task) => task.status === column.status)
              return (
                <div key={column.status} className="flex flex-col gap-2">
                  <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {column.label} ({tasksInColumn.length})
                  </span>
                  <div className="flex flex-col gap-2">
                    {tasksInColumn.map((task) => (
                      <Card key={task.id}>
                        <CardContent className="flex flex-col gap-2 py-3">
                          <span className="text-sm font-medium text-foreground">{task.title}</span>
                          {task.description && (
                            <span className="text-sm text-muted-foreground">{task.description}</span>
                          )}
                          <Badge variant="outline" className="w-fit">
                            {task.priority}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!data.prd && data.tasks.length === 0 && (
        <div className="flex flex-col items-center gap-1 py-16 text-center">
          <span className="text-sm font-medium text-foreground">Nothing to show yet</span>
          <span className="text-sm text-muted-foreground">
            Nothing on this feature has been approved for sharing yet.
          </span>
        </div>
      )}
    </div>
  )
}
