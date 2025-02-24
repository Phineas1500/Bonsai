import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

type UserInfo = {
    username: string;
    email: string;
    usesGoogle: boolean;
    id_token?: string;
    googleAuth?: {
        access_token?: string;
    };
    calendarAuth?: {
        access_token:string;
        refresh_token:string;
    }
} | null;

// Define the type for context
type UserContextType = {
    userInfo: UserInfo;
    setUserInfo: (user: UserInfo) => void;
};

const UserContext = createContext<UserContextType>({
    userInfo: null,
    setUserInfo: () => {}
});

export function UserProvider({ children }: {children: ReactNode}) {
    const [userInfo, setUserInfo] = useState<UserInfo>(null);

    useEffect(() => {
        console.log(userInfo);
    }, [userInfo]);

    return (
        <UserContext.Provider value={{ userInfo, setUserInfo }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return context;
}