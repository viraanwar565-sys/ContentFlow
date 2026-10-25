import { useStore } from '../store/store';

export function Toasts() {
  const { notifications, dismissNotification } = useStore();
  if (notifications.length === 0) return null;
  return (
    <div className="toasts" aria-live="polite">
      {notifications.map((n) => (
        <div key={n.id} className={`toast toast-${n.kind}`} onClick={() => dismissNotification(n.id)}>
          <span className="toast-icon">
            {n.kind === 'warning' ? '!' : n.kind === 'success' ? '✓' : 'i'}
          </span>
          <span className="toast-message">{n.message}</span>
        </div>
      ))}
    </div>
  );
}
