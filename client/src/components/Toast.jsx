function Toast({ message, type = 'success', onClose }) {
  return (
    <div className={`toast ${type === 'success' ? 'toast-success' : 'toast-error'}`}>
      <span>{message}</span>
      <button onClick={onClose}>✕</button>
    </div>
  );
}

export default Toast;
