export type TaskStatus = "todo" | "doing" | "done";
export type Priority = "low" | "medium" | "high";
export type Task = {
  id: string; title: string; description: string; status: TaskStatus;
  priority: Priority; dueDate: string; important: boolean; urgent: boolean;
  tags: string[]; checklist: { id: string; title: string; done: boolean }[];
  createdAt: string; updatedAt: string;
};
export type Note = {
  id: string; title: string; body: string; pinned: boolean;
  tags: string[]; createdAt: string; updatedAt: string;
};
export type NotesTasksData = { tasks: Task[]; notes: Note[] };
export const NOTES_TASKS_KEY = "fox-notes-tasks-v1";
export const STATUS_LABELS: Record<TaskStatus,string> = { todo:"К выполнению", doing:"В работе", done:"Готово" };
export const PRIORITY_LABELS: Record<Priority,string> = { low:"Низкий", medium:"Средний", high:"Высокий" };
const empty = (): NotesTasksData => ({tasks:[],notes:[]});
export function readNotesTasks(): NotesTasksData {
  try {
    const raw = localStorage.getItem(NOTES_TASKS_KEY);
    if (!raw) return empty();
    const value = JSON.parse(raw) as Partial<NotesTasksData>;
    return {tasks:Array.isArray(value.tasks)?value.tasks:[],notes:Array.isArray(value.notes)?value.notes:[]};
  } catch { return empty(); }
}
export function saveNotesTasks(data: NotesTasksData) {
  localStorage.setItem(NOTES_TASKS_KEY,JSON.stringify(data));
  window.dispatchEvent(new Event("fox-notes-tasks-updated"));
}
export const newId = () => crypto.randomUUID();
export const today = () => new Date().toISOString().slice(0,10);
export const dateLabel = (date: string) => date
  ? new Date(date+"T12:00:00").toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"numeric"})
  : "Без даты";
