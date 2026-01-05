import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * 生成分页页码数组
 */
function getPaginationRange(
  currentPage: number,
  totalPages: number,
  delta = 2,
): (number | "ellipsis")[] {
  const range: (number | "ellipsis")[] = [];

  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - delta && i <= currentPage + delta)
    ) {
      range.push(i);
    } else if (range[range.length - 1] !== "ellipsis") {
      range.push("ellipsis");
    }
  }

  return range;
}

export interface DataTablePaginationProps {
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  limit: number;
  /** 总条数 */
  total: number;
  /** 总页数 */
  totalPages: number;
  /** 可选的每页条数选项 */
  pageSizeOptions?: number[];
  /** 页码变化回调 */
  onPageChange: (page: number) => void;
  /** 每页条数变化回调 */
  onPageSizeChange?: (limit: number) => void;
  /** 是否显示页码输入框 */
  showQuickJump?: boolean;
  /** 是否显示每页条数选择器 */
  showSizeChanger?: boolean;
}

/**
 * 通用数据表格分页组件
 *
 * 特性：
 * - 页码按钮 + 省略号显示
 * - 支持直接输入页码跳转
 * - 支持选择每页显示条数
 * - 首页/末页快捷按钮
 */
export function DataTablePagination({
  page,
  limit,
  total,
  totalPages,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
  showQuickJump = true,
  showSizeChanger = true,
}: DataTablePaginationProps) {
  const [jumpPage, setJumpPage] = useState("");

  // 如果没有数据或只有一页，不显示分页
  if (total === 0) {
    return null;
  }

  const paginationRange = getPaginationRange(page, totalPages);

  // 处理跳转页码
  const handleJump = () => {
    const pageNum = parseInt(jumpPage, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setJumpPage("");
    }
  };

  // 处理回车键跳转
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleJump();
    }
  };

  // 计算当前显示范围
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t px-4 py-3">
      {/* 左侧：统计信息 */}
      <div className="text-sm text-muted-foreground">
        共 {total} 条记录，显示 {startItem}-{endItem} 条，第 {page}/{totalPages}{" "}
        页
      </div>

      {/* 右侧：分页控件 */}
      <div className="flex flex-wrap items-center gap-2">
        {/* 每页条数选择器 */}
        {showSizeChanger && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">每页</span>
            <Select
              value={String(limit)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">条</span>
          </div>
        )}

        {/* 首页按钮 */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          title="首页"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* 上一页按钮 */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          title="上一页"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* 页码按钮 */}
        <div className="flex items-center gap-1">
          {paginationRange.map((item, index) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="px-2 text-muted-foreground"
              >
                ...
              </span>
            ) : (
              <Button
                key={item}
                variant={item === page ? "default" : "outline"}
                size="icon"
                className="h-8 w-8"
                onClick={() => onPageChange(item)}
              >
                {item}
              </Button>
            ),
          )}
        </div>

        {/* 下一页按钮 */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          title="下一页"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* 末页按钮 */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          title="末页"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>

        {/* 跳转输入框 */}
        {showQuickJump && totalPages > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">跳至</span>
            <Input
              type="number"
              min={1}
              max={totalPages}
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleJump}
              placeholder={String(page)}
              className="h-8 w-[60px] text-center"
            />
            <span className="text-sm text-muted-foreground">页</span>
          </div>
        )}
      </div>
    </div>
  );
}
