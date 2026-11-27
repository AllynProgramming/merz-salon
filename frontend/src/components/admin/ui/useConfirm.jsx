import { useCallback, useRef, useState } from "react";
import ConfirmDialog from "./ConfirmDialog.jsx";

/**
 * Promise-based confirmation, a drop-in for window.confirm:
 *
 *   const [confirm, confirmDialog] = useConfirm();
 *   if (!(await confirm({ title, description, confirmLabel, tone }))) return;
 *   …
 *   return <>{…}{confirmDialog}</>;
 */
export default function useConfirm() {
  const [request, setRequest] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolveRef.current?.(false);
        resolveRef.current = resolve;
        setRequest(options);
      }),
    [],
  );

  const settle = (answer) => {
    resolveRef.current?.(answer);
    resolveRef.current = null;
    setRequest(null);
  };

  const dialog = request ? (
    <ConfirmDialog
      {...request}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null;

  return [confirm, dialog];
}

