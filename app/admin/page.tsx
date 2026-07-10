// app/admin/page.tsx
// Redirect /admin → /admin/dashboard

import { redirect } from "next/navigation";

export default function AdminPage() {
  redirect("/admin/dashboard");
}
