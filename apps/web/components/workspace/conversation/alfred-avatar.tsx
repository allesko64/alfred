import { cn } from "@/lib/utils"
import { AlfredLogo } from "@/components/icons/alfred-logo"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function AlfredAvatar({ pulse }: { pulse?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
              pulse && "bg-primary text-primary-foreground animate-pulse",
            )}
          />
        }
      >
        <AlfredLogo className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>Alfred · {pulse ? "Thinking" : "Online"}</TooltipContent>
    </Tooltip>
  )
}
