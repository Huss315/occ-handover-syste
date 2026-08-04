function ConfirmModal({ title, message, onConfirm, onCancel, confirmLabel = 'Yes', cancelLabel = 'No' }) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="btn-row" style={{ justifyContent: 'center', marginTop: 20 }}>
          <button className="btn-danger" onClick={onConfirm}>{confirmLabel}</button>
          <button className="btn-ghost" onClick={onCancel}>{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
