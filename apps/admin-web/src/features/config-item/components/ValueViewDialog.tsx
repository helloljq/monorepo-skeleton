import { useState } from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { Maximize2, Minimize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ValueViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: unknown;
  version?: number;
  valueType?: string;
}

export function ValueViewDialog({
  open,
  onOpenChange,
  value,
  version,
  valueType,
}: ValueViewDialogProps) {
  const { resolvedTheme } = useTheme();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const valueStr =
    typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
  const language = valueType === "JSON" ? "json" : "plaintext";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col",
          isFullscreen
            ? "max-w-screen h-screen max-h-screen w-screen"
            : "max-w-4xl",
        )}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle>
              配置值详情
              {version !== undefined && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  v{version}
                </span>
              )}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "退出全屏" : "全屏"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden rounded-md border">
          <Editor
            height={isFullscreen ? "100%" : "400px"}
            language={language}
            value={valueStr}
            theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: "on",
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
