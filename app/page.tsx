
"use client";

import { useState, type ChangeEvent } from "react";

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

const sections: { name: Section; icon: string }[] = [
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
  const [pageSearch, setPageSearch] = useState("");

  function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
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
      setPageSearch("");
    };

    reader.onerror = () =>
      setUploadError("An error occurred while reading the CSV.");

    reader.readAsText(file);

    // Allow the same file to be selected again.
    event.target.value = "";
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
    .sort((a, b) => a.sessions / a.pages - b.sessions / b.pages)
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
                <h3 className="font-semibold text-gray-900">Attention</h3>
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
              <h3 className="font-semibold text-gray-900">
                Website hierarchy
              </h3>
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

  function renderContentScoring() {
    const scores = [
      {
        name: "SEO",
        score: 78,
        description: "Search optimisation",
        color: "bg-blue-500",
      },
      {
        name: "AEO",
        score: 65,
        description: "Answer optimisation",
        color: "bg-violet-500",
      },
      {
        name: "GEO",
        score: 59,
        description: "Generative engine optimisation",
        color: "bg-amber-500",
      },
      {
        name: "Performance",
        score: 72,
        description: "Traffic and outcomes",
        color: "bg-emerald-500",
      },
    ];

    const distributions = [
      { name: "SEO", high: 620, medium: 280, low: 100 },
      { name: "AEO", high: 350, medium: 400, low: 250 },
      { name: "GEO", high: 240, medium: 410, low: 350 },
      { name: "Performance", high: 480, medium: 370, low: 150 },
    ];

    const opportunities = [
      {
        title: "Improve answer coverage",
        category: "AEO",
        pages: 126,
        description:
          "Answer relevant user questions more directly and comprehensively.",
      },
      {
        title: "Strengthen evidence and expertise",
        category: "GEO",
        pages: 94,
        description:
          "Add useful evidence, original insights and clear attribution.",
      },
      {
        title: "Investigate slow pages",
        category: "Performance",
        pages: 37,
        description:
          "Identify pages that may need speed improvements.",
      },
    ];

    const filteredPages = pageData.filter((page) =>
      page.url.toLowerCase().includes(pageSearch.toLowerCase())
    );

    return (
      <div className="space-y-8">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                Content scoring
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Assess content quality and identify your highest-priority
                opportunities.
              </p>
            </div>

            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
              Preview · Demo scores
            </span>
          </div>

          <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
            This preview uses illustrative scores and example recommendations,
            not results from your website. Imported URLs will appear in the
            inventory below, but actual scores require the analysis engine.
          </div>
        </div>

        <section>
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900">Score overview</h3>
            <p className="mt-1 text-sm text-gray-500">
              Illustrative average scores out of 100.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {scores.map((item) => (
              <div
                key={item.name}
                className="rounded-xl border border-gray-200 bg-white p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-500">
                    {item.name}
                  </p>
                  <span className="text-xs text-gray-400">/ 100</span>
                </div>

                <div className="mt-4 flex items-end gap-1">
                  <span className="text-3xl font-semibold tracking-tight text-gray-900">
                    {item.score}
                  </span>
                  <span className="mb-1 text-sm text-gray-400">/100</span>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full ${item.color}`}
                    style={{ width: `${item.score}%` }}
                  />
                </div>

                <p className="mt-3 text-xs text-gray-500">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
          <div>
            <h3 className="font-semibold text-gray-900">Score distribution</h3>
            <p className="mt-1 text-sm text-gray-500">
              Example breakdown of 1,000 pages per score category.
            </p>
          </div>

          <div className="mt-6 space-y-6">
            {distributions.map((item) => {
              const total = item.high + item.medium + item.low;

              return (
                <div key={item.name}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-gray-800">
                      {item.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatNumber(total)} example pages
                    </span>
                  </div>

                  <div
                    className="flex h-3 overflow-hidden rounded-full bg-gray-100"
                    aria-label={`${item.name} example score distribution`}
                  >
                    <div
                      className="bg-emerald-500"
                      style={{ width: `${(item.high / total) * 100}%` }}
                      title={`High: ${item.high}`}
                    />
                    <div
                      className="bg-amber-400"
                      style={{ width: `${(item.medium / total) * 100}%` }}
                      title={`Medium: ${item.medium}`}
                    />
                    <div
                      className="bg-rose-400"
                      style={{ width: `${(item.low / total) * 100}%` }}
                      title={`Low: ${item.low}`}
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-600">
                    <span>
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />
                      High (80–100): {formatNumber(item.high)}
                    </span>

                    <span>
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-400" />
                      Medium (60–79): {formatNumber(item.medium)}
                    </span>

                    <span>
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-rose-400" />
                      Low (0–59): {formatNumber(item.low)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-5 border-t border-gray-100 pt-4 text-xs leading-5 text-gray-400">
            Pages without sufficient data will be marked as unscored, not
            automatically classified as low-scoring. These sample counts are
            illustrative only.
          </p>
        </section>

        <section>
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900">
              Priority opportunities
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Example recommendations. Real priorities will be generated from
              page analysis.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {opportunities.map((item, index) => (
              <div
                key={item.title}
                className="flex flex-col gap-3 border-b border-gray-100 p-5 last:border-b-0 sm:flex-row sm:items-center"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-semibold text-gray-600">
                  {index + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {item.title}
                    </h4>
                    <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600">
                      {item.category}
                    </span>
                  </div>

                  <p className="mt-1 text-sm leading-5 text-gray-500">
                    {item.description}
                  </p>
                </div>

                <div className="shrink-0 sm:text-right">
                  <p className="text-lg font-semibold text-gray-900">
                    {item.pages}
                  </p>
                  <p className="text-xs text-gray-400">example pages</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900">Page inventory</h3>
            <p className="mt-1 text-sm text-gray-500">
              Search your imported URLs and prepare them for future scoring
              and auditing.
            </p>

            <div className="mt-4">
              <input
                type="search"
                value={pageSearch}
                onChange={(event) => setPageSearch(event.target.value)}
                placeholder="Search URLs..."
                aria-label="Search page inventory by URL"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:max-w-md"
              />
            </div>
          </div>

          {filteredPages.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">URL</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Sessions
                    </th>
                    <th className="px-4 py-3 text-right font-medium">SEO</th>
                    <th className="px-4 py-3 text-right font-medium">AEO</th>
                    <th className="px-4 py-3 text-right font-medium">GEO</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Performance
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredPages.map((page, index) => (
                    <tr
                      key={`${page.url}-${index}`}
                      className="hover:bg-gray-50"
                    >
                      <td className="max-w-sm break-all px-5 py-4 font-medium text-gray-800">
                        {page.url}
                      </td>

                      <td className="px-4 py-4 text-right text-gray-600">
                        {page.sessions === null
                          ? "—"
                          : formatNumber(page.sessions)}
                      </td>

                      <td className="px-4 py-4 text-right text-xs text-gray-400">
                        Not scored
                      </td>
                      <td className="px-4 py-4 text-right text-xs text-gray-400">
                        Not scored
                      </td>
                      <td className="px-4 py-4 text-right text-xs text-gray-400">
                        Not scored
                      </td>
                      <td className="px-4 py-4 text-right text-xs text-gray-400">
                        Not scored
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-medium text-gray-800">
                {pageData.length === 0
                  ? "No URLs imported yet"
                  : "No matching URLs"}
              </p>

              <p className="mt-2 text-sm text-gray-500">
                {pageData.length === 0
                  ? "Upload your existing URL CSV using the button at the top of the page."
                  : "Try a different search term."}
              </p>
            </div>
          )}

          {pageData.length > 0 && (
            <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-400">
              Showing {formatNumber(filteredPages.length)} of{" "}
              {formatNumber(pageData.length)} imported URLs. Scores will appear
              once the analysis engine is connected.
            </div>
          )}
        </section>
      </div>
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

    const section =
      details[activeSection as Exclude<Section, "Overview">];

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
              <li
                key={step}
                className="flex items-start gap-3 text-sm text-gray-600"
              >
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
            : activeSection === "Content scoring"
              ? renderContentScoring()
              : renderPlaceholder()}
        </div>
      </main>
    </div>
  );
}
