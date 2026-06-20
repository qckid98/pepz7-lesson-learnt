import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
  }
}

export interface FileItem {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: bigint;
  extension: string;
  s3Key: string;
  folderId: string | null;
  uploadedBy: string;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    files: number;
    children: number;
  };
}

export interface BreadcrumbItem {
  id: string;
  name: string;
}
