import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import AppShell from "./components/AppShell";
import { Spinner } from "./components/ui";
import type { Role } from "./types";
import Login from "./pages/Login";
import ProgressPage from "./pages/ProgressPage";
import ResultsPage from "./pages/ResultsPage";
import ReviewPage from "./pages/ReviewPage";
import StudentHome from "./pages/StudentHome";
import TeacherDashboard from "./pages/TeacherDashboard";
import TeacherStudent from "./pages/TeacherStudent";
import TestPage from "./pages/TestPage";

function Guard({ role, children }: { role: Role; children: ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-full place-items-center"><Spinner size={28} /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={user.role === "teacher" ? "/teacher" : "/"} replace />;
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Guard role="student"><StudentHome /></Guard>} />
      <Route path="/test/:topicId" element={<Guard role="student"><TestPage /></Guard>} />
      <Route path="/results/:attemptId" element={<Guard role="student"><ResultsPage /></Guard>} />
      <Route path="/review/:attemptId" element={<Guard role="student"><ReviewPage /></Guard>} />
      <Route path="/progress" element={<Guard role="student"><ProgressPage /></Guard>} />
      <Route path="/teacher" element={<Guard role="teacher"><TeacherDashboard /></Guard>} />
      <Route path="/teacher/student/:id" element={<Guard role="teacher"><TeacherStudent /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
