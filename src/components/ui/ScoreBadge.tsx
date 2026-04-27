import { cn, scoreToBg } from '@/lib/utils'

export default function ScoreBadge({ score }: { score: number }) {
  return (
    <span className={cn('badge font-semibold tabular-nums', scoreToBg(score))}>
      {score}/100
    </span>
  )
}
