import { useState, useMemo } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { Maximize2, Minimize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ConfigItemHistory } from "../types";

interface HistoryDiffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  historyItems: ConfigItemHistory[];
}

export function HistoryDiffDialog({
  open,
  onOpenChange,
  historyItems,
}: HistoryDiffDialogProps) {
  const { resolvedTheme } = useTheme();

  const sortedItems = useMemo(
    () => [...historyItems].sort((a, b) => b.version - a.version),
    [historyItems],
  );

  // 默认选择：左侧为次新版本，右侧为最新版本
  const defaultLeftVersion =
    sortedItems.length > 1 ? sortedItems[1].version.toString() : "";
  const defaultRightVersion =
    sortedItems.length > 0 ? sortedItems[0].version.toString() : "";

  const [leftVersion, setLeftVersion] = useState<string>(defaultLeftVersion);
  const [rightVersion, setRightVersion] = useState<string>(defaultRightVersion);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const leftItem = sortedItems.find(
    (item) => item.version.toString() === leftVersion,
  );
  const rightItem = sortedItems.find(
    (item) => item.version.toString() === rightVersion,
  );

  const formatValue = (value: unknown): string => {
    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const leftValue = leftItem ? formatValue(leftItem.value) : "";
  const rightValue = rightItem ? formatValue(rightItem.value) : "";
  const language =
    leftItem?.valueType === "JSON" || rightItem?.valueType === "JSON"
      ? "json"
      : "plaintext";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col",
          isFullscreen
            ? "max-w-screen h-screen max-h-screen w-screen"
            : "max-w-6xl",
        )}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle>版本对比</DialogTitle>
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
        <div className="flex flex-shrink-0 gap-4">
          <div className="flex-1">
            <label className="mb-2 block text-sm font-medium">旧版本</label>
            <Select value={leftVersion} onValueChange={setLeftVersion}>
              <SelectTrigger>
                <SelectValue placeholder="选择版本" />
              </SelectTrigger>
              <SelectContent>
                {sortedItems.map((item) => (
                  <SelectItem
                    key={item.version}
                    value={item.version.toString()}
                  >
                    v{item.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="mb-2 block text-sm font-medium">新版本</label>
            <Select value={rightVersion} onValueChange={setRightVersion}>
              <SelectTrigger>
                <SelectValue placeholder="选择版本" />
              </SelectTrigger>
              <SelectContent>
                {sortedItems.map((item) => (
                  <SelectItem
                    key={item.version}
                    value={item.version.toString()}
                  >
                    v{item.version}
                    {item.version === sortedItems[0]?.version && " (当前)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex-1 overflow-hidden rounded-md border">
          <DiffEditor
            height={isFullscreen ? "100%" : "400px"}
            language={language}
            original={leftValue}
            modified={rightValue}
            theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              renderSideBySide: true,
              wordWrap: "on",
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
