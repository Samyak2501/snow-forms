import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { SignupPage } from "./pages/auth/SignupPage";
import { VerifyOtpPage } from "./pages/auth/VerifyOtpPage";
import { SetPasswordPage } from "./pages/auth/SetPasswordPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FormEditorPage } from "./pages/FormEditorPage";
import { PublicFormPage } from "./pages/PublicFormPage";
import { ProfilePage } from "./pages/ProfilePage";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-alabaster dark:bg-neutral-950">
        <div className="w-8 h-8 border-3 border-flamingo border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Form Renderer without standard navbar */}
          <Route path="/forms/:publicId" element={<PublicFormPage />} />
          <Route path="/forms/:publicId/success" element={<PublicFormPage />} />

          {/* Form Editor with customized top bar */}
          <Route
            path="/editor/:id"
            element={
              <ProtectedRoute>
                <FormEditorPage />
              </ProtectedRoute>
            }
          />

          {/* Standard app pages with Navbar */}
          <Route
            path="*"
            element={
              <div className="min-h-screen flex flex-col bg-alabaster dark:bg-neutral-950">
                <Navbar />
                <div className="flex-1">
                  <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route path="/verify-otp" element={<VerifyOtpPage />} />
                    <Route path="/set-password" element={<SetPasswordPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />

                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute>
                          <DashboardPage />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/profile"
                      element={
                        <ProtectedRoute>
                          <ProfilePage />
                        </ProtectedRoute>
                      }
                    />

                    {/* 404 */}
                    <Route
                      path="*"
                      element={
                        <div className="min-h-[60vh] flex flex-col items-center justify-center p-4 text-center">
                          <h1 className="text-4xl font-extrabold text-flamingo">404</h1>
                          <p className="text-sm text-muted-foreground mt-2 mb-4">
                            The page you requested could not be found.
                          </p>
                          <a
                            href="/"
                            className="px-4 py-2 bg-flamingo text-white text-xs font-semibold rounded-xl"
                          >
                            Return Home
                          </a>
                        </div>
                      }
                    />
                  </Routes>
                </div>
              </div>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
