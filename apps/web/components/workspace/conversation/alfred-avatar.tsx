import type { Icon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { AlfredLogo } from "@/components/icons/alfred-logo"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function AlfredAvatar({ pulse, icon: IconComponent }: { pulse?: boolean; icon?: Icon }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white",
              IconComponent && "size-8",
              pulse && "bg-primary text-primary-foreground animate-pulse",
            )}
          />
        }
      >
        {IconComponent ? (
          <IconComponent className="size-5" weight="duotone" />
        ) : (
          <AlfredLogo className="size-3.5" />
        )}
      </TooltipTrigger>
      <TooltipContent>Alfred · {pulse ? "Thinking" : "Online"}</TooltipContent>
    </Tooltip>
  )
}
