import { useCallback } from "react";
import type {
  ComponentSelection,
  Message,
  FileAttachment,
} from "@/ipc/ipc_types";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  chatErrorByIdAtom,
  chatMessagesByIdAtom,
  chatStreamCountByIdAtom,
  isStreamingByIdAtom,
  recentStreamChatIdsAtom,
} from "@/atoms/chatAtoms";
import { IpcClient } from "@/ipc/ipc_client";
import { isPreviewOpenAtom } from "@/atoms/viewAtoms";
import type { ChatResponseEnd } from "@/ipc/ipc_types";
import { useChats } from "./useChats";
import { useLoadApp } from "./useLoadApp";
import { selectedAppIdAtom } from "@/atoms/appAtoms";
import { useVersions } from "./useVersions";
import { showExtraFilesToast } from "@/lib/toast";
import { useProposal } from "./useProposal";
import { useSearch } from "@tanstack/react-router";
import { useRunApp } from "./useRunApp";
import { useCountTokens } from "./useCountTokens";
import { useUserBudgetInfo } from "./useUserBudgetInfo";
import { usePostHog } from "posthog-js/react";
import { useCheckProblems } from "./useCheckProblems";
import { useSettings } from "./useSettings";

export function getRandomNumberId() {
  return Math.floor(Math.random() * 1_000_000_000_000_000);
}

