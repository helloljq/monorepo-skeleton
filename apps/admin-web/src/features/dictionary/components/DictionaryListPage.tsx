import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Plus, Search, RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useDictionaryControllerFindAll,
  getDictionaryControllerFindAllQueryKey,
} from "@/api/generated/dictionary/dictionary";
import type {
  Dictionary,
  DictionaryListResponse,
} from "@/features/dictionary/types";
import { DictionaryTable } from "./DictionaryTable";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

export function DictionaryListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get("page")) || 1;
  const pageSize =
    Number(searchParams.get("pageSize") ?? searchParams.get("limit")) || 10;
  const type = searchParams.get("type") || "";
  const isEnabled = searchParams.get("isEnabled");

  const [typeFilter, setTypeFilter] = useState(type);
  const [deleteItem, setDeleteItem] = useState<Dictionary | null>(null);

  const { data, isLoading } =
    useDictionaryControllerFindAll<DictionaryListResponse>({
      page,
      pageSize,
      type: type || undefined,
      isEnabled:
        isEnabled === "true"
          ? "true"
          : isEnabled === "false"
            ? "false"
            : undefined,
    });

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams);
    if (typeFilter) {
      params.set("type", typeFilter);
    } else {
      params.delete("type");
    }
    params.set("page", "1");
    setSearchParams(params);
  };

  const handleReset = () => {
    setTypeFilter("");
    setSearchParams({ page: "1", pageSize: String(pageSize) });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(newPage));
    setSearchParams(params);
  };

  const handleStatusFilterChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("isEnabled");
    } else {
      params.set("isEnabled", value);
    }
    params.set("page", "1");
    setSearchParams(params);
  };

  const handleCreate = () => {
    navigate("/system/dictionaries/create");
  };

  const handleEdit = (item: Dictionary) => {
    navigate(`/system/dictionaries/${item.id}/edit`);
  };

  const handleDelete = (item: Dictionary) => {
    setDeleteItem(item);
  };

  const handleDeleteSuccess = () => {
    setDeleteItem(null);
    queryClient.invalidateQueries({
      queryKey: getDictionaryControllerFindAllQueryKey(),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">字典管理</h1>
          <p className="text-muted-foreground">
            管理系统字典数据，用于下拉选项、状态映射等场景
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新增字典
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[200px] flex-1">
              <label className="mb-2 block text-sm font-medium">字典类型</label>
              <Input
                placeholder="输入字典类型"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="w-[150px]">
              <label className="mb-2 block text-sm font-medium">状态</label>
              <Select
                value={isEnabled === null ? "all" : isEnabled || "all"}
                onValueChange={handleStatusFilterChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="true">已启用</SelectItem>
                  <SelectItem value="false">已禁用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSearch}>
                <Search className="mr-2 h-4 w-4" />
                搜索
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="mr-2 h-4 w-4" />
                重置
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DictionaryTable
            data={Array.isArray(data?.items) ? data.items : []}
            isLoading={isLoading}
            pagination={{
              page,
              pageSize: data?.pagination?.pageSize ?? pageSize,
              total: data?.pagination?.total || 0,
              totalPages:
                (data?.pagination?.pageSize ?? pageSize) > 0
                  ? Math.ceil(
                      (data?.pagination?.total || 0) /
                        (data?.pagination?.pageSize ?? pageSize),
                    )
                  : 0,
            }}
            onPageChange={handlePageChange}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </CardContent>
      </Card>

      <DeleteConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        item={deleteItem}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}
