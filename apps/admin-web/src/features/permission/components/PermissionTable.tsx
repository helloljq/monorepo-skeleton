import { Edit, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Permission } from "@/features/permission/types";

interface PermissionTableProps {
  data: Permission[];
  isLoading: boolean;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
  onEdit: (item: Permission) => void;
  onDelete: (item: Permission) => void;
}

export function PermissionTable({
  data,
  isLoading,
  pagination,
  onPageChange,
  onEdit,
  onDelete,
}: PermissionTableProps) {
  const { page, totalPages } = pagination;

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">暂无数据</p>
        </div>
      </div>
    );
  }

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const showPages = 5;

    if (totalPages <= showPages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (page <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = page - 1; i <= page + 1; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">权限编码</TableHead>
            <TableHead>权限名称</TableHead>
            <TableHead className="w-[100px]">模块</TableHead>
            <TableHead className="w-[120px]">资源</TableHead>
            <TableHead className="w-[100px]">操作</TableHead>
            <TableHead className="w-[80px]">状态</TableHead>
            <TableHead className="w-[200px]">描述</TableHead>
            <TableHead className="w-[150px] text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-mono text-sm">{item.code}</TableCell>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell>
                {item.module && (
                  <Badge variant="secondary" className="font-normal">
                    {item.module}
                  </Badge>
                )}
              </TableCell>
              <TableCell>{item.resource}</TableCell>
              <TableCell>
                <Badge variant="outline" className="font-normal">
                  {item.action}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={item.isEnabled ? "default" : "secondary"}>
                  {item.isEnabled ? "启用" : "禁用"}
                </Badge>
              </TableCell>
              <TableCell>
                <div
                  className="max-w-[200px] truncate"
                  title={item.description || undefined}
                >
                  {item.description || "-"}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(item)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(item)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-6 py-4">
          <div className="text-sm text-muted-foreground">
            共 {pagination.total} 条数据，第 {page} / {totalPages} 页
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
            >
              上一页
            </Button>
            {getPageNumbers().map((pageNum, index) =>
              typeof pageNum === "number" ? (
                <Button
                  key={index}
                  variant={pageNum === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(pageNum)}
                >
                  {pageNum}
                </Button>
              ) : (
                <span key={index} className="flex items-center px-2">
                  {pageNum}
                </span>
              ),
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
