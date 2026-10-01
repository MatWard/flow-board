import styles from './WarningBanner.module.css';

interface WarningBannerProps {
  taskTitle: string;
  leaving: boolean;
  onDismissForever: () => void;
}

export default function WarningBanner({ taskTitle, leaving, onDismissForever }: WarningBannerProps) {
  return (
    <div className={`${styles.banner} ${leaving ? styles.leaving : ''}`} role="alert">
      <div className={styles.scrim}>
        <span className={styles.icon} aria-hidden="true">
          ⚠️
        </span>
        <span>
          NEW TASK "{taskTitle}" ADDED — MORE WORK IS COMING!!!
        </span>
        <span className={styles.icon} aria-hidden="true">
          ⚠️
        </span>
        <button type="button" className={styles.dismissButton} onClick={onDismissForever}>
          Turn off these alerts
        </button>
      </div>
    </div>
  );
}
