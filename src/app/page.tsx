import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Header from "@/components/layout/Header";
import ViewerFileManager from "@/components/file-manager/ViewerFileManager";

export default async function HomePage() {
  const session = await auth();

  // Double-check: middleware should already handle this
  if (!session?.user) {
    redirect("/login");
  }

  const isAdmin = session.user.role === "ADMIN";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header
        title="File Sharing"
        showAdminLink={isAdmin}
        showLogout
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <ViewerFileManager />
    </div>
  );
}
