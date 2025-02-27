import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { UserInfo, useUser } from './UserContext';

export interface TaskItemData {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
}

interface TasksContextType {
  tasks: TaskItemData[];
  isLoading: boolean;
  error: string | null;
  refreshTasks: () => Promise<void>;
}

const TasksContext = createContext<TasksContextType>({
  tasks: [],
  isLoading: false,
  error: null,
  refreshTasks: async () => {}
});

export function TasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<TaskItemData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { userInfo } = useUser();

  const fetchCalendarEvents = async (userInfo: UserInfo) => {
    if (!userInfo?.calendarAuth?.access_token) {
      setError("No access token available");
      return;
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
        setTasks([]);
        setIsLoading(false);
        return;
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
          endTime: item.end.dateTime
        };
        newTaskList.push(newTaskObj);
      }

      console.log("Processed task list:", newTaskList);
      setTasks(newTaskList);
    } catch (error: any) {
      console.error("Error fetching calendar events:", error);
      setError("Failed to fetch calendar events");

      if (error.response) {
        console.error("Response error data:", error.response.data);
        console.error("Response error status:", error.response.status);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTasks = async () => {
    if (userInfo) {
      await fetchCalendarEvents(userInfo);
    }
  };

  // Initial fetch on mount or when userInfo changes
  useEffect(() => {
    if (userInfo?.calendarAuth?.access_token) {
      fetchCalendarEvents(userInfo);
    }
  }, [userInfo?.calendarAuth?.access_token]);

  return (
    <TasksContext.Provider value={{ tasks, isLoading, error, refreshTasks }}>
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
