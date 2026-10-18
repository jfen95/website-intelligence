
"use client";

import { useState } from "react";

type PageData = {
  url: string;
  sessions: number | null;
};

type TreeNode = {
  name: string;
  path: string;
  isPage: boolean;
  pageCount: number;
  sessions: number;
  children: TreeNode[];
};

type FolderSummary = {
  path: string;
  pages: number;
  sessions: number;
};

type Section =
  | "Overview"
  | "Site structure"
  | "Content scoring"
  | "Technical SEO"
  | "Data sources";

const sections: {
  name: Section;
  icon: string;
}[] = [
  { name: "Overview", icon: "▦" },
  { name: "Site structure", icon: "⌘" },
  { name: "Content scoring", icon: "▤" },
  { name: "Technical SEO", icon: "◈" },
  { name: "Data sources", icon: "⇧" },
];

function buildHierarchy(pageData: PageData[]): TreeNode[] {
  const root: TreeNode[] = [];

  pageData.forEach(({ url, sessions }) => {
    const parsedUrl = new URL(url);
    const segments = parsedUrl.pathname.split("/").filter(Boolean);

    let currentLevel = root;
    let currentPath = "";

    segments.forEach((segment, index) => {
      currentPath += "/" + segment;

      let node = currentLevel.find((item) => item.name === segment);

      if (!node) {
        node = {
          name: segment,
          path: currentPath,
          isPage: false,
          pageCount: 0,
          sessions: 0,
          children: [],
        };

        currentLevel.push(node);
      }

      node.pageCount += 1;
      node.sessions += sessions ?? 0;

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
            className="flex flex-wrap items-center gap-3 border-b border-gray-100 py-3"
            style={{ paddingLeft: level * 24 + "px" }}
          >
            <span className="text-gray-400">
              {node.children.length > 0 ? "📁" : "📄"}
            </span>

            <span className="font-medium text-gray-800">{node.name}</span>

            <span className="text-sm text-gray-400">
              {node.pageCount} {node.pageCount === 1 ? "page" : "pages"}
            </span>

            {node.isPage && (
              <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                Page
              </span>
            )}

            <span className="ml-auto text-sm text-gray-500">
              {node.sessions.toLocaleString()} sessions
            </span>
          </div>

          {node.children.length > 0 && (
            <Tree nodes={node.children} level={level + 1} />
          )}
        </div>
      ))}
    </div>
  );
}

function formatNumber(number: number) {
  return number.toLocaleString();
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
        {value}
      </p>
      <p className="mt-2 text-sm text-gray-400">{description}</p>
    </div>
  );
}

