"use client"

import { useState, useCallback, useMemo } from "react"
import { Copy, Check, Play, X, Code2, Loader2, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_NOXIS_API_URL || "http://localhost:5000"

type RunKind = "iframe" | "python" | null

function getRunKind(language: string): RunKind {
  const l = language.toLowerCase().trim()
  if (["python", "py"].includes(l)) return "python"
  if (
    [
      "html",
      "htm",
      "css",
      "javascript",
      "js",
      "jsx",
      "tsx",
      "svg",
      "json",
    ].includes(l)
  ) {
    return "iframe"
  }
  return null
}

/** Prevent breaking out of <script> / <style> when embedding user code in srcDoc. */
function escapeClosingTag(code: string, tag: "script" | "style") {
  const re = tag === "script" ? /<\/script/gi : /<\/style/gi
  return code.replace(re, `<\\/${tag}`)
}

interface CodeBlockProps {
  code: string
  language: string
  className?: string
}

// Lightweight syntax highlighting (no external dependencies)
function highlightCode(code: string, language: string): string {
  const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  // Basic keyword sets for common languages
  const keywords: Record<string, string[]> = {
    javascript: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "class", "import", "export", "from", "async", "await", "try", "catch", "throw", "new", "this", "true", "false", "null", "undefined"],
    typescript: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "class", "import", "export", "from", "async", "await", "try", "catch", "throw", "new", "this", "true", "false", "null", "undefined", "interface", "type", "enum", "implements", "extends"],
    python: ["def", "class", "return", "if", "elif", "else", "for", "while", "import", "from", "as", "try", "except", "raise", "with", "True", "False", "None", "and", "or", "not", "in", "is", "lambda", "yield", "async", "await"],
    html: ["<!DOCTYPE", "<html", "<head", "<body", "<div", "<span", "<p", "<a", "<img", "<script", "<style", "<link", "<meta", "<title", "<h1", "<h2", "<h3", "<ul", "<li", "<form", "<input", "<button"],
    css: ["color", "background", "margin", "padding", "border", "font", "display", "flex", "grid", "position", "width", "height", "top", "left", "right", "bottom", "z-index", "transform", "transition", "animation"],
  }

  const lang = language.toLowerCase()
  const keywordSet = new Set(keywords[lang] || keywords.javascript || [])

  // Tokenize once so we never run regexes on injected HTML.
  const tokenRegex =
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\/.*$|\/\*[\s\S]*?\*\/|#.*$|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b)/gm

  let result = ""
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(code)) !== null) {
    const token = match[0]
    result += escapeHtml(code.slice(lastIndex, match.index))

    if (
      token.startsWith('"') ||
      token.startsWith("'") ||
      token.startsWith("`")
    ) {
      result += `<span class="text-green-400">${escapeHtml(token)}</span>`
    } else if (
      token.startsWith("//") ||
      token.startsWith("/*") ||
      token.startsWith("#")
    ) {
      result += `<span class="text-muted-foreground italic">${escapeHtml(token)}</span>`
    } else if (/^\d+(?:\.\d+)?$/.test(token)) {
      result += `<span class="text-orange-400">${escapeHtml(token)}</span>`
    } else if (keywordSet.has(token)) {
      result += `<span class="text-primary font-medium">${escapeHtml(token)}</span>`
    } else {
      result += escapeHtml(token)
    }

    lastIndex = match.index + token.length
  }

  result += escapeHtml(code.slice(lastIndex))
  return result
}

