export type TableCell = string | number | boolean;
export type TableColumn = {
  id: string;
  name: string;
  type: string;
  options?: string[];
  formulaSourceId?: string;
  formulaOperator?: string;
  formulaFactor?: number;
  relationTableId?: string;
  rollupRelationId?: string;
  rollupTargetId?: string;
  rollupAggregate?: Aggregate;
};
export type TableRow = { id: string; cells: Record<string, TableCell> };
export type TableData = { id: string; name: string; columns: TableColumn[]; rows: TableRow[] };

export function valueForColumn(
  row: TableRow,
  column: TableColumn,
  tables: TableData[],
): TableCell | undefined {
  if (column.type === "formula") {
    if (!column.formulaSourceId) return undefined;
    const number = Number(row.cells[column.formulaSourceId]);
    if (!Number.isFinite(number)) return undefined;
    const factor = Number(column.formulaFactor ?? 1);
    if (!Number.isFinite(factor)) return undefined;
    switch (column.formulaOperator) {
      case "+": return number + factor;
      case "-": return number - factor;
      case "/": return factor === 0 ? undefined : number / factor;
      default: return number * factor;
    }
  }
  if (column.type === "relation") {
    const target = tables.find(item => item.id === column.relationTableId);
    const linked = target?.rows.find(item => item.id === row.cells[column.id]);
    return linked ? String(linked.cells[target?.columns[0]?.id ?? ""] ?? linked.id) : undefined;
  }
  if (column.type === "rollup") {
    const relation = tables.flatMap(table=>table.columns).find(item=>item.id===column.rollupRelationId && item.type==="relation");
    const target=tables.find(table=>table.id===relation?.relationTableId);
    const source=target?.columns.find(item=>item.id===column.rollupTargetId);
    if(!target||!source||!relation)return undefined;
    const raw=row.cells[relation.id];
    const ids=String(raw??"").split(",").map(id=>id.trim()).filter(Boolean);
    const matches=target.rows.filter(item=>ids.includes(item.id));
    if(column.rollupAggregate==="count")return matches.length;
    const values=matches.map(item=>Number(valueForColumn(item,source,tables))).filter(Number.isFinite);
    if(!values.length)return 0;
    switch(column.rollupAggregate){
      case "average":return values.reduce((a,b)=>a+b,0)/values.length;
      case "min":return Math.min(...values);
      case "max":return Math.max(...values);
      default:return values.reduce((a,b)=>a+b,0);
    }
  }
  return row.cells[column.id];
}

export function formatCell(value: TableCell | undefined): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  return String(value);
}

export type Aggregate = "sum" | "average" | "min" | "max" | "count";
export function aggregateRows(
  rows: TableRow[],
  column: TableColumn | undefined,
  tables: TableData[],
  mode: Aggregate,
): number {
  if (mode === "count") return rows.length;
  if (!column) return 0;
  const values = rows
    .map(row => Number(valueForColumn(row, column, tables)))
    .filter(n => Number.isFinite(n));
  if (!values.length) return 0;
  switch (mode) {
    case "average": return values.reduce((a, b) => a + b, 0) / values.length;
    case "min": return Math.min(...values);
    case "max": return Math.max(...values);
    default: return values.reduce((a, b) => a + b, 0);
  }
}

export type RowFilter = {
  columnId?: string;
  operator?: "contains" | "equals" | "not_equals" | "gt" | "lt" | "empty" | "not_empty";
  value?: string;
};
export function filterRows(
  rows: TableRow[],
  table: TableData,
  tables: TableData[],
  filter: RowFilter,
): TableRow[] {
  if (!filter.columnId) return rows;
  const column = table.columns.find(item => item.id === filter.columnId);
  if (!column) return rows;
  const op = filter.operator ?? "contains";
  const expected = (filter.value ?? "").trim().toLocaleLowerCase("ru");
  if (!expected && op !== "empty" && op !== "not_empty") return rows;
  return rows.filter(row => {
    const actualValue = valueForColumn(row, column, tables);
    const actual = String(actualValue ?? "").toLocaleLowerCase("ru");
    if (op === "empty") return !actual;
    if (op === "not_empty") return Boolean(actual);
    if (op === "equals") return actual === expected;
    if (op === "not_equals") return actual !== expected;
    if (op === "gt" || op === "lt") {
      if (actualValue === undefined || actualValue === "" || expected === "") return false;
      const a = Number(actualValue), b = Number(expected);
      return Number.isFinite(a) && Number.isFinite(b) && (op === "gt" ? a > b : a < b);
    }
    return actual.includes(expected);
  });
}
