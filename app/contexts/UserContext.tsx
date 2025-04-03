import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface UserInfo {
    username: string;
    email: string;
    usesGoogle: boolean;
    id_token?: string;
    expoPushToken?: string;
    googleAuth?: {
        access_token?: string;
    };
    calendarAuth?: {
        access_token: string;
        refresh_token?: string;
        expires_at?: number; // Add expiration timestamp
    }
};

// Define the type for context
type UserContextType = {
    userInfo: UserInfo | null;
    setUserInfo: (user: UserInfo | null) => void;
    // Add a helper function to update specific properties
    updateUserInfo: (updates: Partial<UserInfo>) => void;
};

const UserContext = createContext<UserContextType>({
    userInfo: null,
    setUserInfo: (user: UserInfo | null) => {},
    updateUserInfo: (updates: Partial<UserInfo>) => {}
});

export function UserProvider({ children }: {children: ReactNode}) {
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

    // Add a helper function to update specific fields without replacing the entire object
    const updateUserInfo = (updates: Partial<UserInfo>) => {
        setUserInfo(prevState => {
            if (!prevState) return updates as UserInfo;
            return { ...prevState, ...updates };
        });
    };

    return (
        <UserContext.Provider value={{ userInfo, setUserInfo, updateUserInfo }}>
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

// Add a helper function for checking if calendar token is expired
export function isCalendarTokenExpired(userInfo: UserInfo | null): boolean {
    if (!userInfo?.calendarAuth?.expires_at) return true;
    return Date.now() > userInfo.calendarAuth.expires_at;
}