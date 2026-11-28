import Modal from "./Modal.jsx";

const toneButtonClass = {
  danger: "customer-button customer-button-danger",
  primary: "customer-button customer-button-primary",
};

/**
 * A yes/no question in a modal, styled to match the admin pages. Use it for
 * anything destructive or hard to undo instead of window.confirm.
 */
function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = "Go back",
  tone = "primary",
  onConfirm,
  onCancel,
}) {
  return (
    <Modal onClose={onCancel} size="narrow" role="alertdialog">
      <Modal.Header>
        <div>
          <Modal.Title>{title}</Modal.Title>
          {description && <Modal.Description>{description}</Modal.Description>}
        </div>
      </Modal.Header>
      <Modal.Footer>
        <button
          className="customer-button customer-button-outline"
          type="button"
          onClick={onCancel}
          // The safe choice gets focus first, so Enter never destroys data.
          data-autofocus
        >
          {cancelLabel}
        </button>
        <button className={toneButtonClass[tone]} type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </Modal.Footer>
    </Modal>
  );
}

export default ConfirmDialog;
