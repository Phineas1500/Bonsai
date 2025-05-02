import { db } from 'firebaseConfig';
import { collection, doc, getDoc, getDocs, increment, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";

export interface DailyActivityLog {
    date : string;
    count : number;
}

/**
 * Given a time range denoted by a startDate and endDate, returns a list 
 * of DailyActivityLog objects that represent the activity for the specified 
 * user on the days within that range inclusive. An emtpy log object will be created for 
 * every date in that range even if there was no activity.
 * 
 * @param email the email of the user to get activity data for
 * @param startDate the start date
 * @param endDate  the end date
 * @returns a list of DailyActivityLog objects
 */
export const getActivityHistory = async (email : string, startDate: Date, endDate : Date) : Promise<DailyActivityLog[]> => {
    try {
        const logsRef = collection(db, "activityHistory", email, "dailyLogs");

        const startDateStr = startDate.toISOString().slice(0, 10);
        const endDateStr = endDate.toISOString().slice(0, 10);

        const q = query(
            logsRef,
            where('__name__', '>=', startDateStr),
            where('__name__', '<=', endDateStr),
            orderBy('__name__')
        );

        //get snapshot array of log documents, ordered by date
        const docsListSnapshot = (await getDocs(q)).docs;

        //iterate over all the dates in the range, filling in empty ones
        let logIdx = 0;
        const currDate = new Date(startDate);
        const ret : DailyActivityLog[] = [];

        while (currDate <= endDate) {
            const currDateStr = currDate.toISOString().slice(0, 10); // UTC date string like '2025-05-01'
            let matched = false;

            // if there are no more logs from the database, then make a new one for this date
            if (logIdx < docsListSnapshot.length) {
                //check if there is already a log for this date
                const currLog = docsListSnapshot[logIdx].data() as DailyActivityLog;

                if (currDateStr == currLog.date) {
                    matched = true;
                    ret.push({
                        ...currLog,
                        date: currLog.date
                    });
                    logIdx++;
                }
            }
            // if there is no matching log for this date, then make a new one
            if (!matched) {
                ret.push({
                    date: currDateStr,
                    count: 0
                });
            }
            //go to the next date
            currDate.setUTCDate(currDate.getUTCDate() + 1);
        }
        return ret;
    } catch (error: any) {
        console.error(error);
        return [];
    }
}

export const logActivityForToday = async (email : string) => {
    try {
        // something like '2025-05-01' for date. Only need precision to day
        const utcDate = new Date().toISOString().slice(0, 10); 

        const docRef = doc(db, "activityHistory", email, "dailyLogs", utcDate);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // update the counter for today's activity 
            await updateDoc(docRef, { count: increment(1) });
        } else {
            // create document for today with count of 1
            const newLog : DailyActivityLog = {
                date: utcDate,
                count: 1
            };
            await setDoc(docRef, newLog);
        }
    } catch (error: any) {
        console.error(error);
    }
}