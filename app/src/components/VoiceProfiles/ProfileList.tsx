import { Mic, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getErrorDisplayDetails } from '@/lib/errors';
import { useProfiles } from '@/lib/hooks/useProfiles';
import { useUIStore } from '@/stores/uiStore';
import { ProfileCard } from './ProfileCard';
import { ProfileForm } from './ProfileForm';

export function ProfileList() {
  const { data: profiles, isLoading, error } = useProfiles();
  const setDialogOpen = useUIStore((state) => state.setProfileDialogOpen);

  if (isLoading) {
    return null;
  }

  if (error) {
    const errorDetails = getErrorDisplayDetails(error, 'Failed to load voice profiles');
    return (
      <div className="flex items-center justify-center p-8">
        <div className="max-w-2xl w-full rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm space-y-2">
          <p className="font-semibold text-destructive">{errorDetails.title}</p>
          <p className="text-destructive/90">{errorDetails.summary}</p>
          {errorDetails.hint && (
            <p className="text-muted-foreground">
              <span className="font-medium">What to check:</span> {errorDetails.hint}
            </p>
          )}
          {errorDetails.technical && (
            <details className="pt-1">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                Technical details
              </summary>
              <pre className="mt-2 whitespace-pre-wrap break-all text-xs text-muted-foreground bg-background/60 p-2 rounded-md border">
                {errorDetails.technical}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }

  const allProfiles = profiles || [];

  return (
    <div className="flex flex-col">
      <div className="shrink-0">
        {allProfiles.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Mic className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                No voice profiles yet. Create your first profile to get started.
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Create Voice
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-3 auto-rows-auto p-1 pb-[150px]">
            {allProfiles.map((profile) => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
        )}
      </div>

      <ProfileForm />
    </div>
  );
}
