import { db } from "@/lib/db";
import { formatFileSize } from "@/lib/validators";
import { DownloadIcon, FileIcon, TrendingUpIcon } from "lucide-react";

export default async function StatsPage() {
  // Top downloaded files
  const topFiles = await db.file.findMany({
    orderBy: { downloadCount: "desc" },
    take: 20,
    include: { folder: true },
  });

  // Recent downloads
  const recentDownloads = await db.downloadLog.findMany({
    orderBy: { downloadedAt: "desc" },
    take: 30,
    include: {
      file: true,
      user: { select: { name: true, email: true } },
    },
  });

  // Total stats
  const totalFiles = await db.file.count();
  const totalSize = await db.file.aggregate({ _sum: { size: true } });
  const totalDownloads = await db.downloadLog.count();

  return (
    <div className="p-4 sm:p-8 overflow-y-auto h-full">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Statistik</h1>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <FileIcon className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{totalFiles}</p>
              <p className="text-sm text-gray-500">Total File</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <TrendingUpIcon className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">
                {formatFileSize(totalSize._sum.size || BigInt(0))}
              </p>
              <p className="text-sm text-gray-500">Total Penyimpanan</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <DownloadIcon className="w-8 h-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{totalDownloads}</p>
              <p className="text-sm text-gray-500">Total Download</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Downloaded */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            File Paling Banyak Didownload
          </h2>
          <div className="space-y-3">
            {topFiles.map((file, index) => (
              <div
                key={file.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-bold text-gray-400 w-6">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {file.folder?.name || "Root"} •{" "}
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-medium text-blue-600 ml-2">
                  {file.downloadCount}x
                </span>
              </div>
            ))}
            {topFiles.length === 0 && (
              <p className="text-sm text-gray-500">Belum ada data download.</p>
            )}
          </div>
        </div>

        {/* Recent Downloads */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Download Terbaru
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {recentDownloads.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {log.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {log.user?.name || "Anonymous"} •{" "}
                    {log.ipAddress || "Unknown IP"}
                  </p>
                </div>
                <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                  {new Date(log.downloadedAt).toLocaleString("id-ID")}
                </span>
              </div>
            ))}
            {recentDownloads.length === 0 && (
              <p className="text-sm text-gray-500">Belum ada download.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
