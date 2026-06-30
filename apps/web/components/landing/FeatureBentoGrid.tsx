import Image from "next/image"
import {
  FileText,
  GitPullRequest,
  ListChecks,
  GitBranch,
  Sparkles,
} from "lucide-react"
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid"

function ImageHeader({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div
      className={`relative flex flex-1 w-full h-full min-h-[6rem] overflow-hidden rounded-xl border border-border ${className ?? ""}`}
    >
      <Image src={src} alt={alt} fill className="object-cover" />
    </div>
  )
}

const items = [
  {
    title: "PRD generation",
    description: "Describe a feature in plain language and Alfred drafts a complete product spec.",
    header: <ImageHeader src="/prd.png" alt="PRD generation" />,
    icon: <FileText className="h-4 w-4 text-muted-foreground" />,
  },
  {
    title: "Implementation planning",
    description: "Alfred maps the spec into a concrete, ordered plan of engineering tasks.",
    header: <ImageHeader src="/implementation.png" alt="Implementation planning" />,
    icon: <ListChecks className="h-4 w-4 text-muted-foreground" />,
  },
  {
    title: "GitHub integration",
    description: "Your repo is vectorized and synced so Alfred always works with real codebase context.",
    header: <ImageHeader src="/github.png" alt="GitHub integration" />,
    icon: <GitBranch className="h-4 w-4 text-muted-foreground" />,
  },
  {
    title: "Automated code review",
    description: "Every pull request runs through an AI review loop that catches issues before merge.",
    header: <ImageHeader src="/code_review.png" alt="Automated code review" />,
    icon: <GitPullRequest className="h-4 w-4 text-muted-foreground" />,
  },
  {
    title: "Ship with confidence",
    description: "From idea to production, Alfred carries the feature lifecycle end to end.",
    header: <ImageHeader src="/ship_with_confidence.png" alt="Ship with confidence" />,
    icon: <Sparkles className="h-4 w-4 text-muted-foreground" />,
  },
]

export function FeatureBentoGrid() {
  return (
    <section id="features" className="relative scroll-mt-24 bg-background py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Everything Alfred handles for you
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            One co-pilot across the entire feature lifecycle, from first prompt to shipped code.
          </p>
        </div>

        <BentoGrid className="max-w-4xl mx-auto">
          {items.map((item, i) => (
            <BentoGridItem
              key={item.title}
              title={item.title}
              description={item.description}
              header={item.header}
              icon={item.icon}
              className={i === 0 ? "md:col-span-2" : ""}
            />
          ))}
        </BentoGrid>
      </div>
    </section>
  )
}
