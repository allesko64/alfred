import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center alfred-gradient">
      <Card className="w-[420px] border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            Alfred
            <Badge className="bg-primary/20 text-primary border-primary/30">
              Beta
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground">
            Your AI delivery butler. From idea to shipped — without the chaos.
          </p>
          <Button className="w-full">
            Get Started Free
          </Button>
          <Button variant="outline" className="w-full border-border/50">
            View Demo
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}