export function useStreamChat({
  hasChatId = true,
}: { hasChatId?: boolean } = {}) {
  const setMessagesById = useSetAtom(chatMessagesByIdAtom);
  const isStreamingById = useAtomValue(isStreamingByIdAtom);
  const setIsStreamingById = useSetAtom(isStreamingByIdAtom);
  const errorById = useAtomValue(chatErrorByIdAtom);
  const setErrorById = useSetAtom(chatErrorByIdAtom);
  const setIsPreviewOpen = useSetAtom(isPreviewOpenAtom);
  const [selectedAppId] = useAtom(selectedAppIdAtom);
  const { refreshChats } = useChats(selectedAppId);
  const { refreshApp } = useLoadApp(selectedAppId);

  const setStreamCountById = useSetAtom(chatStreamCountByIdAtom);
  const { refreshVersions } = useVersions(selectedAppId);
  const { refreshAppIframe } = useRunApp();
  const { countTokens } = useCountTokens();
  const { refetchUserBudget } = useUserBudgetInfo();
  const { checkProblems } = useCheckProblems(selectedAppId);
  const { settings } = useSettings();
  const setRecentStreamChatIds = useSetAtom(recentStreamChatIdsAtom);
  const posthog = usePostHog();
  let chatId: number | undefined;

  if (hasChatId) {
    const { id } = useSearch({ from: "/chat" });
    chatId = id;
  }
  let { refreshProposal } = hasChatId ? useProposal(chatId) : useProposal();

  const streamMessage = useCallback(
    async ({
      prompt,
      chatId,
      redo,
      attachments,
      selectedComponent,
    }: {
      prompt: string;
      chatId: number;
      redo?: boolean;
      attachments?: FileAttachment[];
      selectedComponent?: ComponentSelection | null;
    }) => {
      if (
        (!prompt.trim() && (!attachments || attachments.length === 0)) ||
        !chatId
      ) {
        return;
      }

      let ragContent = "";
      const otherAttachments: FileAttachment[] = [];
      if (attachments) {
        // Separate rag documents from other attachments
        const ragAttachments = attachments.filter(
          (a) => a.type === "rag-document",
        );
        for (const a of attachments) {
          if (a.type !== "rag-document") otherAttachments.push(a);
        }
        if (ragAttachments.length > 0) {
          // Read all RAG documents concurrently with per-file error handling and optional truncation
          const MAX_RAG_BYTES = 200_000; // ~= 200 KB, adjust as needed
          const texts = await Promise.all(
            ragAttachments.map(async (attachment) => {
              try {
                const text = await attachment.file.text();
                // If file has a size and is very large, truncate to avoid sending huge payloads
                if (typeof (attachment.file as any).size === "number" && (attachment.file as any).size > MAX_RAG_BYTES) {
                  console.warn(`[CHAT] Truncating large rag-document: ${attachment.file.name}`);
                  return `\n\n--- Document: ${attachment.file.name} ---\n${text.slice(0, MAX_RAG_BYTES)}\n--- End Document (truncated) ---\n\n`;
                }
                return `\n\n--- Document: ${attachment.file.name} ---\n${text}\n--- End Document ---\n\n`;
              } catch (err) {
                console.error(`[CHAT] Failed to read attachment ${attachment.file.name}:`, err);
                // Return empty string on error so one bad file doesn't abort the whole stream
                return "";
              }
            }),
          );
          ragContent = texts.join("");
        }
      }

      setRecentStreamChatIds((prev) => {
        const next = new Set(prev);
        next.add(chatId);
        return next;
      });

      setErrorById((prev) => {
        const next = new Map(prev);
        next.set(chatId, null);
        return next;
      });
      setIsStreamingById((prev) => {
        const next = new Map(prev);
        next.set(chatId, true);
        return next;
      });

      let hasIncrementedStreamCount = false;
      try {
        IpcClient.getInstance().streamMessage(ragContent + prompt, {
          selectedComponent: selectedComponent ?? null,
          chatId,
          redo,
          attachments: otherAttachments,
          onUpdate: (updatedMessages: Message[]) => {
            if (!hasIncrementedStreamCount) {
              setStreamCountById((prev) => {
                const next = new Map(prev);
                next.set(chatId, (prev.get(chatId) ?? 0) + 1);
                return next;
              });
              hasIncrementedStreamCount = true;
            }

            setMessagesById((prev) => {
              const next = new Map(prev);
              next.set(chatId, updatedMessages);
              return next;
            });
          },
          onEnd: (response: ChatResponseEnd) => {
            if (response.updatedFiles) {
              setIsPreviewOpen(true);
              refreshAppIframe();
              if (settings?.enableAutoFixProblems) {
                checkProblems();
              }
            }
            if (response.extraFiles) {
              showExtraFilesToast({
                files: response.extraFiles,
                error: response.extraFilesError,
                posthog,
              });
            }
            refreshProposal(chatId);

            refetchUserBudget();

            // Keep the same as below
            setIsStreamingById((prev) => {
              const next = new Map(prev);
              next.set(chatId, false);
              return next;
            });
            refreshChats();
            refreshApp();
            refreshVersions();
            countTokens(chatId, "");
          },
          onError: (errorMessage: string) => {
            console.error(`[CHAT] Stream error for ${chatId}:`, errorMessage);
            setErrorById((prev) => {
              const next = new Map(prev);
              next.set(chatId, errorMessage);
              return next;
            });

            // Keep the same as above
            setIsStreamingById((prev) => {
              const next = new Map(prev);
              next.set(chatId, false);
              return next;
            });
            refreshChats();
            refreshApp();
            refreshVersions();
            countTokens(chatId, "");
          },
        });
      } catch (error) {
        console.error("[CHAT] Exception during streaming setup:", error);
        setIsStreamingById((prev) => {
          const next = new Map(prev);
          if (chatId) next.set(chatId, false);
          return next;
        });
        setErrorById((prev) => {
          const next = new Map(prev);
          if (chatId)
            next.set(
              chatId,
              error instanceof Error ? error.message : String(error),
            );
          return next;
        });
      }
    },
    [
      setMessagesById,
      setIsStreamingById,
      setIsPreviewOpen,
      checkProblems,
      selectedAppId,
      refetchUserBudget,
      settings,
    ],
  );

  return {
    streamMessage,
    isStreaming:
      hasChatId && chatId !== undefined
        ? (isStreamingById.get(chatId) ?? false)
        : false,
    error:
      hasChatId && chatId !== undefined
        ? (errorById.get(chatId) ?? null)
        : null,
    setError: (value: string | null) =>
      setErrorById((prev) => {
        const next = new Map(prev);
        if (chatId !== undefined) next.set(chatId, value);
        return next;
      }),
    setIsStreaming: (value: boolean) =>
      setIsStreamingById((prev) => {
        const next = new Map(prev);
        if (chatId !== undefined) next.set(chatId, value);
        return next;
      }),
  };
}
