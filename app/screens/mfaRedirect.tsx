import { View, Text, Image, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import GradientButton from '@components/GradientButton';
import GradientText from '@components/GradientText';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { getUserByEmail } from '@components/utils/userManagement';
import { useUser } from '@contexts/UserContext';
import TextInput from '@components/TextInput';
import { ConfirmationResult, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { NotificationPayload, sendPushNotification } from '../components/utils/notificationAPI';


export default function MFARedirect() {

  const router = useRouter();
  const { updateUserInfo } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  const hasSentCode = useRef(false);
  const confirmationCode = useRef<string | null>(null);
  const { userInfo } = useUser();

  useEffect(() => {
    if (hasSentCode.current) return;
    hasSentCode.current = true;
    
    if (!userInfo?.phoneNumber || userInfo.phoneNumber == '') {
      router.push('/screens/authcallback');
      return;
    }
    send2FACode(userInfo.email);
  }, []);

  const send2FACode = async (email : string) => {
    try {
      //generate a random 2fa code
      const code = Math.floor(100000 + Math.random() * 900000);
      confirmationCode.current = code.toString();

      //send notification to the user
      const notif : NotificationPayload = {
        email: email,
        title: "2FA Verification Code",
        body: code.toString(),
        data: {}
      }
      sendPushNotification(notif);
      
    } catch (error: any) {
      console.error("Error sending 2FA code:", error);
      setError('Error sending 2FA code.');
    }
  }

  const handleSubmit = async () => {
    if (!confirmationCode.current) {
      setError("No confirmation result found.");
      return;
    }

    if (mfaCode === confirmationCode.current) {
      console.log('2FA verified');
      router.push('/screens/chat');
    } else {
      setError("Incorrect 2FA code.")
    }
  }

  return (
    <View className="flex-1 justify-center items-center bg-stone-950 p-6">
      <View className="w-full max-w-sm items-center">
        <Text className="text-4xl font-semibold text-teal-500 text-center mb-2">
          Enter 2FA Code
        </Text>
        <Text className="text-sm font-semibold text-white text-center mb-4">
          For added security, a verification code has been sent to your phone. Enter it here to log in.
        </Text>

        <TextInput
            value={mfaCode}
            onChangeText={setMfaCode}
            placeholder="Enter 2FA code"
            classStyle='mb-4 text-base'
        />
        <GradientButton
          text='Submit'
          onPress={handleSubmit}
          containerClassName="mt-8"
          textClassName='text-white text-lg'
        />
        {error && (
        <Text className="text-red-500 text-sm mt-2">{error}</Text>
        )}
        
      </View>
    </View>
  );
}
