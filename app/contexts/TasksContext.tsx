import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { UserInfo, useUser } from './UserContext';

export interface TaskItemData {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location?: string; // Add optional location property
  priority: number; // 1-10 scale, 10 being highest priority
  isTask?: boolean; // Add this to differentiate between events and tasks
}

interface TasksContextType {
  tasks: TaskItemData[];
  isLoading: boolean;
  error: string | null;
  refreshTasks: () => Promise<void>;
  addTask: (task: TaskItemData) => Promise<boolean>;
  updateTask: (task: TaskItemData) => Promise<boolean>;
  deleteTask: (taskId: string) => Promise<boolean>;
  isCalendarLinked: boolean;
}

const TasksContext = createContext<TasksContextType>({
  tasks: [],
  isLoading: false,
  error: null,
  refreshTasks: async () => {},
  addTask: async () => false,
  updateTask: async () => false,
  deleteTask: async () => false,
  isCalendarLinked: false,
});

export function TasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<TaskItemData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { userInfo } = useUser();
  const isCalendarLinked = !!userInfo?.calendarAuth?.access_token;

  // Priority calculation algorithm
  const calculatePriority = (item: any): number => {
    let priority = 5; // Default medium priority

    // Factor 1: Urgency - How soon is the event (within 24 hours gets higher priority)
    const now = new Date();
    const eventStart = new Date(item.start.dateTime);
    const hoursUntilEvent = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilEvent <= 2) priority += 3; // Very soon
    else if (hoursUntilEvent <= 24) priority += 2; // Within a day
    else if (hoursUntilEvent <= 48) priority += 1; // Within 2 days

    // Factor 2: Keywords in title
    const title = item.summary?.toLowerCase() || '';
    const importantKeywords = ['urgent', 'important', 'deadline', 'due', 'exam', 'meeting', 'interview'];

    for (const keyword of importantKeywords) {
      if (title.includes(keyword)) {
        priority += 1;
        break; // Only add 1 point regardless of how many keywords match
      }
    }

    // Factor 3: Duration - Shorter events might be easier to complete
    const duration = (new Date(item.end.dateTime).getTime() - eventStart.getTime()) / (1000 * 60);
    if (duration <= 30) priority += 1; // Short meetings are often important

    // Ensure priority stays within 1-10 range
    return Math.max(1, Math.min(10, priority));
  };

  const fetchCalendarEvents = async (userInfo: UserInfo) => {
    if (!userInfo?.calendarAuth?.access_token) {
      setError("No access token available");
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("Fetching calendar events with token:", userInfo.calendarAuth.access_token.substring(0, 10) + "...");

      const params = {
        timeMin: new Date().toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: "startTime"
      };

      const response = await axios.get("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        headers: {
          Authorization: `Bearer ${userInfo.calendarAuth.access_token}`
        },
        params
      });

      if (!response.data.items || response.data.items.length === 0) {
        console.log("No calendar events found!");
        return [];
      }

      const newTaskList = [];
      const taskItems = response.data.items;
      for (const item of taskItems) {
        // Skip items without dateTime (all-day events)
        if (!item.start.dateTime) {
          continue;
        }

        const newTaskObj: TaskItemData = {
          id: item.id,
          title: item.summary,
          description: item.description || "",
          startTime: item.start.dateTime,
          endTime: item.end.dateTime,
          location: item.location || "",
          priority: calculatePriority(item)
        };
        newTaskList.push(newTaskObj);
      }

      // Sort by priority (highest first)
      newTaskList.sort((a, b) => b.priority - a.priority);

      console.log("Processed task list:", newTaskList);
      return newTaskList;
    } catch (error: any) {
      console.error("Error fetching calendar events:", error);
      setError("Failed to fetch calendar events");

      if (error.response) {
        console.error("Response error data:", error.response.data);
        console.error("Response error status:", error.response.status);
      }
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGoogleTasks = async (userInfo: UserInfo) => {
    if (!userInfo?.calendarAuth?.access_token) {
      return [];
    }

    try {
      const response = await axios.get(
        "https://tasks.googleapis.com/tasks/v1/users/@me/lists",
        {
          headers: {
            Authorization: `Bearer ${userInfo.calendarAuth.access_token}`
          }
        }
      );

      // If no task lists, return empty array
      if (!response.data.items || response.data.items.length === 0) {
        return [];
      }

      // Get the default task list
      const defaultTaskList = response.data.items[0].id;

      // Fetch tasks from the default list
      const tasksResponse = await axios.get(
        `https://tasks.googleapis.com/tasks/v1/lists/${defaultTaskList}/tasks`,
        {
          headers: {
            Authorization: `Bearer ${userInfo.calendarAuth.access_token}`
          },
          params: {
            showCompleted: false,
            showHidden: false
          }
        }
      );

      if (!tasksResponse.data.items) {
        return [];
      }

      // Convert Google Tasks to our TaskItemData format
      const tasksList = tasksResponse.data.items.map((item: any) => {
        let priority = 5; // Default medium priority

        // Fix the date handling for due dates
        let endTime: Date;
        let startTime: Date;

        if (item.due) {
          // Parse the date parts manually to ensure correct local date
          const [year, month, day] = item.due.split('T')[0].split('-').map(Number);

          // Create date at 23:59:59 on the due date in local timezone
          endTime = new Date(year, month - 1, day, 23, 59, 59);

          // Set start time to same day at 9:00 AM as a reasonable default
          startTime = new Date(year, month - 1, day, 9, 0, 0);
        } else {
          // No due date, set defaults
          endTime = new Date(Date.now() + 3600000);
          startTime = new Date(Date.now());
        }

        // Prioritize tasks with due dates
        if (item.due) {
          const now = new Date();
          const hoursUntilDue = (endTime.getTime() - now.getTime()) / (1000 * 60 * 60);

          if (hoursUntilDue <= 24) priority += 2;
          else if (hoursUntilDue <= 48) priority += 1;
        }

        return {
          id: item.id,
          title: item.title,
          description: item.notes || "",
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          priority: priority,
          isTask: true
        } as TaskItemData;
      });

      return tasksList;
    } catch (error: any) {
      console.error("Error fetching Google Tasks:", error);
      return [];
    }
  };

  // Add a new task/event to Google Calendar
  const addTask = async (task: TaskItemData): Promise<boolean> => {
    if (!userInfo?.calendarAuth?.access_token) {
      setError("Google Calendar not connected");
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Handle event creation on Google Calendar
      if (!task.isTask) {
        const event = {
          summary: task.title,
          description: task.description,
          location: task.location,
          start: {
            dateTime: task.startTime,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          },
          end: {
            dateTime: task.endTime,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        };

        const response = await axios.post(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events",
          event,
          {
            headers: {
              Authorization: `Bearer ${userInfo.calendarAuth.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        // Update the task with the actual calendar event ID
        task.id = response.data.id;
      }
      // Handle task creation through Google Tasks API
      else {
        // First, get the default task list
        const listsResponse = await axios.get(
          "https://tasks.googleapis.com/tasks/v1/users/@me/lists",
          {
            headers: {
              Authorization: `Bearer ${userInfo.calendarAuth.access_token}`
            }
          }
        );

        if (!listsResponse.data.items || listsResponse.data.items.length === 0) {
          throw new Error("No task lists found");
        }

        const defaultTaskList = listsResponse.data.items[0].id;

        // Format due date for Google Tasks (ending with 'Z' for UTC)
        const dueDate = new Date(task.endTime);
        const dueDateString = dueDate.toISOString().split('T')[0] + 'T00:00:00Z';

        const taskData = {
          title: task.title,
          notes: task.description,
          due: dueDateString
        };

        const response = await axios.post(
          `https://tasks.googleapis.com/tasks/v1/lists/${defaultTaskList}/tasks`,
          taskData,
          {
            headers: {
              Authorization: `Bearer ${userInfo.calendarAuth.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        // Update the task with the actual Google Task ID
        task.id = response.data.id;
      }

      // Add to local state
      setTasks(prevTasks => {
        const newTasks = [...prevTasks, task].sort((a, b) => b.priority - a.priority);
        return newTasks;
      });

      return true;
    } catch (error: any) {
      console.error("Error adding task:", error);
      setError(`Failed to add ${task.isTask ? 'task' : 'event'}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Update an existing task/event
  const updateTask = async (task: TaskItemData): Promise<boolean> => {
    if (!userInfo?.calendarAuth?.access_token) {
      setError("Google Calendar not connected");
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Handle event update on Google Calendar
      if (!task.isTask) {
        const event = {
          summary: task.title,
          description: task.description,
          location: task.location,
          start: {
            dateTime: task.startTime,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          },
          end: {
            dateTime: task.endTime,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        };

        await axios.put(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${task.id}`,
          event,
          {
            headers: {
              Authorization: `Bearer ${userInfo.calendarAuth.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        );
      }
      // Handle task update through Google Tasks API
      else {
        // First, get the default task list
        const listsResponse = await axios.get(
          "https://tasks.googleapis.com/tasks/v1/users/@me/lists",
          {
            headers: {
              Authorization: `Bearer ${userInfo.calendarAuth.access_token}`
            }
          }
        );

        if (!listsResponse.data.items || listsResponse.data.items.length === 0) {
          throw new Error("No task lists found");
        }

        const defaultTaskList = listsResponse.data.items[0].id;

        // Format due date for Google Tasks (ending with 'Z' for UTC)
        const dueDate = new Date(task.endTime);
        const dueDateString = dueDate.toISOString().split('T')[0] + 'T00:00:00Z';

        const taskData = {
          title: task.title,
          notes: task.description,
          due: dueDateString
        };

        await axios.patch(
          `https://tasks.googleapis.com/tasks/v1/lists/${defaultTaskList}/tasks/${task.id}`,
          taskData,
          {
            headers: {
              Authorization: `Bearer ${userInfo.calendarAuth.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        );
      }

      // Update in local state
      setTasks(prevTasks => {
        const updatedTasks = prevTasks.map(t =>
          t.id === task.id ? task : t
        ).sort((a, b) => b.priority - a.priority);
        return updatedTasks;
      });

      return true;
    } catch (error: any) {
      console.error("Error updating task:", error);
      setError(`Failed to update ${task.isTask ? 'task' : 'event'}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete a task/event
  const deleteTask = async (taskId: string): Promise<boolean> => {
    if (!userInfo?.calendarAuth?.access_token) {
      setError("Google Calendar not connected");
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Find the task in our current state
      const taskToDelete = tasks.find(t => t.id === taskId);

      if (!taskToDelete) {
        throw new Error("Task not found");
      }

      // Delete from appropriate Google API
      if (!taskToDelete.isTask) {
        // Delete event from Google Calendar
        await axios.delete(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${taskId}`,
          {
            headers: {
              Authorization: `Bearer ${userInfo.calendarAuth.access_token}`
            }
          }
        );
      } else {
        // Delete task from Google Tasks
        // First, get the default task list
        const listsResponse = await axios.get(
          "https://tasks.googleapis.com/tasks/v1/users/@me/lists",
          {
            headers: {
              Authorization: `Bearer ${userInfo.calendarAuth.access_token}`
            }
          }
        );

        if (!listsResponse.data.items || listsResponse.data.items.length === 0) {
          throw new Error("No task lists found");
        }

        const defaultTaskList = listsResponse.data.items[0].id;

        await axios.delete(
          `https://tasks.googleapis.com/tasks/v1/lists/${defaultTaskList}/tasks/${taskId}`,
          {
            headers: {
              Authorization: `Bearer ${userInfo.calendarAuth.access_token}`
            }
          }
        );
      }

      // Remove from local state
      setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));

      return true;
    } catch (error: any) {
      console.error("Error deleting task:", error);
      setError("Failed to delete item");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTasks = async () => {
    if (userInfo) {
      setIsLoading(true);
      setError(null);
      try {
        // Get calendar events
        const events = await fetchCalendarEvents(userInfo);

        // Get Google Tasks
        const tasks = await fetchGoogleTasks(userInfo);

        // Combine and sort by priority
        const combinedItems = [...events, ...tasks].sort((a, b) => b.priority - a.priority);

        setTasks(combinedItems);
      } catch (error: any) {
        console.error("Error refreshing tasks:", error);
        setError("Failed to refresh tasks and events");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Initial fetch on mount or when userInfo changes
  useEffect(() => {
    if (userInfo?.calendarAuth?.access_token) {
      refreshTasks();
    }
  }, [userInfo?.calendarAuth?.access_token]);

  return (
    <TasksContext.Provider value={{
      tasks,
      isLoading,
      error,
      refreshTasks,
      addTask,
      updateTask,
      deleteTask,
      isCalendarLinked
    }}>
      {children}
    </TasksContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TasksContext);
  if (!context) {
    throw new Error("useTasks must be used within a TasksProvider");
  }
  return context;
}
