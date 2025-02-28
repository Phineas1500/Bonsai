import React, { useState } from 'react';
import { TouchableOpacity, View, Text, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';

interface PdfUploaderProps {
  onPdfSelected: (text: string, filename: string) => void;
  disabled?: boolean;
}

const PdfUploader = ({ onPdfSelected, disabled }: PdfUploaderProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const pickDocument = async () => {
    try {
      setIsLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setIsLoading(false);
        return;
      }

      const asset = result.assets[0];
      const { uri, name } = asset;

      if (!uri) {
        console.error("No URI found for selected document");
        setIsLoading(false);
        return;
      }

      // For now, we'll just use the filename as a placeholder
      // In a real app, you would want to extract text from the PDF
      // This requires additional libraries or services
      const pdfText = `PDF Content: ${name}\n\nPlease process this PDF document and extract any calendar events or important information.`;
      
      onPdfSelected(pdfText, name);
      
    } catch (error) {
      console.error("Error picking document:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableOpacity 
      onPress={pickDocument}
      disabled={disabled || isLoading}
      className={`p-2 ${disabled ? 'opacity-50' : ''}`}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#14b8a6" />
      ) : (
        <Ionicons name="document-attach" size={20} color="#14b8a6" />
      )}
    </TouchableOpacity>
  );
};

export default PdfUploader;