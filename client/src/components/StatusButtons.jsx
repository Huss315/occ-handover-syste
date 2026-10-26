const OPTIONS = [
  { value: 'NotDone', label: 'Not Done' },
  { value: 'Running', label: 'Running' },
  { value: 'Done', label: 'Done' },
  { value: 'Ignore', label: 'Ignore' },
];

function StatusButtons({ value, onChange, disabled = false }) {
  return (
    <div className="status-buttons" role="group" aria-label="Task status">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          className={`status-btn ${value === opt.value ? `active-${opt.value.toLowerCase()}` : ''}`}
          aria-pressed={value === opt.value}
          onClick={() => value !== opt.value && onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default StatusButtons;