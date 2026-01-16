import { UserCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { User } from "@/features/user/types";

interface UserTableProps {
  data: User[];
  isLoading: boolean;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
  onAssignRoles: (user: User) => void;
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
}

export function UserTable({
  data,
  isLoading,
  pagination,
  onPageChange,
  onAssignRoles,
  selectedIds,
  onSelectChange,
}: UserTableProps) {
  const { page, totalPages } = pagination;

  const isAllSelected =
    data.length > 0 && data.every((user) => selectedIds.includes(user.id));
  const isIndeterminate =
    data.some((user) => selectedIds.includes(user.id)) &&
    !data.every((user) => selectedIds.includes(user.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newIds = [
        ...new Set([...selectedIds, ...data.map((user) => user.id)]),
      ];
      onSelectChange(newIds);
    } else {
      const currentPageIds = data.map((user) => user.id);
      onSelectChange(selectedIds.filter((id) => !currentPageIds.includes(id)));
    }
  };

  const handleSelectOne = (userId: string, checked: boolean) => {
    if (checked) {
      onSelectChange([...selectedIds, userId]);
    } else {
      onSelectChange(selectedIds.filter((id) => id !== userId));
    }
  };

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: User["status"]) => {
    const variants = {
      ACTIVE: { variant: "default" as const, label: "正常" },
      DISABLED: { variant: "secondary" as const, label: "禁用" },
      PENDING: { variant: "outline" as const, label: "待激活" },
    };
    const config = variants[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={isIndeterminate ? "indeterminate" : isAllSelected}
                onCheckedChange={handleSelectAll}
                aria-label="全选"
              />
            </TableHead>
            <TableHead className="w-[80px]">ID</TableHead>
            <TableHead className="w-[220px]">邮箱</TableHead>
            <TableHead className="w-[150px]">姓名</TableHead>
            <TableHead className="w-[100px]">状态</TableHead>
            <TableHead className="w-[180px]">创建时间</TableHead>
            <TableHead className="w-[180px]">更新时间</TableHead>
            <TableHead className="w-[120px] text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((user) => (
            <TableRow
              key={user.id}
              data-state={selectedIds.includes(user.id) ? "selected" : ""}
            >
              <TableCell>
                <Checkbox
                  checked={selectedIds.includes(user.id)}
                  onCheckedChange={(checked) =>
                    handleSelectOne(user.id, !!checked)
                  }
                  aria-label={`选择用户 ${user.email}`}
                />
              </TableCell>
              <TableCell className="font-mono text-sm">{user.id}</TableCell>
              <TableCell className="font-medium">{user.email}</TableCell>
              <TableCell>{user.name || "-"}</TableCell>
              <TableCell>{getStatusBadge(user.status)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(user.createdAt)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(user.updatedAt)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAssignRoles(user)}
                >
                  <UserCog className="mr-1 h-4 w-4" />
                  分配角色
                </Button>
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
