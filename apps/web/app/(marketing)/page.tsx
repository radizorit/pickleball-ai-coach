import { Activity, BarChart3, PlayCircle, Sparkles, Upload, Users } from "lucide-react";

import { ApiStatus } from "@/components/api-status";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  {
    icon: Upload,
    title: "Upload from anywhere",
    description: "Record on your phone, finish reviewing on your laptop. Large files welcome.",
  },
  {
    icon: PlayCircle,
    title: "Tag with hotkeys",
    description:
      "Mark serves, returns, dinks, drops, and outcomes from the keyboard while the video plays.",
  },
  {
    icon: BarChart3,
    title: "Real stats, not vibes",
    description:
      "Serve %, return error rate, third-shot drop success, dink consistency — broken down by side.",
  },
  {
    icon: Sparkles,
    title: "Coaching feedback",
    description:
      "Pinpoint your biggest leak and get drills targeted at it. Tracks progress over time.",
  },
  {
    icon: Users,
    title: "Built for coaches",
    description: "Manage rosters, leave timestamped comments, and share reports with your players.",
  },
  {
    icon: Activity,
    title: "AI assist (later)",
    description: "Every shot you tag trains the model. Suggestions arrive once the data is solid.",
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="container py-20 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-primary mb-4 text-sm font-medium uppercase tracking-wider">
            Pickleball video analytics
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            See exactly why you&apos;re losing points.
          </h1>
          <p className="text-muted-foreground mt-6 text-lg">
            Upload your matches, tag the shots, and get a coaching report that tells you what to
            drill next. No guessing.
          </p>
          <div className="mt-10 flex justify-center">
            <ApiStatus />
          </div>
        </div>
      </section>

      <section id="features" className="border-border border-t py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to actually improve
            </h2>
            <p className="text-muted-foreground mt-4">
              Manual tagging first. AI later, once the data is solid. No fragile demos that lie
              about your shots.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <Card key={title}>
                <CardHeader>
                  <Icon className="text-primary h-6 w-6" aria-hidden />
                  <CardTitle className="text-lg">{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
