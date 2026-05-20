import Link from "next/link";

export default function GoldLabelRulesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div>
        <ButtonBack />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Gold label rules</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Employee handbook for reference videos. Full copy also lives in{" "}
          <code className="bg-muted rounded px-1 text-xs">docs/GOLD_LABEL_RULES.md</code> in the repo.
        </p>
      </div>

      <section className="space-y-2 text-sm">
        <h2 className="text-lg font-semibold">Identity</h2>
        <ul className="text-muted-foreground list-inside list-disc space-y-1">
          <li>
            <strong className="text-foreground">player_1 = Me</strong> for the entire video, including after every end
            switch.
          </li>
          <li>Never tag opponents. Never swap Me to P2 when teams change ends.</li>
        </ul>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-lg font-semibold">Timestamps</h2>
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="border px-2 py-1 text-left">Event</th>
              <th className="border px-2 py-1 text-left">Time</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            <tr>
              <td className="border px-2 py-1">My shot (in, winner)</td>
              <td className="border px-2 py-1">Paddle contact</td>
            </tr>
            <tr>
              <td className="border px-2 py-1">My mistake (out, net, UE, FE)</td>
              <td className="border px-2 py-1">Ball dead (net / out landing)</td>
            </tr>
            <tr>
              <td className="border px-2 py-1">Side switch</td>
              <td className="border px-2 py-1">Switched ends at active clock</td>
            </tr>
          </tbody>
        </table>
        <p>Target ±0.25s frame accuracy.</p>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-lg font-semibold">Side switches</h2>
        <p className="text-muted-foreground">
          Fixed camera — you move on screen after teams switch ends. Click <strong>Switched ends</strong> in Review for
          every change. Amber timeline ticks mark switch times.
        </p>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-lg font-semibold">Gold session quality</h2>
        <ul className="text-muted-foreground list-inside list-disc space-y-1">
          <li>Full court, stable camera.</li>
          <li>≥10 Me tags for full coaching.</li>
          <li>Non-unknown labels when possible.</li>
          <li>Every side switch recorded.</li>
          <li>Download training export (schema v3) when done.</li>
        </ul>
      </section>
    </div>
  );
}

function ButtonBack() {
  return (
    <Link href="/videos" className="text-primary text-sm font-medium underline underline-offset-4">
      ← Videos
    </Link>
  );
}
