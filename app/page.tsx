"use client";

import { useState } from "react";

type TreeNode = {
  name: string;
  path: string;
  isPage: boolean;
  pageCount: number;
  children: TreeNode[];
};

function buildHierarchy(urls: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  urls.forEach((url) => {
    const parsedUrl = new URL(url);

    const segments = parsedUrl.pathname
      .split("/")
      .filter(Boolean);

    let currentLevel = root;
    let currentPath = "";

    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;

      let node = currentLevel.find(
        (item) => item.name === segment
      );

      if (!node) {
        node = {
          name: segment,
          path: currentPath,
          isPage: false,
          pageCount: 0,
          children: [],
        };

        currentLevel.push(node);
      }

      node.pageCount += 1;

      if (index === segments.length - 1) {
        node.isPage = true;
      }

      currentLevel = node.children;
    });
  });

  return root;
}

function Tree({
  nodes,
  level = 0,
}: {
  nodes: TreeNode[];
  level?: number;
}) {
  return (
    <div>
      {nodes.map((node) => (
        <div key={node.path}>
          <div
            className="flex items-center gap-2 py-2"
            style={{ paddingLeft: `${level * 24}px` }}
          >
            <span>
              {node.children.length > 0 ? "📁" : "📄"}
            </span>

            <span className="font-medium">
              {node.name}
            </span>

            <span className="text-sm text-gray-500">
              {node.pageCount}{" "}
              {node.pageCount === 1 ? "page" : "pages"}
            </span>

            {node.isPage && (
              <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">
                Page
              </span>
            )}
          </div>

          {node.children.length > 0 && (
            <Tree
              nodes={node.children}
              level={level + 1}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [fileName, setFileName] = useState("");
  const [urls, setUrls] = useState<string[]>([]);
  const [hierarchy, setHierarchy] = useState<TreeNode[]>([]);

  function handleFileUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result;

      if (typeof content !== "string") return;

      const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      const dataRows = lines.slice(1);

      const parsedUrls = dataRows
        .map((line) =>
          line.replace(/^"|"$/g, "").trim()
        )
        .filter((url) => {
          try {
            new URL(url);
            return true;
          } catch {
            return false;
          }
        });

      setUrls(parsedUrls);
      setHierarchy(buildHierarchy(parsedUrls));
    };

    reader.readAsText(file);
  }

  return (
    <main className="min-h-screen bg-gray-50 p-10">
      <h1 className="text-4xl font-bold">
        Website Intelligence
      </h1>

      <p className="mt-4 text-lg text-gray-600">
        Analyse website structure, traffic, SEO and content
        quality.
      </p>

      <label className="mt-8 inline-block cursor-pointer rounded bg-black px-6 py-3 text-white">
        Upload URL CSV

        <input
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileUpload}
        />
      </label>

      {fileName && (
        <div className="mt-8">
          <p className="font-semibold">
            Uploaded:
          </p>

          <p className="mt-1 text-gray-600">
            {fileName}
          </p>

          <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
            <p className="text-2xl font-bold">
              {urls.length}
            </p>

            <p className="text-sm text-gray-500">
              Total URLs
            </p>
          </div>

          <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">
              Website hierarchy
            </h2>

            <div className="mt-6">
              <Tree nodes={hierarchy} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}