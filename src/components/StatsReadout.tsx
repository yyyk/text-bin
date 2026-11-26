import { useEffect, useState } from "react"
import type { AtlasStats } from "@/lib/atlas/pack"
import type { Player } from "@/lib/preview/player"

/**
 * The engine's progress and stats, read a few times a second (through the
 * player: restarting gives it a new engine)
 */
export function StatsReadout({ player }: { player: Player }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 250)
    return () => clearInterval(id)
  }, [])

  const engine = player.engine()
  // Cycles only once there's more than one (Loop is out of the panel for
  // now, so there's always one: see engineSettings), as in the transport
  const cycle = engine.cycle()
  const last = cycle > 1 ? engine.lastCycle() : null
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs tabular-nums">
      {cycle > 1 && (
        <>
          <dt className="text-muted-foreground">Cycle</dt>
          <dd>{cycle}</dd>
        </>
      )}
      <dt className="text-muted-foreground">Frame</dt>
      <dd>
        {engine.frame()} / {engine.cycleFrames}
      </dd>
      <Stats stats={engine.stats()} />
      {last && (
        <>
          <dt className="col-span-2 pt-2 font-medium">Last cycle</dt>
          <Stats stats={last} prefix="last-" />
        </>
      )}
    </dl>
  )
}

function Stats({ stats, prefix = "" }: { stats: AtlasStats; prefix?: string }) {
  return (Object.keys(stats) as (keyof AtlasStats)[]).map((key) => (
    <div key={key} className="contents" data-stat={prefix + key}>
      <dt className="text-muted-foreground capitalize">{key}</dt>
      <dd>{stats[key]}</dd>
    </div>
  ))
}
