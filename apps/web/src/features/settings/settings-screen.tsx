'use client';

import { Permission } from '@rinseops/shared';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSession } from '@/lib/session';
import { useUrlState } from '@/lib/url-state';
import { ActivityLog } from './activity-log';
import { BusinessSettings } from './business-settings';
import { StoresSettings } from './stores-settings';

export function SettingsScreen() {
  const { can } = useSession();
  const tabs = [
    can(Permission.SETTINGS_MANAGE) && { value: 'business', label: 'Business' },
    can(Permission.STORES_MANAGE) && { value: 'stores', label: 'Stores' },
    can(Permission.AUDIT_VIEW) && { value: 'activity', label: 'Activity log' },
  ].filter((t): t is { value: string; label: string } => Boolean(t));
  const [url, setUrl] = useUrlState({ tab: tabs[0]?.value ?? 'business', page: '1' });
  const tab = tabs.some((t) => t.value === url.tab) ? url.tab : tabs[0]?.value;

  if (!tabs.length || !tab) {
    return <EmptyState title="Nothing to configure" description="You don't have access to business settings." />;
  }

  return (
    <>
      <PageHeader title="Settings" description="Business profile, stores and activity." />
      <Tabs value={tab} onValueChange={(t) => setUrl({ tab: t })}>
        <TabsList className="mb-4">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {can(Permission.SETTINGS_MANAGE) && (
          <TabsContent value="business">
            <BusinessSettings />
          </TabsContent>
        )}
        {can(Permission.STORES_MANAGE) && (
          <TabsContent value="stores">
            <StoresSettings />
          </TabsContent>
        )}
        {can(Permission.AUDIT_VIEW) && (
          <TabsContent value="activity">
            <ActivityLog
              page={Math.max(1, Number(url.page) || 1)}
              onPageChange={(p) => setUrl({ page: String(p) }, { resetPage: false })}
            />
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}
