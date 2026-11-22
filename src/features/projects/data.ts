export type ProjectStatus = "active" | "development" | "support" | "frozen" | "completed";
export type ProjectPriority = "low" | "medium" | "high" | "critical";
export type MetricType = "number" | "percent" | "boolean" | "text";
export type MetricValue = number | boolean | string;
export type KeyResult = {
  id: string; title: string; metricType: MetricType; unit: string;
  plannedValue: MetricValue; actualValue: MetricValue; deadline: string;
  taskIds: string[]; history: { at: string; value: MetricValue }[];
};
export type ProjectGoal = {
  id: string; title: string; description: string; horizon: "year" | "quarter" | "month";
  deadline: string; keyResults: KeyResult[]; createdAt: string; updatedAt: string;
};
export type ProjectHistory = { id: string; at: string; action: string; details: string };
export type Project = {
  id: string; name: string; description: string; category: string;
  status: ProjectStatus; priority: ProjectPriority; owners: string[];
  createdAt: string; startDate: string; deadline: string; budget: number;
  relatedProjectIds: string[]; tableIds: string[]; fileIds: string[];
  notes: string; goals: ProjectGoal[]; history: ProjectHistory[];
  income: number; expenses: number; updatedAt: string;
};
export type ProjectsData = { version: 1; projects: Project[] };
export const PROJECTS_KEY = "fox-projects-v1";
const empty = (): ProjectsData => ({ version: 1, projects: [] });
export function readProjects(): ProjectsData {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<ProjectsData>;
    return { version: 1, projects: Array.isArray(parsed.projects) ? parsed.projects : [] };
  } catch { return empty(); }
}
export function saveProjects(data: ProjectsData) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify({ ...data, version: 1 }));
  window.dispatchEvent(new Event("fox-projects-updated"));
}
export const projectId = () => crypto.randomUUID();
export const PROJECT_STATUS: Record<ProjectStatus,string> = {
  active:"Активный", development:"Разработка", support:"Поддержка", frozen:"Заморожен", completed:"Завершён"
};
export const PROJECT_PRIORITY: Record<ProjectPriority,string> = {
  low:"Низкий", medium:"Средний", high:"Высокий", critical:"Критический"
};
export const HORIZON_LABEL: Record<ProjectGoal["horizon"],string> = {
  year:"Годовая цель", quarter:"Квартальная цель", month:"Месячная цель"
};
export function keyResultProgress(result: KeyResult): number | null {
  if (result.metricType === "boolean") return result.actualValue === true ? 100 : 0;
  if (result.metricType === "text") return null;
  const planned = Number(result.plannedValue);
  if (!Number.isFinite(planned) || planned === 0) return null;
  return Math.max(0, Math.min(100, Number(result.actualValue) / planned * 100));
}
export function goalProgress(goal: ProjectGoal): number | null {
  const values = goal.keyResults.map(keyResultProgress).filter((value): value is number => value !== null);
  return values.length ? Math.round(values.reduce((sum,value)=>sum+value,0)/values.length) : null;
}
