import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IpcClient } from "@/ipc/ipc_client";

/**
 * Represents a prompt item.
 * @interface
 */
export interface PromptItem {
  /** The ID of the prompt. */
  id: number;
  /** The title of the prompt. */
  title: string;
  /** A description of the prompt. */
  description: string | null;
  /** The content of the prompt. */
  content: string;
  /** The creation date of the prompt. */
  createdAt: Date;
  /** The last update date of the prompt. */
  updatedAt: Date;
}

/**
 * A hook for managing prompts.
 * @returns {object} An object with the list of prompts, loading state, error, and functions to manage prompts.
 * @property {PromptItem[]} prompts - The list of prompts.
 * @property {boolean} isLoading - Whether the prompts are being loaded.
 * @property {Error | null} error - The error object if the query fails.
 * @property {() => void} refetch - A function to refetch the prompts.
 * @property {(params: { title: string; description?: string; content: string; }) => Promise<PromptItem>} createPrompt - A function to create a new prompt.
 * @property {(params: { id: number; title: string; description?: string; content: string; }) => Promise<void>} updatePrompt - A function to update a prompt.
 * @property {(id: number) => Promise<void>} deletePrompt - A function to delete a prompt.
 */
export function usePrompts() {
  const queryClient = useQueryClient();
  const listQuery = useQuery({
    queryKey: ["prompts"],
    queryFn: async (): Promise<PromptItem[]> => {
      const ipc = IpcClient.getInstance();
      return ipc.listPrompts();
    },
    meta: { showErrorToast: true },
  });

  const createMutation = useMutation({
    mutationFn: async (params: {
      title: string;
      description?: string;
      content: string;
    }): Promise<PromptItem> => {
      const ipc = IpcClient.getInstance();
      return ipc.createPrompt(params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
    },
    meta: {
      showErrorToast: true,
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (params: {
      id: number;
      title: string;
      description?: string;
      content: string;
    }): Promise<void> => {
      const ipc = IpcClient.getInstance();
      return ipc.updatePrompt(params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
    },
    meta: {
      showErrorToast: true,
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number): Promise<void> => {
      const ipc = IpcClient.getInstance();
      return ipc.deletePrompt(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
    },
    meta: {
      showErrorToast: true,
    },
  });

  return {
    prompts: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    refetch: listQuery.refetch,
    createPrompt: createMutation.mutateAsync,
    updatePrompt: updateMutation.mutateAsync,
    deletePrompt: deleteMutation.mutateAsync,
  };
}
