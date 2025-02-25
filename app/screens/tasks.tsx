import { View, Text, ScrollView } from 'react-native';
import { useEffect, useState } from 'react';
import GradientButton from '@components/GradientButton';
import Navbar from '../components/Navbar';
import { UserInfo, useUser } from '../contexts/UserContext';
import axios from "axios";
import TaskListItem from '../components/TaskListItem';

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

  const fetchCalendarEvents = async (userInfo: UserInfo) => {

    console.log("USER INFO: ", userInfo);
    if (!userInfo?.calendarAuth?.access_token) {
      console.error("No access token available");
      return;
    }

    try {
      const response = await axios.get("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        headers: {
          Authorization: `Bearer ${userInfo.calendarAuth.access_token}`
        },
        params: {
          timeMin: new Date().toISOString(),
          maxResults: 10,
          singleEvents: true,
          orderBy: "startTime"
        }
      });

      //extract relavent data from response object
      const newTaskList = [];
      const taskItems = response.data.items;
      for (const item of taskItems) {
        const newTaskObj: TaskItemData = {
          id: item.id,
          title: item.summary,
          description: item.description || "",
          startTime: item.start.dateTime,
          endTime: item.end.dateTime
        }
        newTaskList.push(newTaskObj);
      }
      setTaskData(newTaskList);

    } catch (error) {
      console.error("Error fetching calendar events:", error);
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