import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface UserInfo {
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
};

// Define the type for context
type UserContextType = {
    userInfo: UserInfo | null;
    setUserInfo: (user: UserInfo) => void;
};

const UserContext = createContext<UserContextType>({
    userInfo: null,
    setUserInfo: (user: UserInfo | null) => {}
});

export function UserProvider({ children }: {children: ReactNode}) {
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

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