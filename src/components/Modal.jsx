export default function Modal({ children, onClose }) {
  return (
    <div className="modal-bg open">
      <div className="modal">
        <button className="x" onClick={onClose} aria-label="Close">✕</button>
        {children}
      </div>
    </div>
  );
}
