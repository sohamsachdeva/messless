"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, ArrowLeft } from "lucide-react";

export default function DemoPaymentPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"processing" | "success" | "failed">("processing");
  const [progress, setProgress] = useState(0);

  // Get order details from sessionStorage
  const orderId = typeof window !== "undefined" ? sessionStorage.getItem("demoOrderId") : null;
  const total = typeof window !== "undefined" ? sessionStorage.getItem("demoTotal") : null;
  const vendor = typeof window !== "undefined" ? sessionStorage.getItem("demoVendor") : null;
  const method = typeof window !== "undefined" ? sessionStorage.getItem("demoPaymentMethod") : "UPI";

  // Simulate payment processing
  useEffect(() => {
    if (status !== "processing") return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + Math.random() * 15;
        if (next >= 100) {
          clearInterval(interval);
          setStatus("success");
          // Clear demo data after success
          setTimeout(() => {
            sessionStorage.removeItem("demoOrderId");
            sessionStorage.removeItem("demoTotal");
            sessionStorage.removeItem("demoVendor");
            sessionStorage.removeItem("demoPaymentMethod");
          }, 100);
          return 100;
        }
        return next;
      });
    }, 300);

    return () => clearInterval(interval);
  }, [status]);

  // Redirect to orders after success
  useEffect(() => {
    if (status === "success") {
      const timer = setTimeout(() => {
        router.push("/orders");
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [status, router]);

  if (status === "success") {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-[var(--bg-card)] rounded-2xl shadow-lg border border-green-100 dark:border-green-900/50 p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-20 w-20 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center animate-bounce">
              <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" strokeWidth={2} />
            </div>
          </div>
          <h2 className="text-2xl font-extrabold text-[var(--text-primary)]">Payment Successful! 🎉</h2>
          <p className="text-[var(--text-secondary)] text-sm mt-2">
            Your order at <strong>{vendor}</strong> has been confirmed.
          </p>            <div className="mt-4 p-4 bg-[var(--bg-elevated)] rounded-xl text-left">
            <div className="flex justify-between text-sm py-1">
              <span className="text-[var(--text-secondary)]">Order ID</span>
              <span className="font-medium text-[var(--text-primary)]">#{orderId?.slice(-6).toUpperCase()}</span>
            </div>
            <div className="flex justify-between text-sm py-1">
              <span className="text-[var(--text-secondary)]">Amount</span>
              <span className="font-bold text-[var(--primary)]">₹{total}</span>
            </div>
            <div className="flex justify-between text-sm py-1">
              <span className="text-[var(--text-secondary)]">Payment method</span>
              <span className="font-medium text-[var(--text-primary)]">{method}</span>
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-4">Redirecting to your orders...</p>
          <div className="mt-4 h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-[var(--primary)] rounded-full animate-pulse" style={{ width: "100%" }} />
          </div>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-[var(--bg-card)] rounded-2xl shadow-lg border border-rose-100 dark:border-rose-900/50 p-8 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-extrabold text-[var(--text-primary)]">Payment Failed</h2>
          <p className="text-[var(--text-secondary)] text-sm mt-2">Something went wrong with your payment. Please try again.</p>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                setStatus("processing");
                setProgress(0);
              }}
              className="flex-1 px-6 py-2.5 bg-[var(--primary)] text-white rounded-xl font-semibold hover:bg-[var(--primary-dark)] transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => router.push("/checkout")}
              className="flex-1 px-6 py-2.5 border border-[var(--border)] text-[var(--text-secondary)] rounded-xl font-semibold hover:bg-[var(--bg-elevated)] transition-colors"
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Processing state
  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-[var(--bg-card)] rounded-2xl shadow-lg border border-[var(--border)] p-8 text-center">
        {/* Back button */}
        <button
          onClick={() => router.push("/checkout")}
          className="absolute top-4 left-4 p-2 hover:bg-[var(--bg-elevated)] rounded-full transition-colors"
          style={{ position: "relative", marginBottom: 16 }}
        >
          <ArrowLeft className="h-5 w-5 text-[var(--text-secondary)]" />
        </button>

        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-[var(--primary-bg)] flex items-center justify-center">
              <Loader2 className="h-12 w-12 text-[var(--primary)] animate-spin" strokeWidth={2} />
            </div>
            {/* Pulsing ring */}
            <div className="absolute inset-0 rounded-full border-2 border-[var(--primary)]/20 animate-ping" />
          </div>
        </div>

        <h2 className="text-2xl font-extrabold text-[var(--text-primary)]">Processing Payment</h2>
        <p className="text-[var(--text-secondary)] text-sm mt-2">
          Please wait while we securely process your payment via <strong>{method}</strong>
        </p>

        {/* Progress bar */}
        <div className="mt-6">
          <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
            <span>Initiating</span>
            <span>{Math.round(progress)}%</span>
            <span>Confirming</span>
          </div>
          <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Order summary */}
        <div className="mt-6 p-4 bg-[var(--bg-elevated)] rounded-xl text-left">
          <div className="flex justify-between text-sm py-1">
            <span className="text-[var(--text-secondary)]">Vendor</span>
            <span className="font-medium text-[var(--text-primary)]">{vendor}</span>
          </div>
          <div className="flex justify-between text-sm py-1">
            <span className="text-[var(--text-secondary)]">Amount</span>
            <span className="font-bold text-[var(--primary)]">₹{total}</span>
          </div>
          <div className="flex justify-between text-sm py-1">
            <span className="text-[var(--text-secondary)]">Payment method</span>
            <span className="font-medium text-[var(--text-primary)]">{method}</span>
          </div>
        </div>

        {/* Status messages */}
        <div className="mt-4 space-y-2">
          {progress > 20 && (
            <p className="text-xs text-[var(--green)] flex items-center justify-center gap-2 animate-fadeIn">
              <span>✅</span> Payment initiated
            </p>
          )}
          {progress > 50 && (
            <p className="text-xs text-[var(--green)] flex items-center justify-center gap-2 animate-fadeIn">
              <span>✅</span> Bank processing
            </p>
          )}
          {progress > 80 && (
            <p className="text-xs text-[var(--green)] flex items-center justify-center gap-2 animate-fadeIn">
              <span>✅</span> Confirming transaction
            </p>
          )}
        </div>

        <p className="text-xs text-[var(--text-muted)] mt-6">
          🔒 Secured by Razorpay • Demo mode
        </p>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}