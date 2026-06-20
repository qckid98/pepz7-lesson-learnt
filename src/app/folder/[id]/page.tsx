import { redirect } from "next/navigation";

// Folder navigation is now handled client-side by ViewerFileManager
// This route redirects to homepage for backwards compatibility
export default async function FolderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/?folder=${id}`);
}
