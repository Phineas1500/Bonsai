import { View, Text, ScrollView } from 'react-native';
import { useEffect, useState } from 'react';
import GradientButton from '@components/GradientButton';
import Navbar from '@components/Navbar';
import { UserInfo, useUser } from '@contexts/UserContext';
import axios from "axios";
import TaskListItem from '@components/TaskListItem';
import React from 'react';

export interface TaskItemData {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
}

export default function Tasks() {

  const { userInfo, setUserInfo } = useUser();

  const [taskData, setTaskData] = useState<TaskItemData[]>([]);

  //fetch tasks from google calendar on page load
  useEffect(() => {
    if (userInfo) {
      fetchCalendarEvents(userInfo);
    }
  }, [])

  // In your fetchCalendarEvents function
  const fetchCalendarEvents = async (userInfo: UserInfo) => {
    console.log("USER INFO: ", userInfo);
    if (!userInfo?.calendarAuth?.access_token) {
      console.error("No access token available");
      return;
    }

    try {
      console.log("Fetching calendar events with token:", userInfo.calendarAuth.access_token.substring(0, 10) + "...");

      // Log the parameters we're using
      const params = {
        timeMin: new Date().toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: "startTime"
      };
      console.log("Request parameters:", params);

      const response = await axios.get("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        headers: {
          Authorization: `Bearer ${userInfo.calendarAuth.access_token}`
        },
        params
      });

      // Log the raw response
      console.log("Calendar API Response status:", response.status);
      console.log("Calendar API Response data:", response.data);

      if (!response.data.items || response.data.items.length === 0) {
        console.log("No calendar events found!");
        return;
      }

      //extract relevant data from response object
      const newTaskList = [];
      const taskItems = response.data.items;
      for (const item of taskItems) {
        console.log("Processing item:", item);

        // Skip items without dateTime (all-day events)
        if (!item.start.dateTime) {
          console.log("Skipping item without dateTime:", item.summary);
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
      setTaskData(newTaskList);
    } catch (error: any) {
      console.error("Error fetching calendar events:", error);

      // More detailed error logging
      if (error.response) {
        // The request was made and the server responded with a status code
        console.error("Response error data:", error.response.data);
        console.error("Response error status:", error.response.status);
        console.error("Response error headers:", error.response.headers);
      } else if (error.request) {
        // The request was made but no response was received
        console.error("Request error:", error.request);
      } else {
        // Something happened in setting up the request
        console.error("Error message:", error.message);
      }
    }
  };

  const taskComponents = () => {
    const components = taskData.map((taskItem: TaskItemData) => {
      console.log(taskItem);
      return <TaskListItem key={taskItem.id} itemData={taskItem} />
    });
    console.log("Componenets:", components);
    return components;
  }

  return (

    //fetch tasks from google calendar
    <>
      <Navbar />
      <View className="flex-1 flex-col items-start bg-stone-950 p-6">
        <Text className="text-2xl font-light text-teal-500 text-center">
          Tasks:
        </Text>
        <ScrollView>
          {taskComponents()}
        </ScrollView>
      </View>
    </>
  );
}