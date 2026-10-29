// fakeFileSystem.ts — In-memory mock implementation of File System Access API
// (FileSystemDirectoryHandle, FileSystemFileHandle, FileSystemWritableFileStream).
// Enables full automated testing of folder walk, backup creation, stale file refusal,
// file writes, and byte-for-byte reverts.

export class FakeWritableStream {
  private fileHandle: FakeFileSystemFileHandle;
  private buffer: string = "";

  constructor(fileHandle: FakeFileSystemFileHandle) {
    this.fileHandle = fileHandle;
  }

  async write(data: string | Blob | ArrayBuffer): Promise<void> {
    if (typeof data === "string") {
      this.buffer += data;
    } else if (data instanceof Blob) {
      this.buffer += await data.text();
    } else {
      const decoder = new TextDecoder();
      this.buffer += decoder.decode(data);
    }
  }

  async close(): Promise<void> {
    this.fileHandle._setContent(this.buffer);
  }
}

export class FakeFileSystemFileHandle {
  readonly kind = "file" as const;
  readonly name: string;
  private content: string;
  private lastModified: number;

  constructor(name: string, initialContent: string = "") {
    this.name = name;
    this.content = initialContent;
    this.lastModified = Date.now();
  }

  _setContent(newContent: string) {
    this.content = newContent;
    this.lastModified = Date.now();
  }

  _getContent(): string {
    return this.content;
  }

  async getFile(): Promise<File> {
    const blob = new Blob([this.content], { type: "text/plain;charset=utf-8" });
    const file = new File([blob], this.name, {
      type: "text/plain;charset=utf-8",
      lastModified: this.lastModified,
    });
    return file;
  }

  async createWritable(): Promise<FakeWritableStream> {
    return new FakeWritableStream(this);
  }
}

export class FakeFileSystemDirectoryHandle {
  readonly kind = "directory" as const;
  readonly name: string;
  private entries: Map<string, FakeFileSystemDirectoryHandle | FakeFileSystemFileHandle> = new Map();

  constructor(name: string = "root") {
    this.name = name;
  }

  async *values(): AsyncIterable<FakeFileSystemDirectoryHandle | FakeFileSystemFileHandle> {
    for (const handle of this.entries.values()) {
      yield handle;
    }
  }

  async getFileHandle(name: string, options: { create?: boolean } = {}): Promise<FakeFileSystemFileHandle> {
    const existing = this.entries.get(name);
    if (existing) {
      if (existing.kind !== "file") {
        throw new Error(`TypeMismatchError: '${name}' is a directory, not a file.`);
      }
      return existing as FakeFileSystemFileHandle;
    }
    if (options.create) {
      const newFile = new FakeFileSystemFileHandle(name, "");
      this.entries.set(name, newFile);
      return newFile;
    }
    throw new Error(`NotFoundError: File '${name}' not found.`);
  }

  async getDirectoryHandle(name: string, options: { create?: boolean } = {}): Promise<FakeFileSystemDirectoryHandle> {
    const existing = this.entries.get(name);
    if (existing) {
      if (existing.kind !== "directory") {
        throw new Error(`TypeMismatchError: '${name}' is a file, not a directory.`);
      }
      return existing as FakeFileSystemDirectoryHandle;
    }
    if (options.create) {
      const newDir = new FakeFileSystemDirectoryHandle(name);
      this.entries.set(name, newDir);
      return newDir;
    }
    throw new Error(`NotFoundError: Directory '${name}' not found.`);
  }

  /**
   * Helper to populate an in-memory directory hierarchy from a Map or Object of relative paths -> contents.
   */
  static fromFileMap(fileMap: Map<string, string> | Record<string, string>, rootName: string = "my-project"): FakeFileSystemDirectoryHandle {
    const root = new FakeFileSystemDirectoryHandle(rootName);
    const entries = fileMap instanceof Map ? Array.from(fileMap.entries()) : Object.entries(fileMap);

    for (const [relPath, content] of entries) {
      const segments = relPath.replace(/^\/+/, "").split("/");
      let currentDir = root;

      for (let i = 0; i < segments.length - 1; i++) {
        const dirName = segments[i]!;
        if (!currentDir.entries.has(dirName)) {
          const subDir = new FakeFileSystemDirectoryHandle(dirName);
          currentDir.entries.set(dirName, subDir);
        }
        currentDir = currentDir.entries.get(dirName) as FakeFileSystemDirectoryHandle;
      }

      const fileName = segments[segments.length - 1]!;
      currentDir.entries.set(fileName, new FakeFileSystemFileHandle(fileName, content));
    }

    return root;
  }
}