export default function Home() {
  const [activeSection, setActiveSection] = useState<Section>("Overview");
  const [fileName, setFileName] = useState("");
  const [pageData, setPageData] = useState<PageData[]>([]);
  const [hierarchy, setHierarchy] = useState<TreeNode[]>([]);
  const [uploadError, setUploadError] = useState("");

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setFileName(file.name);
    setUploadError("");

    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result;

      if (typeof content !== "string") {
        setUploadError("Unable to read this file.");
        return;
      }

      const lines = content.split(/\r?\n/).filter((line) => line.trim());

      if (lines.length < 2) {
        setUploadError("The CSV does not contain any data rows.");
        return;
      }

      const parseCsvLine = (line: string): string[] => {
        const columns: string[] = [];
        let value = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];

          if (char === '"' && inQuotes && line[i + 1] === '"') {
            value += '"';
            i++;
          } else if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            columns.push(value.trim());
            value = "";
          } else {
            value += char;
          }
        }

        columns.push(value.trim());
        return columns;
      };

      const dataRows = lines.slice(1);
      const parsedData: PageData[] = [];

      dataRows.forEach((line) => {
        const columns = parseCsvLine(line);
        const url = columns[0];

        try {
          const parsedUrl = new URL(url);

          if (!["http:", "https:"].includes(parsedUrl.protocol)) return;

          const rawSessions = columns[1]?.replace(/,/g, "");
          const parsedSessions =
            rawSessions !== undefined && rawSessions !== ""
              ? Number(rawSessions)
              : null;

          parsedData.push({
            url,
            sessions:
              parsedSessions !== null && Number.isFinite(parsedSessions)
                ? parsedSessions
                : null,
          });
        } catch {
          // Ignore rows without a valid URL.
        }
      });

      if (parsedData.length === 0) {
        setUploadError(
          "No valid URLs found. Check that the first CSV column contains full URLs."
        );
        return;
      }

      setPageData(parsedData);
      setHierarchy(buildHierarchy(parsedData));
    };

    reader.onerror = () => setUploadError("An error occurred while reading the CSV.");
    reader.readAsText(file);
  }

  const totalUrls = pageData.length;

  const totalSessions = pageData.reduce(
    (total, page) => total + (page.sessions ?? 0),
    0
  );

  const pagesWithTraffic = pageData.filter(
    (page) => page.sessions !== null && page.sessions > 0
  ).length;

  const trafficCoverage =
    totalUrls > 0 ? Math.round((pagesWithTraffic / totalUrls) * 100) : 0;

  const folderSummaries: FolderSummary[] = [];

  function collectFolderSummaries(nodes: TreeNode[]) {
    nodes.forEach((node) => {
      if (node.pageCount > 0) {
        folderSummaries.push({
          path: node.path,
          pages: node.pageCount,
          sessions: node.sessions,
        });
      }

      collectFolderSummaries(node.children);
    });
  }

  collectFolderSummaries(hierarchy);

  const topFolders = [...folderSummaries]
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 5);

  const attentionFolders = [...folderSummaries]
    .filter((folder) => folder.pages >= 10)
    .sort(
      (a, b) =>
        a.sessions / a.pages - b.sessions / b.pages
    )
    .slice(0, 5);

  function renderOverview() {
    return (
      <>
        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
            Website overview
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Your website performance and structure at a glance.
          </p>
        </div>

        {!fileName ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-2xl text-blue-700">
              ↑
            </div>
            <h3 className="mt-5 text-lg font-semibold text-gray-900">
              Upload your website data
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
              Upload a CSV containing URLs in the first column and sessions in
              the second column to populate your website overview.
            </p>
            <label className="mt-6 inline-flex cursor-pointer items-center rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-700">
              Choose CSV file
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Current data source
                </p>
                <p className="mt-1 text-sm font-medium text-gray-800">
                  {fileName}
                </p>
              </div>
              <label className="cursor-pointer rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Replace CSV
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                label="Total URLs"
                value={formatNumber(totalUrls)}
                description="Valid URLs in your uploaded file"
              />
              <MetricCard
                label="Total sessions"
                value={formatNumber(totalSessions)}
                description="Combined sessions across supplied URLs"
              />
              <MetricCard
                label="Traffic coverage"
                value={`${trafficCoverage}%`}
                description={`${formatNumber(pagesWithTraffic)} pages with more than zero sessions`}
              />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <section className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="font-semibold text-gray-900">
                  Top folders by sessions
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Folders ranked by combined sessions.
                </p>

                <div className="mt-5 divide-y divide-gray-100">
                  {topFolders.map((folder) => (
                    <div
                      key={folder.path}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <span className="break-all text-sm font-medium text-gray-800">
                        {folder.path}
                      </span>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatNumber(folder.sessions)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatNumber(folder.pages)} pages
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="font-semibold text-gray-900">
                  Attention
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Large folders ranked by lowest sessions per URL.
                </p>

                <div className="mt-5 divide-y divide-gray-100">
                  {attentionFolders.map((folder) => (
                    <div
                      key={folder.path}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <span className="break-all text-sm font-medium text-gray-800">
                        {folder.path}
                      </span>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatNumber(folder.sessions)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatNumber(folder.pages)} pages
                        </p>
                      </div>
                    </div>
                  ))}
                  {attentionFolders.length === 0 && (
                    <p className="py-4 text-sm text-gray-500">
                      No folders currently meet the 10-page threshold.
                    </p>
                  )}
                </div>
              </section>
            </div>

            <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="font-semibold text-gray-900">Website hierarchy</h3>
              <p className="mt-1 text-sm text-gray-500">
                Explore your URLs grouped by path.
              </p>
              <div className="mt-4">
                <Tree nodes={hierarchy} />
              </div>
            </section>
          </>
        )}
      </>
    );
  }

  function renderPlaceholder() {
    const details: Record<
      Exclude<Section, "Overview">,
      { description: string; steps: string[] }
    > = {
      "Site structure": {
        description:
          "Explore URL patterns, folder depth and how your website content is organised.",
        steps: [
          "Interactive URL hierarchy",
          "Folder-level page and traffic analysis",
          "URL search and filtering",
        ],
      },
      "Content scoring": {
        description:
          "Identify content quality and optimisation opportunities across your website.",
        steps: [
          "Define content quality criteria",
          "Score pages against agreed rules",
          "Prioritise pages for improvement",
        ],
      },
      "Technical SEO": {
        description:
          "Bring technical crawl data together to highlight potential SEO issues.",
        steps: [
          "Import crawl and indexability data",
          "Identify technical issues",
          "Prioritise fixes by impact",
        ],
      },
      "Data sources": {
        description:
          "Manage the files and datasets that power your website analysis.",
        steps: [
          "Upload URL and analytics exports",
          "Review imported data",
          "Prepare for future data integrations",
        ],
      },
    };

    const section = details[activeSection as Exclude<Section, "Overview">];

    return (
      <div className="max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
          {activeSection}
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          {section.description}
        </p>

        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
          <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            In development
          </span>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">
            What we&apos;ll build here
          </h3>
          <ul className="mt-4 space-y-3">
            {section.steps.map((step) => (
              <li key={step} className="flex items-start gap-3 text-sm text-gray-600">
                <span className="mt-0.5 text-blue-600">✓</span>
                {step}
              </li>
            ))}
          </ul>
        </div>

        {pageData.length > 0 && (
          <div className="mt-5 rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-900">
              Current dataset available
            </p>
            <p className="mt-2 text-sm text-gray-500">
              {formatNumber(pageData.length)} URLs are loaded from {fileName}.
              We can use this dataset when implementing this section.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 md:flex">
      <aside className="flex w-full shrink-0 flex-col bg-gray-950 text-gray-300 md:min-h-screen md:w-64">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 text-xl font-bold text-white">
            W
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-white">
              Website Intelligence
            </h1>
            <p className="mt-1 text-xs text-gray-400">SEO workspace</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5">
          <p className="mb-3 px-3 text-xs font-semibold tracking-widest text-gray-500">
            WORKSPACE
          </p>

          <div className="flex gap-1 overflow-x-auto md:flex-col">
            {sections.map((section) => {
              const isActive = activeSection === section.name;

              return (
                <button
                  key={section.name}
                  type="button"
                  onClick={() => setActiveSection(section.name)}
                  className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition ${
                    isActive
                      ? "bg-blue-500/15 font-medium text-blue-300"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="w-5 text-center text-base">
                    {section.icon}
                  </span>
                  {section.name}
                  {isActive && (
                    <span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-blue-400 md:block" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="hidden border-t border-white/10 px-5 py-4 md:block">
          <p className="text-xs text-gray-500">Website Intelligence</p>
          <p className="mt-1 text-xs text-gray-600">Local development</p>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-5 md:px-10">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Workspace / {activeSection}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-gray-900">
              {activeSection}
            </h2>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700">
            <span>↑</span> Upload CSV
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </header>

        <div className="p-5 md:p-10">
          {uploadError && (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {uploadError}
            </div>
          )}

          {activeSection === "Overview"
            ? renderOverview()
            : renderPlaceholder()}
        </div>
      </main>
    </div>
  );
}
