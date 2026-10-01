export type ColumnId = 'backlog' | 'in-progress' | 'in-review' | 'done';

export type Priority = 'High' | 'Medium' | 'Low';

export interface CardData {
  id: string;
  title: string;
  description: string;
  assignee: string;
  priority: Priority;
  dueDate: string;
  status: ColumnId;
}

export interface Column {
  id: ColumnId;
  title: string;
}

export const COLUMNS: Column[] = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'in-review', title: 'In Review' },
  { id: 'done', title: 'Done' },
];

export const PRIORITIES: Priority[] = ['High', 'Medium', 'Low'];
