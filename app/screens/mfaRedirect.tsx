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


export default function MFARedirect() {

  const router = useRouter();
  const { updateUserInfo } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  const hasSentCode = useRef(false);
  const confirmationResult = useRef<ConfirmationResult | null>(null);
  const { userInfo } = useUser();

  useEffect(() => {
    if (hasSentCode.current) return;
    hasSentCode.current = true;

    
    if (!userInfo?.phoneNumber || userInfo.phoneNumber == '') {
      router.push('/screens/authcallback');
      return;
    }
    send2FACode(userInfo.phoneNumber);
  }, []);

  const send2FACode = async (phoneNumber : string) => {
    try {
      console.log(phoneNumber);
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber);
      confirmationResult.current = confirmation;
      console.log("2fa code sent");
    } catch (error: any) {
      console.error("Error sending 2FA code:", error);
      setError('Error sending 2FA code.');
    }
  }

  const handleSubmit = async () => {
    if (!confirmationResult.current) {
      setError("No confirmation result found.");
      return;
    }
    try {
      await confirmationResult.current.confirm(mfaCode);
      console.log('2FA verified');
      router.push('/screens/chat');
    } catch (error) {
      console.log('Error verifying 2FA code:', error);
      setError('Invalid 2FA code.');
    }
  }


  return (
    <View className="flex-1 justify-center items-center bg-stone-950 p-6">
      <View className="w-full max-w-sm items-center">
        <Text className="text-sm font-light text-teal-500 text-center">
          Enter 2FA Code
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
