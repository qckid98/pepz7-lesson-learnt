import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getPreviewPresignedUrl } from "@/lib/s3";
import { formatFileSize, getFileCategory } from "@/lib/validators";
import {
  ArrowLeftIcon,
  DownloadIcon,
  FileIcon,
  CalendarIcon,
} from "lucide-react";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const file = await db.file.findUnique({
    where: { id },
    include: { folder: true },
  });

  if (!file) notFound();

  // Check access for private folders
  if (file.folder?.visibility === "PRIVATE" && !session?.user) {
    redirect("/login");
  }

  // Generate preview URL
  const previewUrl = await getPreviewPresignedUrl(
    file.s3Key,
    file.mimeType,
    3600
  );

  const category = getFileCategory(file.mimeType);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Top Bar */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={file.folderId ? `/folder/${file.folderId}` : "/"}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span className="text-sm">Kembali</span>
          </Link>
          <div className="hidden sm:flex items-center gap-2">
            <FileIcon className="w-4 h-4 text-gray-400" />
            <span className="text-white font-medium text-sm truncate max-w-md">
              {file.name}
            </span>
          </div>
        </div>
        <a
          href={`/api/files/${file.id}/download`}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
        >
          <DownloadIcon className="w-4 h-4" />
          Download
        </a>
      </header>

      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center p-4">
        {category === "pdf" && (
          <iframe
            src={previewUrl}
            className="w-full max-w-4xl h-[80vh] rounded-lg bg-white"
            title={file.name}
          />
        )}

        {category === "image" && (
          <img
            src={previewUrl}
            alt={file.name}
            className="max-w-full max-h-[80vh] object-contain rounded-lg"
          />
        )}

        {category === "video" && (
          <video
            src={previewUrl}
            controls
            className="max-w-full max-h-[80vh] rounded-lg"
          >
            Browser Anda tidak mendukung pemutaran video.
          </video>
        )}

        {category === "audio" && (
          <div className="bg-gray-800 p-8 rounded-2xl text-center">
            <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileIcon className="w-12 h-12 text-gray-400" />
            </div>
            <p className="text-white font-medium mb-4">{file.name}</p>
            <audio src={previewUrl} controls className="w-full max-w-md">
              Browser Anda tidak mendukung pemutaran audio.
            </audio>
          </div>
        )}

        {category === "text" && (
          <iframe
            src={previewUrl}
            className="w-full max-w-4xl h-[80vh] rounded-lg bg-white"
            title={file.name}
          />
        )}

        {!["pdf", "image", "video", "audio", "text"].includes(category) && (
          <div className="bg-gray-800 p-12 rounded-2xl text-center max-w-md">
            <div className="w-20 h-20 bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FileIcon className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-white font-medium text-lg mb-2">{file.name}</p>
            <p className="text-gray-400 text-sm mb-6">
              Preview tidak tersedia untuk jenis file ini.
              <br />
              Silakan download untuk membuka file.
            </p>
            <a
              href={`/api/files/${file.id}/download`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
            >
              <DownloadIcon className="w-5 h-5" />
              Download File
            </a>
          </div>
        )}
      </div>

      {/* File Info Bar */}
      <footer className="bg-gray-800 border-t border-gray-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-sm text-gray-400">
          <div className="flex items-center gap-4">
            <span>{file.extension.toUpperCase()}</span>
            <span>{formatFileSize(file.size)}</span>
            <span className="hidden sm:inline flex items-center gap-1">
              <CalendarIcon className="w-3 h-3 inline" />{" "}
              {new Date(file.createdAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
          <span>{file.downloadCount}x didownload</span>
        </div>
      </footer>
    </div>
  );
}
