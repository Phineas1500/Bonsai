import { View, Text } from 'react-native';
import { DailyActivityLog } from './utils/activityLogging';

export enum ActivityCalendarDayType {
  default, 
  empty,
  label,
}

type Props = {
  log?: DailyActivityLog | null;
  type?: ActivityCalendarDayType;
  label?: string;
};

export default function ActivityCalendarDay({ 
  log = null, 
  type = ActivityCalendarDayType.default, 
  label = '',
}: Props) {

  const getColor = (count : number) => {
    if (type !== ActivityCalendarDayType.default) {

    }

    if (count >= 5) {
      return 'bg-green-800'
    }
    if (count >= 3) {
      return 'bg-green-500'
    }
    if (count >= 1) {
      return 'bg-green-200'
    }
    return 'bg-green-50'
  }

  const content = () => {
    if (type === ActivityCalendarDayType.empty) {
      return (
        <View className={`w-6 h-6 rounded-sm bg-opacity-0`} />
      )
    } else if (type === ActivityCalendarDayType.label) {
      return (
        <View className={`h-6 rounded-sm bg-opacity-0 overflow-visible`}>
          <Text className='text-gray-300 text-sm'>
            {label}
          </Text>
        </View>
      )
    } else {
      //default 
      return (
        <View className={`w-6 h-6 rounded-sm border border-black mt-0.5 ml-0.5 ${getColor(log?.count || 0)}`} />
      )
    }
  }
  
  return (
    <>{content()}</>
  )
}
