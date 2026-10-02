import { GARMENT_ISSUE_LABEL, type GarmentIssue } from '@rinseops/shared';
import { Badge } from '@/components/ui/badge';

export function IssueBadges({ issues, className }: { issues: GarmentIssue[]; className?: string }) {
  if (!issues.length) return null;
  return (
    <span className={className}>
      {issues.map((i) => (
        <Badge key={i} tone="amber" className="mr-1 mb-0.5">
          {GARMENT_ISSUE_LABEL[i]}
        </Badge>
      ))}
    </span>
  );
}
