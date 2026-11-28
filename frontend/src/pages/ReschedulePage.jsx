import { Navigate, useParams } from "react-router-dom";

/**
 * Rescheduling now happens in a modal on the appointment details page.
 * This route stays so older links (bookmarks, notifications) keep working:
 * it opens the details page with the reschedule modal already open.
 */
function ReschedulePage() {
  const { id } = useParams();
  return (
    <Navigate
      to={`/appointments/${encodeURIComponent(id)}`}
      replace
      state={{ openReschedule: true }}
    />
  );
}

export default ReschedulePage;
