import type { TaskSource, TaskType } from '@rinseops/shared';
import { Globe, PackageCheck, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function TaskTypeBadge({ type }: { type: TaskType }) {
  return type === 'PICKUP' ? (
    <Badge tone="violet">
      <Truck />
      Pickup
    </Badge>
  ) : (
    <Badge tone="teal">
      <PackageCheck />
      Delivery
    </Badge>
  );
}

export function TaskSourceBadge({ source }: { source: TaskSource }) {
  if (source !== 'PUBLIC_BOOKING') return null;
  return (
    <Badge tone="blue">
      <Globe />
      Online booking
    </Badge>
  );
}
