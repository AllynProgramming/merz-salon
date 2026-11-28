import { createContext, use, useEffect, useId, useRef } from "react";
import "./ui.css";

const ModalContext = createContext(null);

const useModal = () => {
  const context = use(ModalContext);
  if (!context) throw new Error("Modal parts must be used inside <Modal>.");
  return context;
};

/**
 * Accessible modal built on the native <dialog> element, which gives focus
 * trapping, Escape handling, the top layer and focus restoration for free.
 *
 * Render it only while it should be open: mounting opens it, unmounting
 * closes it, so the form inside starts fresh every time.
 *
 *   {editing && (
 *     <Modal onClose={close} size="wide">
 *       <Modal.Header>
 *         <Modal.Title>Edit service</Modal.Title>
 *         <Modal.Close />
 *       </Modal.Header>
 *       <Modal.Body>…</Modal.Body>
 *       <Modal.Footer>…</Modal.Footer>
 *     </Modal>
 *   )}
 *
 * `onClose` runs for Escape, the close button and a click on the backdrop.
 * To keep the modal open (for example while saving), ignore the call.
 */
function Modal({ onClose, size = "default", role, className = "", children }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const pressStartedOnBackdrop = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    // React removes the <dialog> from the page on close, which skips the
    // browser's own focus restore, so return focus to the opener ourselves.
    const opener = document.activeElement;
    if (dialog && !dialog.open) {
      dialog.showModal();
      // Start in the field marked data-autofocus (desktop only: on touch
      // screens it would pop the keyboard over the form). Otherwise focus the
      // dialog itself rather than the close button, so a stray Enter does
      // nothing.
      const preferred = dialog.querySelector("[data-autofocus]");
      if (preferred && window.matchMedia("(pointer: fine)").matches) {
        preferred.focus();
      } else {
        dialog.focus();
      }
    }
    return () => {
      if (dialog?.open) dialog.close();
      // Wait a frame: the opener may be re-enabled in the same render.
      window.requestAnimationFrame(() => {
        if (opener?.isConnected && typeof opener.focus === "function") {
          opener.focus({ preventScroll: true });
        }
      });
    };
  }, []);

  return (
    <ModalContext value={{ onClose, titleId, descriptionId }}>
      <dialog
        ref={dialogRef}
        className={`ui-modal ui-modal--${size} ${className}`.trim()}
        role={role}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onCancel={(event) => {
          // Escape: let the owner decide, instead of the browser closing the
          // dialog behind React's back.
          event.preventDefault();
          onClose?.();
        }}
        // Close on a backdrop click, but not when a text selection that
        // started inside the dialog ends outside it.
        onPointerDown={(event) => {
          pressStartedOnBackdrop.current = event.target === event.currentTarget;
        }}
        onClick={(event) => {
          if (
            pressStartedOnBackdrop.current &&
            event.target === event.currentTarget
          ) {
            onClose?.();
          }
          pressStartedOnBackdrop.current = false;
        }}
      >
        <div className="ui-modal__surface">{children}</div>
      </dialog>
    </ModalContext>
  );
}

function ModalHeader({ children }) {
  return <header className="ui-modal__header">{children}</header>;
}

function ModalEyebrow({ children }) {
  return <p className="ui-modal__eyebrow">{children}</p>;
}

function ModalTitle({ children }) {
  const { titleId } = useModal();
  return (
    <h2 className="ui-modal__title" id={titleId}>
      {children}
    </h2>
  );
}

function ModalDescription({ children }) {
  const { descriptionId } = useModal();
  return (
    <p className="ui-modal__description" id={descriptionId}>
      {children}
    </p>
  );
}

function ModalClose({ label = "Close" }) {
  const { onClose } = useModal();
  return (
    <button
      className="ui-modal__close"
      type="button"
      aria-label={label}
      onClick={() => onClose?.()}
    >
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        <path
          d="M5 5l10 10M15 5L5 15"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

function ModalBody({ children }) {
  return <div className="ui-modal__body">{children}</div>;
}

function ModalFooter({ children }) {
  return <footer className="ui-modal__footer">{children}</footer>;
}

Modal.Header = ModalHeader;
Modal.Eyebrow = ModalEyebrow;
Modal.Title = ModalTitle;
Modal.Description = ModalDescription;
Modal.Close = ModalClose;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

export default Modal;
