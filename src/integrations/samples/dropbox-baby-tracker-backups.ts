export interface BabyTrackerDropboxBackupSample {
  id: string
  fileName: string
  sizeLabel: string
  sizeInBytes: number
  lastModified: string
  note: string
  pathLower: string
}

export const BABY_TRACKER_DROPBOX_BACKUPS: BabyTrackerDropboxBackupSample[] = [
  {
    id: 'bt-backup-2025-11-11',
    fileName: 'BabyTracker_V3_2025-11-11.zip',
    sizeLabel: '3.6 Mo',
    sizeInBytes: 3792896,
    lastModified: '2025-11-11T20:15:00.000Z',
    note: 'Export complet Baby Tracker (nuit + siestes)',
    pathLower: '/Application/BabyTracker/backups/BabyTracker_V3_2025-11-11.zip',
  },
  {
    id: 'bt-backup-2025-10-05',
    fileName: 'BabyTracker_V3_2025-10-05.zip',
    sizeLabel: '3.2 Mo',
    sizeInBytes: 3355443,
    lastModified: '2025-10-05T05:45:00.000Z',
    note: 'Sauvegarde post-mise à jour 3.4.2',
    pathLower: '/Application/BabyTracker/backups/BabyTracker_V3_2025-10-05.zip',
  },
  {
    id: 'bt-backup-2025-09-22',
    fileName: 'BabyTracker_V3_2025-09-22.zip',
    sizeLabel: '2.9 Mo',
    sizeInBytes: 3040870,
    lastModified: '2025-09-22T09:12:00.000Z',
    note: 'Export manuel avant changement d’appareil',
    pathLower: '/Application/BabyTracker/backups/BabyTracker_V3_2025-09-22.zip',
  },
]
