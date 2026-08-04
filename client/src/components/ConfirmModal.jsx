
function ConfirmModal({ title, message, onConfirm, onCancel, confirmLabel = 'Yes', cancelLabel = 'No' }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'white', padding: 24, borderRadius: 8,
        maxWidth: 400, width: '90%', textAlign: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      }}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <p>{message}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
          <button
            onClick={onConfirm}
            style={{ padding: '10px 24px', background: '#c0392b', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            style={{ padding: '10px 24px', background: '#eee', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
