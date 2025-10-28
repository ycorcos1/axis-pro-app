/**
 * Toast Notification Component
 * @mem ref: pr11-project-save-load
 * Simple toast notification system for user feedback
 */

import React, { useEffect, useState } from "react";
import "./Toast.css";

export type ToastType = "success" | "warning" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger fade-in animation
    setIsVisible(true);

    // Auto-dismiss after 3 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onDismiss(toast.id), 300); // Wait for fade-out
    }, 3000);

    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`toast toast-${toast.type} ${
        isVisible ? "toast-visible" : ""
      }`}
      onClick={() => {
        setIsVisible(false);
        setTimeout(() => onDismiss(toast.id), 300);
      }}
    >
      <span className="toast-message">{toast.message}</span>
    </div>
  );
};

export default Toast;
