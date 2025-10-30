import { fetchOllamaModels } from "@/ipc/handlers/local_model_ollama_handler";
import { describe, it, expect, vi } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("fetchOllamaModels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });
  it("should fetch and process models correctly", async () => {
    const mockResponse = {
      models: [
        {
          name: "test-model:latest",
          modified_at: "2024-05-01T10:00:00.000Z",
          size: 4700000000,
          digest: "abcdef123456",
          details: {
            format: "gguf",
            family: "llama",
            families: ["llama"],
            parameter_size: "8B",
            quantization_level: "Q4_0",
          },
        },
    (mockFetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await fetchOllamaModels();

    expect(result.models).toEqual([
      {
        modelName: "test-model:latest",
    expect(mockFetch).toHaveBeenCalledWith("");
        provider: "ollama",
      },
  it("should throw an error if the fetch fails", async () => {
    (mockFetch as any).mockResolvedValue({
      ok: false,
      statusText: "Not Found",
    });

    await expect(fetchOllamaModels()).rejects.toThrow("Failed to fetch models from Ollama");
  });
      statusText: "Not Found",
  it("should handle empty models array", async () => {
    const mockResponse = { models: [] };
    (mockFetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await fetchOllamaModels();
    expect(result.models).toEqual([]);
  });

  it("should handle missing models property", async () => {
    const mockResponse = {};
    (mockFetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await fetchOllamaModels();
    expect(result.models).toEqual([]);
  });

  it("should respect OLLAMA_HOST environment variable", async () => {
    const originalEnv = process.env.OLLAMA_HOST;
    process.env.OLLAMA_HOST = "";
    
    const mockResponse = { models: [] };
    (mockFetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    await fetchOllamaModels();
    expect(mockFetch).toHaveBeenCalledWith("");
    
    process.env.OLLAMA_HOST = originalEnv;
  });

    await expect(fetchOllamaModels()).rejects.toThrow(
      "Could not connect to Ollama. Make sure it's running at http://localhost:11434",
    );
  });
});
