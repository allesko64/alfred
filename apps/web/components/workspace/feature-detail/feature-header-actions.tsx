"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

const ActionContext = createContext<ReactNode>(null)
// Kept on a separate context so pages that only need to *register* an action
// don't re-render every time the action node itself changes — only
// FeatureHeader (which reads ActionContext) does.
const SetActionContext = createContext<((node: ReactNode) => void) | null>(null)

export function FeatureHeaderActionsProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<ReactNode>(null)

  return (
    <SetActionContext.Provider value={setAction}>
      <ActionContext.Provider value={action}>{children}</ActionContext.Provider>
    </SetActionContext.Provider>
  )
}

export function useFeatureHeaderAction() {
  return useContext(ActionContext)
}

/** Registers `node` as the action rendered inline with the feature title; clears on unmount. */
export function useSetFeatureHeaderAction(node: ReactNode) {
  const setAction = useContext(SetActionContext)

  useEffect(() => {
    setAction?.(node)
    return () => setAction?.(null)
  }, [node, setAction])
}
