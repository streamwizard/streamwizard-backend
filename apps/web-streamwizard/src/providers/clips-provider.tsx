"use client";
import { addClipToFolder, removeClipFromFolder } from "@/actions/supabase/clips/clips";
import { getFolderDisplayName } from "@/lib/utils/clip-folders";
import { Database } from "@repo/supabase";
import { useRouter } from "next/navigation";
import React, { createContext, useContext } from "react";
import { toast } from "sonner";
import { useSession } from "./session-provider";

type AddToFolderType = {
  folderName: string;
  folderId: string;
  clipId: string;
};

interface FolderContextType {
  folders: Database["public"]["Tables"]["clip_folders"]["Row"][];
  getAvailableFolders: (folderId: string[]) => Database["public"]["Tables"]["clip_folders"]["Row"][];
  getRemovableFolders: (folderId: string[]) => Database["public"]["Tables"]["clip_folders"]["Row"][];
  getFolderLabel: (folderId: string) => string;
  handleRemoveClipFromFolder: (folderId: string, clipId: string, folderName: string) => void;
  AddToFolder: ({ folderName, folderId, clipId }: AddToFolderType) => void;
}

const FolderContext = createContext<FolderContextType | undefined>(undefined);

interface Props {
  children: React.ReactNode;
  ClipFolders: Database["public"]["Tables"]["clip_folders"]["Row"][];
}

export function ClipFolderProvider({ children, ClipFolders }: Props) {
  // The folder list is owned by the server component above us; mirroring it into
  // state only bought an extra render per prop change.
  const folders = ClipFolders;
  const { id: userId } = useSession();
  const router = useRouter();

  // Get folders excluding the specified folder ID
  const getAvailableFolders = (excludedFolderIds: string[]) => {
    return folders
      .filter((folder) => !excludedFolderIds.includes(folder.id))
      .sort((a, b) => getFolderDisplayName(a, folders).localeCompare(getFolderDisplayName(b, folders)));
  };

  const getFolderLabel = (folderId: string) => {
    const folder = folders.find((item) => item.id === folderId);
    return folder ? getFolderDisplayName(folder, folders) : "";
  };

  // Get clips eligible for removal excluding specified folder IDs
  const getRemovableFolders = (excludedFolderIds: string[]) => {
    return folders.filter((folder) => excludedFolderIds.includes(folder.id));
  };




  // Add a clip to a folder
  const AddToFolder = ({ folderName, folderId, clipId }: AddToFolderType) => {
    toast.promise(
      async () => {
        const res = await addClipToFolder({ clipId, userId, folderId, folderName });
        if (!res.success) {
          throw new Error(res.message);
        }
        return res.message;
      },
      {
        loading: `Adding to ${folderName}`,
        success: `Added to ${folderName}`,
        error: `Failed to add to ${folderName}`,
        finally: () => router.refresh(),
      }
    );
  };

  const handleRemoveClipFromFolder = (folderId: string, clipId: string, folderName: string) => {
    toast.promise(
      async () => {
        const res = await removeClipFromFolder(clipId, folderId, userId);
        if (!res.success) {
          throw new Error(res.message);
        }
        return res.message;
      },
      {
        loading: `Removing from ${folderName}`,
        success: `Removed from ${folderName}`,
        error: `Failed to remove from ${folderName}`,
        finally: () => router.refresh(),
      }
    );
  };

  return (
    <FolderContext.Provider value={{ folders, getAvailableFolders, getRemovableFolders, getFolderLabel, AddToFolder, handleRemoveClipFromFolder }}>
      {children}
    </FolderContext.Provider>
  );
}

export function useClipFolders() {
  const context = useContext(FolderContext);
  if (context === undefined) {
    throw new Error("useClipFolders must be used within a ClipFolderProvider");
  }
  return context;
}
