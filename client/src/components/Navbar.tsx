import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  PlusCircle,
  LayoutDashboard,
  LogOut,
  User as UserIcon,
  Menu,
  X,
} from "lucide-react";

export const Navbar: React.FC = () => {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <Link
          to={user ? "/dashboard" : "/"}
          className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-flamingo rounded-lg p-1"
        >
          <img
            src="/snowdevs.png"
            alt="Snow Devs Logo"
            className="h-10 w-10 object-contain transition-transform group-hover:scale-105"
          />
          <span className="font-extrabold text-xl tracking-tight text-neutral-900">
            Snow <span className="text-flamingo">Forms</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2">
          {loading ? null : user ? (
            <>
              <Link
                to="/dashboard"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  isActive("/dashboard")
                    ? "bg-flamingo/10 text-flamingo font-semibold"
                    : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>

              <button
                onClick={() => navigate("/dashboard?action=new")}
                className="ml-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold text-white bg-flamingo hover:bg-flamingo-600 rounded-lg shadow-sm transition-all shadow-flamingo/20 active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                Create Form
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-3 py-2 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="px-4 py-2 text-sm font-semibold text-white bg-flamingo hover:bg-flamingo-600 rounded-lg shadow-sm shadow-flamingo/25 transition-all"
              >
                Get Started
              </Link>
            </>
          )}

          {/* User Profile & Logout */}
          {user && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
              <Link
                to="/profile"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm font-medium hover:bg-neutral-100 transition-colors text-neutral-800"
              >
                <div className="w-7 h-7 rounded-full bg-flamingo/15 text-flamingo font-bold flex items-center justify-center text-xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden lg:inline text-xs truncate max-w-[120px] font-medium">{user.name}</span>
              </Link>
              <button
                onClick={logout}
                title="Sign out"
                className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </nav>

        {/* Mobile menu button */}
        <div className="md:hidden flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-muted-foreground rounded-lg hover:bg-neutral-100"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-background p-4 space-y-3">
          {loading ? null : user ? (
            <>
              <div className="flex items-center gap-3 p-2 bg-neutral-50 rounded-lg">
                <div className="w-9 h-9 rounded-full bg-flamingo/20 text-flamingo font-bold flex items-center justify-center">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </div>
              </div>
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-neutral-800 hover:bg-neutral-100"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
              <Link
                to="/dashboard?action=new"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-flamingo rounded-lg"
              >
                <PlusCircle className="w-4 h-4" />
                Create New Form
              </Link>
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-neutral-800"
              >
                <UserIcon className="w-4 h-4" />
                Profile Settings
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2 text-sm font-medium border border-border rounded-lg"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 text-sm font-semibold text-white bg-flamingo rounded-lg"
              >
                Sign Up with Avantika Email
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
