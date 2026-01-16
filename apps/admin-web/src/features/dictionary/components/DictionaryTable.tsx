import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import type { Dictionary } from "@/features/dictionary/types";

interface DictionaryTableProps {
  data: Dictionary[];
  isLoading: boolean;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
  onEdit: (item: Dictionary) => void;
  onDelete: (item: Dictionary) => void;
}

export function DictionaryTable({
  data,
  isLoading,
  pagination,
  onPageChange,
  onEdit,
  onDelete,
}: DictionaryTableProps) {
  const { page, total, totalPages } = pagination;

  const items = Array.isArray(data) ? data : [];

  if (isLoading) {
    return (
      <div className="p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4 py-3">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-[120px]" />
            <Skeleton className="h-4 w-[80px]" />
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-[60px]" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-muted-foreground">
        暂无数据
      </div>
    );
  }

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const showPages = 5;

    if (totalPages <= showPages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (page <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1);
        pages.push("ellipsis");
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push("ellipsis");
        for (let i = page - 1; i <= page + 1; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
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
            <TableHead className="w-[120px]">类型</TableHead>
            <TableHead className="w-[150px]">键</TableHead>
            <TableHead className="w-[120px]">值</TableHead>
            <TableHead className="w-[150px]">标签</TableHead>
            <TableHead className="w-[80px]">排序</TableHead>
            <TableHead className="w-[80px]">状态</TableHead>
            <TableHead className="w-[100px]">版本</TableHead>
            <TableHead className="w-[100px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-mono text-sm">{item.type}</TableCell>
              <TableCell className="font-mono text-sm">{item.key}</TableCell>
              <TableCell className="font-mono text-sm">
                {String(item.value)}
              </TableCell>
              <TableCell>{item.label}</TableCell>
              <TableCell>{item.sort}</TableCell>
              <TableCell>
                <Badge variant={item.isEnabled ? "default" : "secondary"}>
                  {item.isEnabled ? "启用" : "禁用"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {item.version || "-"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEdit(item)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
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

      <div className="flex items-center justify-between border-t px-4 py-3">
        <div className="text-sm text-muted-foreground">共 {total} 条记录</div>
        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => page > 1 && onPageChange(page - 1)}
                  className={
                    page <= 1
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
              {getPageNumbers().map((pageNum, index) =>
                pageNum === "ellipsis" ? (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <span className="px-2">...</span>
                  </PaginationItem>
                ) : (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      isActive={page === pageNum}
                      onClick={() => onPageChange(pageNum)}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <PaginationNext
                  onClick={() => page < totalPages && onPageChange(page + 1)}
                  className={
                    page >= totalPages
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  );
}
