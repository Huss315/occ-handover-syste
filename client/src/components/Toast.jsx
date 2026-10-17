import { useEffect } from 'react';

function Toast({ message, type = 'success', onClose }) {
  // Auto-dismiss after 3.5 seconds
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div className={`toast ${type === 'success' ? 'toast-success' : 'toast-error'}`}>
      <span>{message}</span>
      <button onClick={onClose}>✕</button>
    </div>
  );
}

export default Toast;