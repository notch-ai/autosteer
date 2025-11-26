import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X } from 'lucide-react';

interface UpdateInfo {
  currentVersion: string;
  newVersion: string;
  releaseNotes?: string;
  releaseDate?: string;
}

export const UpdateNotification: React.FC = (): React.ReactElement | null => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState<string>('');
  const { showToast } = useToast();

  useEffect(() => {
    window.electron.update.onUpdateAvailable((info: UpdateInfo) => {
      setUpdateInfo(info);
      setReleaseNotes(info.releaseNotes || '');
    });

    window.electron.update.onDownloadProgress((progress: any) => {
      setDownloadProgress(progress.percent);
    });

    window.electron.update.onUpdateDownloaded(() => {
      setIsDownloading(false);
      showToast('Update downloaded! Restart to install.', 'success');
    });

    window.electron.update.onUpdateError((error: string) => {
      setIsDownloading(false);
      showToast(`Update error: ${error}`, 'error');
    });

    // Check for updates on mount
    window.electron.update.check();
  }, [showToast]);

  const handleUpdateNow = async (): Promise<void> => {
    setIsDownloading(true);
    await window.electron.update.download();
  };

  const handleViewReleaseNotes = async (): Promise<void> => {
    if (!releaseNotes && updateInfo) {
      const notes = await window.electron.update.getReleaseNotes(updateInfo.newVersion);
      setReleaseNotes(notes);
    }
    setShowReleaseNotes(!showReleaseNotes);
  };

  const handleDismiss = (): void => {
    if (updateInfo) {
      window.electron.update.dismiss(updateInfo.newVersion);
      setUpdateInfo(null);
    }
  };

  if (!updateInfo) return null;

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">Update Available</h3>
        <Button variant="ghost" size="icon-sm" onClick={handleDismiss} aria-label="Dismiss update">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Version {updateInfo.newVersion} is available (current: {updateInfo.currentVersion})
        </p>

        {isDownloading && (
          <div className="relative bg-card rounded h-2">
            <div
              className="absolute h-full bg-primary rounded"
              style={{ width: `${downloadProgress}%` }}
            />
            <span className="text-sm text-muted-foreground">{Math.round(downloadProgress)}%</span>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleUpdateNow} disabled={isDownloading} variant="brand">
            {isDownloading ? 'Downloading...' : 'Update Now'}
          </Button>

          <Button onClick={handleViewReleaseNotes} variant="outline">
            {showReleaseNotes ? 'Hide' : 'View'} Release Notes
          </Button>
        </div>

        {showReleaseNotes && (
          <div className="p-3 bg-card rounded">
            <pre className="text-sm text-muted-foreground whitespace-pre-wrap">{releaseNotes}</pre>
          </div>
        )}
      </div>
    </Card>
  );
};
