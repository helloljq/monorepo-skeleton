interface ConfigItemValueProps {
  value: unknown;
  isEncrypted?: boolean;
  maxLength?: number;
  multiline?: boolean;
}

export function ConfigItemValue({
  value,
  isEncrypted,
  maxLength = 50,
  multiline = false,
}: ConfigItemValueProps) {
  if (isEncrypted) {
    return <span className="text-muted-foreground">******</span>;
  }

  const valueStr =
    typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);

  if (valueStr.length > maxLength) {
    if (multiline) {
      return (
        <div className="max-w-md">
          <pre className="overflow-auto rounded bg-muted p-2 font-mono text-xs">
            {valueStr.substring(0, maxLength)}...
          </pre>
        </div>
      );
    }
    return (
      <span className="font-mono text-xs" title={valueStr}>
        {valueStr.substring(0, maxLength)}...
      </span>
    );
  }

  if (multiline) {
    return (
      <pre className="overflow-auto rounded bg-muted p-2 font-mono text-xs">
        {valueStr}
      </pre>
    );
  }

  return <span className="font-mono text-xs">{valueStr}</span>;
}
