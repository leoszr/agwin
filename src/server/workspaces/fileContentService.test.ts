import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MAX_WORKSPACE_FILE_CONTENT_BYTES } from "../../shared/workspaceFiles.js";
import { deleteWorkspaceFile, moveWorkspaceFile, readWorkspaceFile, writeWorkspaceFile } from "./fileContentService.js";
import { cleanupTempWorkspaces, createTempWorkspace } from "./fileContentService.testSupport.js";

afterEach(async () => {
  await cleanupTempWorkspaces();
});

describe("deleteWorkspaceFile", () => {
  it("deletes an existing file and returns existed: true", async () => {
    const root = await createTempWorkspace();
    await writeFile(join(root, "notes.txt"), "hello");

    const result = await deleteWorkspaceFile(root, "notes.txt");

    expect(result).toMatchObject({ path: "notes.txt", existed: true });
    await expect(readWorkspaceFile(root, "notes.txt")).rejects.toThrow("Path does not exist");
  });

  it("returns existed: false when deleting a non-existent file", async () => {
    const root = await createTempWorkspace();

    const result = await deleteWorkspaceFile(root, "missing.txt");

    expect(result).toMatchObject({ path: "missing.txt", existed: false });
  });

  it("rejects deleting a directory", async () => {
    const root = await createTempWorkspace();
    await mkdir(join(root, "mydir"), { recursive: true });

    await expect(deleteWorkspaceFile(root, "mydir")).rejects.toThrow("Path is a directory");
  });

  it("rejects traversal and absolute paths", async () => {
    const root = await createTempWorkspace();

    await expect(deleteWorkspaceFile(root, "../secret.txt")).rejects.toThrow("Path traversal is not allowed");
    await expect(deleteWorkspaceFile(root, "/etc/passwd")).rejects.toThrow("Absolute paths are not allowed");
  });

  it("rejects missing path", async () => {
    const root = await createTempWorkspace();

    await expect(deleteWorkspaceFile(root, undefined)).rejects.toThrow("path query parameter is required");
    await expect(deleteWorkspaceFile(root, "")).rejects.toThrow("path query parameter is required");
  });

  it("deletes a symlink itself, not its target", async () => {
    const root = await createTempWorkspace();
    const outsideDir = await createTempWorkspace("pi-web-outside-delete-");
    await writeFile(join(outsideDir, "real.txt"), "real content");
    // Create a symlink inside the workspace pointing outside
    await symlink(join(outsideDir, "real.txt"), join(root, "link.txt"));

    const result = await deleteWorkspaceFile(root, "link.txt");

    expect(result).toMatchObject({ path: "link.txt", existed: true });
    // The symlink should be gone, but the target file should still exist
    await expect(readWorkspaceFile(root, "link.txt")).rejects.toThrow("Path does not exist");
    const realContent = await readFile(join(outsideDir, "real.txt"), "utf8");
    expect(realContent).toBe("real content");
  });

  it("prevents deleting through a symlinked parent directory that escapes the workspace", async () => {
    const root = await createTempWorkspace();
    await mkdir(join(root, "subdir"), { recursive: true });
    // A real file living outside the workspace that must not be deletable.
    const outsideDir = await createTempWorkspace("pi-web-outside-delete-parent-");
    await writeFile(join(outsideDir, "victim.txt"), "important");
    // A symlinked parent directory inside the workspace pointing outside.
    await symlink(outsideDir, join(root, "subdir", "escape"), "junction");

    await expect(deleteWorkspaceFile(root, "subdir/escape/victim.txt")).rejects.toThrow("Path escapes workspace");
    // The outside file must survive.
    const realContent = await readFile(join(outsideDir, "victim.txt"), "utf8");
    expect(realContent).toBe("important");
  });
});
describe("moveWorkspaceFile", () => {
  it("moves a file to a new path", async () => {
    const root = await createTempWorkspace();
    await writeFile(join(root, "original.txt"), "content");

    const result = await moveWorkspaceFile(root, "original.txt", "moved.txt");

    expect(result).toMatchObject({ fromPath: "original.txt", toPath: "moved.txt" });
    expect(result.size).toBe(7);
    expect(Date.parse(result.modifiedAt)).not.toBeNaN();
    // Source should no longer exist
    await expect(readWorkspaceFile(root, "original.txt")).rejects.toThrow("Path does not exist");
    // Target should exist
    const target = await readWorkspaceFile(root, "moved.txt");
    expect(target.content).toBe("content");
  });

  it("creates intermediate directories by default", async () => {
    const root = await createTempWorkspace();
    await writeFile(join(root, "file.txt"), "data");

    await moveWorkspaceFile(root, "file.txt", "deep/nested/dir/file.txt");

    const target = await readWorkspaceFile(root, "deep/nested/dir/file.txt");
    expect(target.content).toBe("data");
  });

  it("fails when createDirs is false and parent directory does not exist", async () => {
    const root = await createTempWorkspace();
    await writeFile(join(root, "file.txt"), "data");

    await expect(moveWorkspaceFile(root, "file.txt", "missing/dir/file.txt", { createDirs: false })).rejects.toThrow();
    const source = await readWorkspaceFile(root, "file.txt");
    expect(source.content).toBe("data");
  });

  it("overwrites target when overwrite is true", async () => {
    const root = await createTempWorkspace();
    await writeFile(join(root, "source.txt"), "source content");
    await writeFile(join(root, "target.txt"), "target content");

    const result = await moveWorkspaceFile(root, "source.txt", "target.txt", { overwrite: true });

    expect(result.toPath).toBe("target.txt");
    const target = await readWorkspaceFile(root, "target.txt");
    expect(target.content).toBe("source content");
  });

  it("throws when target exists and overwrite is false (default)", async () => {
    const root = await createTempWorkspace();
    await writeFile(join(root, "source.txt"), "source");
    await writeFile(join(root, "target.txt"), "target");

    await expect(moveWorkspaceFile(root, "source.txt", "target.txt")).rejects.toThrow("File already exists");
    // Source and target should remain unchanged
    const source = await readWorkspaceFile(root, "source.txt");
    expect(source.content).toBe("source");
    const target = await readWorkspaceFile(root, "target.txt");
    expect(target.content).toBe("target");
  });

  it("rejects source path traversal", async () => {
    const root = await createTempWorkspace();

    await expect(moveWorkspaceFile(root, "../secret.txt", "target.txt")).rejects.toThrow("Path traversal is not allowed");
  });

  it("rejects target path traversal", async () => {
    const root = await createTempWorkspace();
    await writeFile(join(root, "source.txt"), "data");

    await expect(moveWorkspaceFile(root, "source.txt", "../secret.txt")).rejects.toThrow("Path traversal is not allowed");
    const source = await readWorkspaceFile(root, "source.txt");
    expect(source.content).toBe("data");
  });

  it("rejects moving a directory", async () => {
    const root = await createTempWorkspace();
    await mkdir(join(root, "mydir"), { recursive: true });

    await expect(moveWorkspaceFile(root, "mydir", "newdir")).rejects.toThrow("Source path is not a file");
  });

  it("rejects missing fromPath or toPath", async () => {
    const root = await createTempWorkspace();

    await expect(moveWorkspaceFile(root, undefined, "target.txt")).rejects.toThrow("fromPath query parameter is required");
    await expect(moveWorkspaceFile(root, "source.txt", undefined)).rejects.toThrow("toPath query parameter is required");
    await expect(moveWorkspaceFile(root, "", "target.txt")).rejects.toThrow("fromPath query parameter is required");
    await expect(moveWorkspaceFile(root, "source.txt", "")).rejects.toThrow("toPath query parameter is required");
  });

  it("prevents moving through symlinks that escape the workspace", async () => {
    const root = await createTempWorkspace();
    await mkdir(join(root, "subdir"), { recursive: true });
    await writeFile(join(root, "subdir", "file.txt"), "data");
    // Create a symlink inside the workspace that points outside
    const outsideDir = await createTempWorkspace("pi-web-move-outside-");
    await symlink(outsideDir, join(root, "subdir", "escape"), "junction");

    await expect(moveWorkspaceFile(root, "subdir/file.txt", "subdir/escape/evil.txt")).rejects.toThrow("Path escapes workspace");
    const source = await readWorkspaceFile(root, "subdir/file.txt");
    expect(source.content).toBe("data");
    await expect(readFile(join(outsideDir, "evil.txt"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("prevents moving a source symlink that escapes the workspace", async () => {
    const root = await createTempWorkspace();
    const outsideDir = await createTempWorkspace("pi-web-move-source-outside-");
    await writeFile(join(outsideDir, "secret.txt"), "secret");
    await symlink(join(outsideDir, "secret.txt"), join(root, "source-link.txt"));

    await expect(moveWorkspaceFile(root, "source-link.txt", "moved.txt")).rejects.toThrow("Path escapes workspace");
    await expect(readWorkspaceFile(root, "moved.txt")).rejects.toThrow("Path does not exist");
    await expect(readFile(join(outsideDir, "secret.txt"), "utf8")).resolves.toBe("secret");
  });
});
describe("readWorkspaceFile", () => {
  it("reads text files with normalized paths and language metadata", async () => {
    const root = await createTempWorkspace();
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "main.ts"), "const answer = 42;\n");

    const file = await readWorkspaceFile(root, "./src//main.ts");

    expect(file).toMatchObject({
      path: "src/main.ts",
      language: "typescript",
      encoding: "utf8",
      content: "const answer = 42;\n",
      truncated: false,
      binary: false,
    });
    expect(file.size).toBe(19);
    expect(Date.parse(file.modifiedAt)).not.toBeNaN();
  });

  it("rejects missing paths, directories, traversal, and absolute paths", async () => {
    const root = await createTempWorkspace();
    await mkdir(join(root, "dir"));

    await expect(readWorkspaceFile(root, undefined)).rejects.toThrow("path query parameter is required");
    await expect(readWorkspaceFile(root, "dir")).rejects.toThrow("Path is not a file");
    await expect(readWorkspaceFile(root, "missing.txt")).rejects.toThrow("Path does not exist");
    await expect(readWorkspaceFile(root, "../secret.txt")).rejects.toThrow("Path traversal is not allowed");
    await expect(readWorkspaceFile(root, "/etc/passwd")).rejects.toThrow("Absolute paths are not allowed");
  });

  it("reads allowed absolute files outside the workspace", async () => {
    const root = await createTempWorkspace();
    const external = await createTempWorkspace();
    await writeFile(join(external, "README.md"), "external docs\n");

    const file = await readWorkspaceFile(root, join(external, "README.md"), { allowedPaths: [external] });

    expect(file).toMatchObject({
      path: join(external, "README.md"),
      language: "markdown",
      content: "external docs\n",
      truncated: false,
      binary: false,
    });
    await expect(readWorkspaceFile(root, join(external, "README.md"))).rejects.toThrow("Absolute paths are not allowed");
  });

  it("detects binary files and omits binary content", async () => {
    const root = await createTempWorkspace();
    await writeFile(join(root, "image.bin"), Buffer.from([0x66, 0x6f, 0x00, 0x6f]));

    const file = await readWorkspaceFile(root, "image.bin");

    expect(file).toMatchObject({ content: "", binary: true, truncated: false });
    expect(file.size).toBe(4);
  });

  it("marks supported images as previewable", async () => {
    const root = await createTempWorkspace();
    await writeFile(join(root, "logo.PNG"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]));

    const file = await readWorkspaceFile(root, "logo.PNG");

    expect(file).toMatchObject({ mediaType: "image", mimeType: "image/png", content: "", binary: true, truncated: false });
    expect(file.size).toBe(9);
  });

  it("preserves literal HTML, Markdown, and SVG source while keeping PDF bytes out of JSON", async () => {
    const root = await createTempWorkspace();
    const html = "<h1>hi</h1><script>window.top.location = '/stolen'</script>";
    const markdown = "# Notes\n\n<img src=x onerror=alert(1)>\n";
    const svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" onload=\"alert(1)\"></svg>";
    await writeFile(join(root, "report.html"), html);
    await writeFile(join(root, "README.MD"), markdown);
    await writeFile(join(root, "diagram.SVG"), svg);
    await writeFile(join(root, "spec.PDF"), Buffer.from("%PDF-1.4\n"));

    const htmlFile = await readWorkspaceFile(root, "report.html");
    const markdownFile = await readWorkspaceFile(root, "README.MD");
    const svgFile = await readWorkspaceFile(root, "diagram.SVG");
    const pdfFile = await readWorkspaceFile(root, "spec.PDF");

    expect(svgFile).toMatchObject({ mediaType: "image", mimeType: "image/svg+xml", content: svg, binary: false });
    expect(htmlFile).toMatchObject({ mediaType: "html", mimeType: "text/html; charset=utf-8", content: html, binary: false });
    expect(markdownFile).toMatchObject({ mediaType: "markdown", language: "markdown", content: markdown, binary: false });
    expect(markdownFile.mimeType).toBeUndefined();
    expect(pdfFile).toMatchObject({ mediaType: "pdf", mimeType: "application/pdf", content: "", binary: true });
  });

  it("leaves unsupported binaries without a media type so they fall back to download", async () => {
    const root = await createTempWorkspace();
    await writeFile(join(root, "archive.zip"), Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]));

    const file = await readWorkspaceFile(root, "archive.zip");

    expect(file.mediaType).toBeUndefined();
    expect(file).toMatchObject({ content: "", binary: true });
  });

  it.each(["large.md", "large.html"])("caps literal source for %s", async (path) => {
    const root = await createTempWorkspace();
    await writeFile(join(root, path), "a".repeat(MAX_WORKSPACE_FILE_CONTENT_BYTES + 7));

    const file = await readWorkspaceFile(root, path);

    expect(file.content).toHaveLength(MAX_WORKSPACE_FILE_CONTENT_BYTES);
    expect(file.truncated).toBe(true);
    expect(file.binary).toBe(false);
  });

});
describe("writeWorkspaceFile", () => {
  it("writes text content to a new file with normalized paths", async () => {
    const root = await createTempWorkspace();

    const result = await writeWorkspaceFile(root, "./src//hello.ts", Buffer.from("const greeting = 'hello';\n"));

    expect(result).toMatchObject({ path: "src/hello.ts", created: true });
    expect(result.size).toBe(26);
    expect(Date.parse(result.modifiedAt)).not.toBeNaN();

    // Verify the file was actually written
    const content = await readFile(join(root, "src", "hello.ts"), "utf8");
    expect(content).toBe("const greeting = 'hello';\n");
  });

  it("writes binary content without text re-encoding", async () => {
    const root = await createTempWorkspace();
    const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

    const result = await writeWorkspaceFile(root, "image.png", binaryData);

    expect(result).toMatchObject({ path: "image.png", created: true, size: 6 });
    await expect(readFile(join(root, "image.png"))).resolves.toEqual(binaryData);
  });

  it("overwrites existing files by default", async () => {
    const root = await createTempWorkspace();
    await writeFile(join(root, "notes.txt"), "old content");

    const result = await writeWorkspaceFile(root, "notes.txt", Buffer.from("new content"));

    expect(result).toMatchObject({ path: "notes.txt", created: false, size: 11 });
    const content = await readFile(join(root, "notes.txt"), "utf8");
    expect(content).toBe("new content");
  });

  it("throws when overwrite is false and file exists", async () => {
    const root = await createTempWorkspace();
    await writeFile(join(root, "existing.txt"), "data");

    await expect(writeWorkspaceFile(root, "existing.txt", Buffer.from("new"), { overwrite: false })).rejects.toThrow("File already exists");
  });

  it("creates intermediate directories by default", async () => {
    const root = await createTempWorkspace();

    await writeWorkspaceFile(root, "deep/nested/dir/file.txt", Buffer.from("deep content"));

    const content = await readFile(join(root, "deep", "nested", "dir", "file.txt"), "utf8");
    expect(content).toBe("deep content");
  });

  it("fails when createDirs is false and parent directory does not exist", async () => {
    const root = await createTempWorkspace();

    await expect(writeWorkspaceFile(root, "missing/dir/file.txt", Buffer.from("x"), { createDirs: false })).rejects.toThrow();
  });

  it("rejects missing paths, traversal, and absolute paths", async () => {
    const root = await createTempWorkspace();

    await expect(writeWorkspaceFile(root, undefined, Buffer.from("x"))).rejects.toThrow("path query parameter is required");
    await expect(writeWorkspaceFile(root, "../secret.txt", Buffer.from("x"))).rejects.toThrow("Path traversal is not allowed");
    await expect(writeWorkspaceFile(root, "/etc/passwd", Buffer.from("x"))).rejects.toThrow("Absolute paths are not allowed");
  });

  it("rejects writing to a directory path", async () => {
    const root = await createTempWorkspace();
    await mkdir(join(root, "mydir"), { recursive: true });

    await expect(writeWorkspaceFile(root, "mydir", Buffer.from("data"))).rejects.toThrow("Path is not a file");
  });

  it("prevents writing through symlinks that escape the workspace", async () => {
    const root = await createTempWorkspace();
    await mkdir(join(root, "subdir"), { recursive: true });
    const outsideDir = await createTempWorkspace("pi-web-outside-");
    await symlink(outsideDir, join(root, "subdir", "escape"), "junction");

    await expect(writeWorkspaceFile(root, "subdir/escape/evil.txt", Buffer.from("evil"))).rejects.toThrow("Path escapes workspace");
    await expect(readFile(join(outsideDir, "evil.txt"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
