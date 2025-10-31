import { vi, describe, it, expect, afterEach } from "vitest";
import {
  fetchOllamaModels,
  getOllamaApiUrl,
} from "../ipc/handlers/local_model_ollama_handler";

// Mock the entire settings store
vi.mock("../ipc/handlers/local_model_ollama_handler", async () => {
  const actual = await vi.importActual(
    "../ipc/handlers/local_model_ollama_handler",
  );
  return {
    ...actual,
    getOllamaApiUrl: vi.fn(),
  };
});

global.fetch = vi.fn();

describe("fetchOllamaModels", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch models successfully", async () => {
    const mockModels = {
      models: [
        { name: "model1", details: {} },
        { name: "model2", details: {} },
      ],
    };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockModels),
    });
    (getOllamaApiUrl as any).mockReturnValueOnce("http://localhost:11434");

    const result = await fetchOllamaModels();

    expect(result.models).toEqual([
      {
        modelName: "model1",
        displayName: "Model 1",
        provider: "ollama",
      },
      {
        modelName: "model2",
        displayName: "Model 2",
        provider: "ollama",
      },
    ]);
    expect(global.fetch).toHaveBeenCalledWith("http://localhost:11434/api/tags");
  });

  it("should handle fetch errors", async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));
    (getOllamaApiUrl as any).mockReturnValueOnce("http://localhost:11434");

    await expect(fetchOllamaModels()).rejects.toThrow(
      "Failed to fetch models from Ollama",
    );
  });
});
