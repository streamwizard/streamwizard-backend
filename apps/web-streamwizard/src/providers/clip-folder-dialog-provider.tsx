"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { captureEvent } from "@repo/posthog";
import { createClipFolder, deleteClipFolder, editClipFolder } from "@/actions/supabase/clips/clips";
import { useSession } from "@/providers/session-provider";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@repo/ui";

const folderNameSchema = z.object({
  name: z
    .string()
    .min(1, { message: "Folder name must be at least 1 character." })
    .max(255, { message: "Folder name must not exceed 255 characters." })
    .regex(/^[a-zA-Z0-9-_\s]+$/, {
      message: "Folder name can only contain letters, numbers, spaces, hyphens, and underscores.",
    }),
});

type FolderNameValues = z.infer<typeof folderNameSchema>;

type DialogState =
  | { mode: null }
  | { mode: "create"; parentFolderId?: string; parentFolderName?: string }
  | { mode: "rename"; folderId: string; folderName: string }
  | { mode: "delete"; folderId: string; folderName: string; hasSubfolders: boolean };

type ClipFolderDialogContextType = {
  openCreateFolder: (parentFolderId?: string, parentFolderName?: string) => void;
  openRenameFolder: (folderId: string, folderName: string) => void;
  openDeleteFolder: (folderId: string, folderName: string, hasSubfolders?: boolean) => void;
};

const ClipFolderDialogContext = createContext<ClipFolderDialogContextType | null>(null);

export function ClipFolderDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>({ mode: null });
  const { id: userId } = useSession();

  const openCreateFolder = useCallback((parentFolderId?: string, parentFolderName?: string) => {
    setState({ mode: "create", parentFolderId, parentFolderName });
  }, []);

  const openRenameFolder = useCallback((folderId: string, folderName: string) => {
    setState({ mode: "rename", folderId, folderName });
  }, []);

  const openDeleteFolder = useCallback((folderId: string, folderName: string, hasSubfolders = false) => {
    setState({ mode: "delete", folderId, folderName, hasSubfolders });
  }, []);

  const close = useCallback(() => setState({ mode: null }), []);

  return (
    <ClipFolderDialogContext.Provider value={{ openCreateFolder, openRenameFolder, openDeleteFolder }}>
      {children}
      <CreateRenameFolderDialog state={state} userId={userId} onClose={close} />
      <DeleteFolderDialog state={state} onClose={close} />
    </ClipFolderDialogContext.Provider>
  );
}

export function useClipFolderDialog() {
  const context = useContext(ClipFolderDialogContext);
  if (!context) throw new Error("useClipFolderDialog must be used within a ClipFolderDialogProvider");
  return context;
}

function CreateRenameFolderDialog({
  state,
  userId,
  onClose,
}: {
  state: DialogState;
  userId: string;
  onClose: () => void;
}) {
  const isOpen = state.mode === "create" || state.mode === "rename";
  const isRename = state.mode === "rename";

  const form = useForm<FolderNameValues>({
    resolver: zodResolver(folderNameSchema),
    values: {
      name: isRename && state.mode === "rename" ? state.folderName : "",
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(values: FolderNameValues) {
    setIsSubmitting(true);

    if (state.mode === "rename") {
      toast.promise(
        async () => {
          const res = await editClipFolder(state.folderId, values.name, userId);
          if (!res.success) throw new Error(res.message);
          return res.message;
        },
        {
          loading: "Updating folder...",
          success: "Folder updated successfully!",
          error: "Failed to update folder.",
          finally() {
            setIsSubmitting(false);
            onClose();
          },
        }
      );
    } else if (state.mode === "create") {
      toast.promise(
        async () => {
          const res = await createClipFolder(values.name, userId, state.parentFolderId);
          if (!res.success) throw new Error(res.message);
          captureEvent("clip_folder_created", { is_subfolder: !!state.parentFolderId });
          return res.message;
        },
        {
          loading: "Creating folder...",
          success: "Folder created successfully!",
          error: (err) => (err instanceof Error ? err.message : "Failed to create folder."),
          finally() {
            setIsSubmitting(false);
            onClose();
          },
        }
      );
    }
  }

  const parentFolderName = state.mode === "create" ? state.parentFolderName : undefined;
  const title = isRename ? "Rename Folder" : parentFolderName ? "Create Subfolder" : "Create Folder";
  const description = isRename
    ? "Enter a new name for this folder."
    : parentFolderName
      ? `This subfolder will be created inside "${parentFolderName}".`
      : "Enter a name for your new folder.";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Folder Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={parentFolderName ? `Inside ${parentFolderName}` : "My New Folder"}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isRename ? "Rename" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteFolderDialog({ state, onClose }: { state: DialogState; onClose: () => void }) {
  const isOpen = state.mode === "delete";
  const [isDeleting, setIsDeleting] = useState(false);

  function handleDelete() {
    if (state.mode !== "delete") return;
    setIsDeleting(true);
    toast.promise(
      async () => {
        const res = await deleteClipFolder(state.folderId);
        if (!res.success) throw new Error(res.message);
        return res.message;
      },
      {
        loading: "Deleting folder...",
        success: "Folder deleted successfully",
        error: "Failed to delete folder",
        finally() {
          setIsDeleting(false);
          onClose();
        },
      }
    );
  }

  const hasSubfolders = state.mode === "delete" ? state.hasSubfolders : false;
  const folderName = state.mode === "delete" ? state.folderName : "";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete &quot;{folderName}&quot;?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. The folder will be deleted, but clips inside it will remain available outside
            of this folder.
            {hasSubfolders ? " Any subfolders inside it will also be deleted." : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
