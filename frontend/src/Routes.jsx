import { createBrowserRouter, RouterProvider } from "react-router-dom";
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import ProtectedRoute from "./components/customer/ProtectedRoute.jsx";
import ServicesPage from "./pages/ServicesPage.jsx";
import BookingPage from "./pages/BookingPage.jsx";
import AppointmentPage from "./pages/AppointmentPage.jsx";
import ReschedulePage from "./pages/ReschedulePage.jsx";
import BookingConfirmationPage from "./pages/BookingConfirmationPage.jsx";
import AppointmentsPage from "./pages/AppointmentsPage.jsx";
import AdminDashboardPage from "./pages/AdminDashboardPage.jsx";
import AdminSchedulePage from "./pages/AdminSchedulePage.jsx";
import AdminServicesPage from "./pages/AdminServicesPage.jsx";
import AdminFeedbackPage from "./pages/AdminFeedbackPage.jsx";

function Routes() {
  const routes = createBrowserRouter([
    { path: "/", element: <LandingPage /> },
    { path: "/services", element: <ServicesPage /> },
    { path: "/login", element: <LoginPage /> },
    { path: "/register", element: <RegisterPage /> },
    {
      element: <ProtectedRoute />,
      children: [
        { path: "/dashboard", element: <DashboardPage /> },
        { path: "/profile", element: <ProfilePage /> },
        { path: "/book-appointment", element: <BookingPage /> },
        { path: "/appointments", element: <AppointmentsPage /> },
        { path: "/appointments/:id", element: <AppointmentPage /> },
        { path: "/appointments/:id/reschedule", element: <ReschedulePage /> },
        {
          path: "/appointments/:id/confirmation",
          element: <BookingConfirmationPage />,
        },
      ],
    },
    {
      element: <ProtectedRoute allowedRoles={["staff", "admin"]} />,
      children: [
        { path: "/admin", element: <AdminDashboardPage /> },
        { path: "/admin/schedule", element: <AdminSchedulePage /> },
      ],
    },
    {
      element: <ProtectedRoute allowedRoles={["admin"]} />,
      children: [
        { path: "/admin/services", element: <AdminServicesPage /> },
        { path: "/admin/feedback", element: <AdminFeedbackPage /> },
      ],
    },
  ]);

  return <RouterProvider router={routes} />;
}

export default Routes;
