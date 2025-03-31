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
        // Calculate priority for tasks (you might want to adjust this)
        let priority = 5; // Default medium priority
        
        // Set due date as end time, or use current time + 1 hour if not specified
        const endTime = item.due ? new Date(item.due) : new Date(Date.now() + 3600000);
        // Set start time to same day but 1 hour before due time
        const startTime = new Date(endTime.getTime() - 3600000);
        
        // Prioritize tasks with due dates
        if (item.due) {
          const dueDate = new Date(item.due);
          const now = new Date();
          const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
          
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
