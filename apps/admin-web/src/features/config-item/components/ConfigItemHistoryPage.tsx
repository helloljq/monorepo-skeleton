import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfigItemControllerGetHistory } from "@/api/generated/config-center-config-items/config-center-config-items";
import type { ConfigItemHistory, ConfigItemHistoryResponse } from "../types";
import { ConfigItemHistoryTable } from "./ConfigItemHistoryTable";
import { RollbackConfirmDialog } from "./RollbackConfirmDialog";
import { ValueViewDialog } from "./ValueViewDialog";
import { HistoryDiffDialog } from "./HistoryDiffDialog";

export function ConfigItemHistoryPage() {
  const navigate = useNavigate();
  const { namespace, key } = useParams<{ namespace: string; key: string }>();

  const [rollbackVersion, setRollbackVersion] = useState<number | null>(null);
  const [viewItem, setViewItem] = useState<ConfigItemHistory | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const { data, isLoading } =
    useConfigItemControllerGetHistory<ConfigItemHistoryResponse>(
      namespace || "",
      key || "",
      undefined,
      {
        query: { enabled: !!namespace && !!key },
      },
    );

  // 参数校验：namespace 和 key 必须存在
  if (!namespace || !key) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">缺少必要参数</p>
          <Button
            className="mt-4"
            onClick={() => navigate("/config/namespaces")}
          >
            返回命名空间列表
          </Button>
        </div>
      </div>
    );
  }

  const handleRollback = (version: number) => {
    setRollbackVersion(version);
  };

  const handleRollbackSuccess = () => {
    setRollbackVersion(null);
    navigate(`/config/namespaces/${namespace}/items`);
  };

  const handleViewValue = (item: ConfigItemHistory) => {
    setViewItem(item);
  };

  const handleCompare = () => {
    setShowDiff(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/config/namespaces/${namespace}/items`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">配置变更历史</h1>
          <p className="text-muted-foreground">
            命名空间:{" "}
            <span className="font-mono font-semibold">{namespace}</span> /
            配置键: <span className="font-mono font-semibold">{key}</span>
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>历史记录</CardTitle>
        </CardHeader>
        <CardContent>
          <ConfigItemHistoryTable
            data={data?.data}
            isLoading={isLoading}
            onRollback={handleRollback}
            onViewValue={handleViewValue}
            onCompare={handleCompare}
          />
        </CardContent>
      </Card>

      {rollbackVersion !== null && namespace && key && (
        <RollbackConfirmDialog
          namespace={namespace}
          configKey={key}
          version={String(rollbackVersion)}
          onClose={() => setRollbackVersion(null)}
          onSuccess={handleRollbackSuccess}
        />
      )}

      {viewItem && (
        <ValueViewDialog
          open={!!viewItem}
          onOpenChange={(open) => !open && setViewItem(null)}
          value={viewItem.value}
          version={viewItem.version}
          valueType={viewItem.valueType}
        />
      )}

      {showDiff && data?.data && (
        <HistoryDiffDialog
          open={showDiff}
          onOpenChange={setShowDiff}
          historyItems={data.data}
        />
      )}
    </div>
  );
}
