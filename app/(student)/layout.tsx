import Navbar from "@/components/shared/Navbar";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}
