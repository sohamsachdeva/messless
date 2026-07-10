"use client";
// app/admin/vendors/page.tsx

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type Vendor = {
  id: string;
  name: string;
  location: string;
  phone: string | null;
  category: string;
  isApproved: boolean;
  isActive: boolean;
  createdAt: string;
  hubId: string | null;
  hub: { id: string; name: string } | null;
  owner: { name: string; email: string | null };
};

type Hub = {
  id: string;
  name: string;
  description: string | null;
};

export default function AdminVendorsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [vendors, setVendors]         = useState<Vendor[]>([]);
  const [hubs, setHubs]               = useState<Hub[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState<"pending" | "approved" | "all">("pending");
  const [actionId, setActionId]       = useState<string | null>(null);

  // Hub selector state — which vendor is being approved + selected hub
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [selectedHub, setSelectedHub] = useState<string>("");
  const [hubError, setHubError]       = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;
    if ((session?.user as any)?.role !== "ADMIN") { router.push("/"); return; }
    fetchAll();
  }, [status, session, router]);

  async function fetchAll() {
    const [vendorRes, hubRes] = await Promise.all([
      fetch("/api/admin/vendors"),
      fetch("/api/hubs"),
    ]);
    setVendors(await vendorRes.json());
    setHubs(await hubRes.json());
    setLoading(false);
  }

  // Called when admin clicks the green Approve button
  function startApproval(vendorId: string) {
    setApprovingId(vendorId);
    setSelectedHub("");
    setHubError(null);
  }

  // Called after hub is selected and admin clicks Confirm
  async function confirmApproval() {
    if (!approvingId) return;
    if (!selectedHub) {
      setHubError("Please select a hub before approving.");
      return;
    }

    setActionId(approvingId);
    await fetch(`/api/admin/vendors/${approvingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", hubId: selectedHub }),
    });

    setApprovingId(null);
    setSelectedHub("");
    await fetchAll();
    setActionId(null);
  }

  async function handleReject(vendorId: string) {
    setActionId(vendorId);
    await fetch(`/api/admin/vendors/${vendorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" }),
    });
    await fetchAll();
    setActionId(null);
  }

  async function handleRevoke(vendorId: string) {
    setActionId(vendorId);
    await fetch(`/api/admin/vendors/${vendorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" }),
    });
    await fetchAll();
    setActionId(null);
  }

  const filtered = vendors.filter((v) =>
    filter === "pending"  ? !v.isApproved :
    filter === "approved" ? v.isApproved  : true
  );
  const pendingCount = vendors.filter((v) => !v.isApproved).length;

  if (loading) return <div className="centered-state"><div className="spinner" /></div>;

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)" }}>

      {/* Header */}
      <div style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)", padding: "16px 24px 0", position: "sticky", top: 60, zIndex: 30 }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>Vendor Registrations</h1>
              {pendingCount > 0 && (
                <p style={{ fontSize: 13, color: "var(--amber)", fontWeight: 600, marginTop: 2 }}>
                  {pendingCount} pending your approval
                </p>
              )}
            </div>
          </div>
          {/* Filter tabs */}
          <div style={{ display: "flex" }}>
            {(["pending", "approved", "all"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "8px 16px", fontSize: 13, fontWeight: 600,
                background: "none", border: "none",
                borderBottom: filter === f ? "2.5px solid var(--primary)" : "2.5px solid transparent",
                color: filter === f ? "var(--primary)" : "var(--text-secondary)",
                cursor: "pointer", textTransform: "capitalize" as const,
              }}>
                {f}{f === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 20px 60px" }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p style={{ fontSize: 32, marginBottom: 12 }}>🎉</p>
            <p>{filter === "pending" ? "No pending registrations" : "No vendors found"}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((vendor) => (
              <div key={vendor.id} style={{
                background: "var(--bg-card)",
                border: !vendor.isApproved ? "1.5px solid var(--amber-border)" : "1px solid var(--border)",
                borderRadius: 16, padding: "20px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>

                  {/* Vendor info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>{vendor.name}</h3>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                        background: vendor.isApproved ? "var(--green-bg)" : "var(--amber-bg)",
                        color: vendor.isApproved ? "var(--green)" : "var(--amber)",
                      }}>
                        {vendor.isApproved ? "Approved" : "Pending"}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <span className="info-chip">👤 {vendor.owner.name}</span>
                      {vendor.owner.email ? <span className="info-chip">✉️ {vendor.owner.email}</span> : <span className="info-chip">✉️ No email (phone-based)</span>}
                      {vendor.phone && <span className="info-chip">📱 {vendor.phone}</span>}
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className="info-chip">🗂️ {vendor.category}</span>
                      {vendor.hub ? (
                        <span style={{ fontSize: 12, color: "var(--green)", background: "var(--green-bg)", border: "1px solid var(--green-border)", padding: "4px 10px", borderRadius: 20 }}>
                          🏪 {vendor.hub.name}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--amber)", background: "var(--amber-bg)", border: "1px solid var(--amber-border)", padding: "4px 10px", borderRadius: 20 }}>
                          🏪 No hub assigned
                        </span>
                      )}
                      <span className="info-chip">
                        📅 {new Date(vendor.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                    {!vendor.isApproved && approvingId !== vendor.id && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => startApproval(vendor.id)}
                          disabled={actionId === vendor.id}
                          className="btn-primary"
                          style={{ padding: "9px 18px", fontSize: 13 }}
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() => handleReject(vendor.id)}
                          disabled={actionId === vendor.id}
                          style={{ padding: "9px 18px", fontSize: 13, fontWeight: 600, background: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red-border)", borderRadius: 8, cursor: "pointer" }}
                        >
                          {actionId === vendor.id ? "..." : "❌ Reject"}
                        </button>
                      </div>
                    )}

                    {vendor.isApproved && (
                      <button
                        onClick={() => handleRevoke(vendor.id)}
                        disabled={actionId === vendor.id}
                        style={{ padding: "8px 14px", fontSize: 12, fontWeight: 600, background: "var(--bg-page)", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}
                      >
                        {actionId === vendor.id ? "..." : "Revoke approval"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Hub selector — shown when this vendor is being approved */}
                {approvingId === vendor.id && (
                  <div style={{ marginTop: 16, padding: "16px", background: "var(--bg-page)", borderRadius: 12, border: "1px solid var(--border)" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>
                      Assign to a hub before approving
                    </p>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                      {hubs.map((hub) => (
                        <button
                          key={hub.id}
                          onClick={() => { setSelectedHub(hub.id); setHubError(null); }}
                          style={{
                            padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                            border: selectedHub === hub.id ? "2px solid var(--primary)" : "1.5px solid var(--border)",
                            background: selectedHub === hub.id ? "var(--primary-bg)" : "var(--bg-card)",
                            color: selectedHub === hub.id ? "var(--primary)" : "var(--text-secondary)",
                            cursor: "pointer", transition: "all 0.15s",
                          }}
                        >
                          {hub.name}
                          {hub.description && (
                            <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", fontWeight: 400, marginTop: 2 }}>
                              {hub.description.slice(0, 30)}...
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {hubError && (
                      <p style={{ fontSize: 12, color: "var(--red)", marginBottom: 10 }}>{hubError}</p>
                    )}

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={confirmApproval}
                        disabled={actionId === vendor.id}
                        className="btn-primary"
                        style={{ padding: "10px 20px", fontSize: 13 }}
                      >
                        {actionId === vendor.id ? "Approving..." : `✅ Confirm — assign to ${hubs.find(h => h.id === selectedHub)?.name ?? "..."}`}
                      </button>
                      <button
                        onClick={() => { setApprovingId(null); setSelectedHub(""); setHubError(null); }}
                        style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, background: "none", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-secondary)", cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
