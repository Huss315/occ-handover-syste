function Toast({ message, type = 'success', onClose }) {
  const bgColor = type === 'success' ? '#27ae60' : '#c0392b';
  return (
    <div style={{
      position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
      background: bgColor, color: 'white', padding: '12px 24px',
      borderRadius: 6, boxShadow: '0 2px 10px rgba(0,0,0,0.2)', zIndex: 1100,
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <span>{message}</span>
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 16 }}
      >
        ✕
      </button>
    </div>
  );
}

export default Toast;