export function CodeBlock({ code, language, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [serverLoading, setServerLoading] = useState(false)
  const [serverOutput, setServerOutput] = useState("")
  const [serverError, setServerError] = useState("")

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  const highlightedCode = useMemo(
    () => highlightCode(code, language),
    [code, language]
  )

  const runKind = useMemo(() => getRunKind(language), [language])
  const canRun = runKind !== null

  const runPython = useCallback(async () => {
    setServerLoading(true)
    setServerOutput("")
    setServerError("")
    try {
      const res = await fetch(`${API_BASE_URL}/api/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        output?: string
        error?: string
      }
      setServerOutput(data.output ?? "")
      setServerError(data.error ?? "")
      if (!res.ok && !data.error && !data.output) {
        setServerError(`HTTP ${res.status}`)
      }
    } catch (e) {
      setServerError(
        e instanceof Error ? e.message : "Could not reach Noxis backend"
      )
    } finally {
      setServerLoading(false)
    }
  }, [code])

  const togglePreview = useCallback(() => {
    const next = !showPreview
    setShowPreview(next)
    if (next && runKind === "python") {
      void runPython()
    }
  }, [showPreview, runKind, runPython])

  // Generate preview HTML for sandboxed iframe
  const previewHtml = useMemo(() => {
    if (runKind !== "iframe") return ""

    const lang = language.toLowerCase()

    if (lang === "html" || lang === "htm") {
      return code
    }

    if (lang === "svg") {
      return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a}</style></head><body>${code}</body></html>`
    }

    if (lang === "json") {
      let formatted = ""
      let err = ""
      try {
        formatted = JSON.stringify(JSON.parse(code), null, 2)
      } catch {
        err = "Invalid JSON"
      }
      const esc = (s: string) =>
        s
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
      return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><style>body{margin:0;padding:16px;background:#0f172a;color:#e2e8f0;font:13px/1.5 ui-monospace,monospace}</style></head><body><pre>${err ? esc(err) : esc(formatted)}</pre></body></html>`
    }

    if (lang === "css") {
      const safe = escapeClosingTag(code, "style")
      return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><style>${safe}</style></head>
<body>
  <div class="demo">
    <h1>CSS Preview</h1>
    <p>This is a paragraph with your styles applied.</p>
    <button type="button">Button</button>
    <div class="box">Box Element</div>
  </div>
</body>
</html>`
    }

    if (
      lang === "javascript" ||
      lang === "js" ||
      lang === "jsx" ||
      lang === "tsx"
    ) {
      const safe = escapeClosingTag(code, "script")
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: system-ui, sans-serif; padding: 16px; background: #1a1a2e; color: #eee; }
    #output { white-space: pre-wrap; font-family: ui-monospace, monospace; background: #0f0f1a; padding: 12px; border-radius: 8px; margin-top: 12px; min-height: 2rem; }
    .hint { font-size: 12px; color: #94a3b8; margin-bottom: 8px; }
  </style>
</head>
<body>
  ${lang === "tsx" || lang === "jsx" ? '<p class="hint">JSX/TSX runs as plain JS here; TypeScript types are not supported.</p>' : ""}
  <h3>JavaScript output</h3>
  <div id="output"></div>
  <script>
    const output = document.getElementById('output');
    const originalLog = console.log;
    console.log = (...args) => {
      output.textContent += args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') + '\\n';
      originalLog.apply(console, args);
    };
    try {
      ${safe}
    } catch (e) {
      output.textContent += 'Error: ' + (e && e.message ? e.message : e);
    }
  </script>
</body>
</html>`
    }

    return ""
  }, [code, language, runKind])

  return (
    <div className={cn("rounded-xl overflow-hidden border border-border bg-card my-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {language}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {canRun && (
            <Button
              variant="ghost"
              size="sm"
              onClick={togglePreview}
              disabled={serverLoading}
              className={cn(
                "h-7 px-2 text-xs gap-1 transition-all duration-200",
                showPreview && "bg-primary/10 text-primary"
              )}
            >
              {serverLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : showPreview ? (
                <X className="w-3 h-3" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              {showPreview ? "Close" : runKind === "python" ? "Run" : "Preview"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2 text-xs gap-1 transition-all duration-200"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-primary" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                Copy
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Code */}
      <div className="overflow-x-auto">
        <pre className="p-4 text-sm leading-relaxed">
          <code
            className="font-mono"
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        </pre>
      </div>

      {/* Live preview (web) or Python output (backend) */}
      {showPreview && runKind === "iframe" && (
        <div className="border-t border-border">
          <div className="px-3 py-2 bg-muted/30 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">Live preview</span>
          </div>
          <div className="relative bg-background">
            <iframe
              srcDoc={previewHtml}
              sandbox="allow-scripts"
              className="w-full min-h-[200px] h-56 border-0"
              title="Code preview"
            />
          </div>
        </div>
      )}

      {showPreview && runKind === "python" && (
        <div className="border-t border-border">
          <div className="px-3 py-2 bg-muted/30 flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Python (Noxis backend, ~5s timeout)
            </span>
          </div>
          <div className="p-3 bg-background space-y-2">
            {serverLoading ? (
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Running…
              </p>
            ) : (
              <>
                {serverOutput ? (
                  <pre className="text-xs font-mono whitespace-pre-wrap text-foreground rounded-lg bg-muted/40 p-3 border border-border">
                    {serverOutput}
                  </pre>
                ) : null}
                {serverError ? (
                  <pre className="text-xs font-mono whitespace-pre-wrap text-destructive rounded-lg bg-destructive/10 p-3 border border-destructive/20">
                    {serverError}
                  </pre>
                ) : null}
                {!serverOutput && !serverError && !serverLoading ? (
                  <p className="text-xs text-muted-foreground">No output.</p>
                ) : null}
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => void runPython()}
              disabled={serverLoading}
            >
              Run again
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Parse markdown code blocks from message content
export function parseCodeBlocks(content: string): Array<{ type: "text" | "code"; content: string; language?: string }> {
  const parts: Array<{ type: "text" | "code"; content: string; language?: string }> = []
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g
  
  let lastIndex = 0
  let match

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index)
      if (text.trim()) {
        parts.push({ type: "text", content: text })
      }
    }

    // Add code block
    parts.push({
      type: "code",
      language: match[1] || "plaintext",
      content: match[2].trim(),
    })

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex)
    if (text.trim()) {
      parts.push({ type: "text", content: text })
    }
  }

  // If no code blocks found, return original content as text
  if (parts.length === 0) {
    parts.push({ type: "text", content })
  }

  return parts
}
