import { FileTypeIcon, FileIcon, ImageIcon, VideoIcon, MusicIcon } from "lucide-react";
import { getFileCategory } from "@/lib/validators";

export function getFileIcon(mimeType: string) {
  const cat = getFileCategory(mimeType);
  switch (cat) {
    case "image": return <ImageIcon className="w-5 h-5 text-green-500" />;
    case "video": return <VideoIcon className="w-5 h-5 text-purple-500" />;
    case "audio": return <MusicIcon className="w-5 h-5 text-pink-500" />;
    case "pdf": return <FileTypeIcon className="w-5 h-5 text-red-500" />;
    default: return <FileIcon className="w-5 h-5 text-gray-400" />;
  }
}

export function getFileTypeTag(mimeType: string, extension: string) {
  const cat = getFileCategory(mimeType);
  const label = extension.toUpperCase().slice(0, 4);
  let color = "bg-gray-100 text-gray-600";
  switch (cat) {
    case "image": color = "bg-green-100 text-green-700"; break;
    case "video": color = "bg-purple-100 text-purple-700"; break;
    case "audio": color = "bg-pink-100 text-pink-700"; break;
    case "pdf": color = "bg-red-100 text-red-700"; break;
    case "document": color = "bg-blue-100 text-blue-700"; break;
    case "spreadsheet": color = "bg-emerald-100 text-emerald-700"; break;
    case "presentation": color = "bg-orange-100 text-orange-700"; break;
    case "text": color = "bg-gray-100 text-gray-600"; break;
    case "archive": color = "bg-amber-100 text-amber-800"; break;
  }
  return { label, color };
}
