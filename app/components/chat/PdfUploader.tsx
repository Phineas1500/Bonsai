import React, { useState, useRef } from 'react';
import { TouchableOpacity, ActivityIndicator, Alert, Modal, View, Text, StyleSheet } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

interface PdfUploaderProps {
  onPdfSelected: (text: string, filename: string) => void;
  disabled?: boolean;
}

const PdfUploader = ({ onPdfSelected, disabled }: PdfUploaderProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const extractPdfTextWithClaude = async (uri: string): Promise<string> => {
    try {
      // Read the PDF file as base64
      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      // Get the Anthropic API key from environment variables
      const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
      if (!ANTHROPIC_API_KEY) {
        throw new Error('Anthropic API key is not defined');
      }
      
      console.log("Sending request to Claude API...");
      
      // Prepare the request to Anthropic's API with correct format
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: "claude-3-5-sonnet-20240620",
          max_tokens: 4000,
          system: "You are a helpful assistant that extracts text from PDFs. Return ONLY the extracted text with no additional commentary. Focus on identifying and extracting any calendar events, including dates, times, locations, and event details.",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract all text from this PDF, preserving the structure and formatting as best you can. Include all dates, times, locations, and event details."
                },
                {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: base64Data
                  }
                }
              ]
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          }
        }
      );
      
      console.log("Response received from Claude API");
      
      // Extract the text from the response
      const extractedText = response.data.content[0].text;
      return extractedText;
    } catch (error: any) {
      console.error("Error extracting PDF text with Claude:", error);
      
      // More detailed error logging
      if (error.response) {
        console.error("Response error data:", error.response.data);
        console.error("Response error status:", error.response.status);
      }
      
      return `Error extracting text from PDF: ${error.message}`;
    }
  };

  const processImage = async (uri: string, filename: string): Promise<void> => {
    try {
      // Read the image file as base64
      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      // Get the Anthropic API key from environment variables
      const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
      if (!ANTHROPIC_API_KEY) {
        throw new Error('Anthropic API key is not defined');
      }
      
      console.log("Sending image request to Claude API...");

      // Determine media type based on file extension
      const fileExt = filename.split('.').pop()?.toLowerCase();
      let mediaType = 'image/jpeg'; // Default
      if (fileExt === 'png') {
        mediaType = 'image/png';
      } else if (fileExt === 'gif') {
        mediaType = 'image/gif';
      }
      
      // Prepare the request to Anthropic's API for image analysis
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: "claude-3-5-sonnet-20240620",
          max_tokens: 4000,
          system: "You are a helpful assistant that analyzes images. For images that contain text, extract all visible text, particularly focusing on dates, times, locations, and event details. For other images, provide a brief description of their content.",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Please analyze this image and extract any text content or relevant information, especially any calendar events, schedules, or important details."
                },
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mediaType,
                    data: base64Data
                  }
                }
              ]
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          }
        }
      );
      
      console.log("Response received from Claude API for image");
      
      // Extract the text from the response
      const extractedText = response.data.content[0].text;
      onPdfSelected(extractedText, filename);
    } catch (error: any) {
      console.error("Error processing image with Claude:", error);
      Alert.alert("Error", `Failed to process image: ${error.message}`);
    }
  };

  const pickDocument = async () => {
    if (disabled || isLoading) return;
    
    try {
      setIsLoading(true);
      
      // Check if API key exists
      const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
      if (!ANTHROPIC_API_KEY) {
        Alert.alert(
          "Configuration Error",
          "Anthropic API key is not set. Please check your environment configuration."
        );
        setIsLoading(false);
        return;
      }
      
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

      // Check file size - Anthropic has a 10MB limit for file attachments
      const fileInfo = await FileSystem.getInfoAsync(uri);
      
      // Check if file exists and has size info before checking the size
      if (fileInfo.exists) {
        // Need to type cast since TypeScript doesn't recognize the size property
        // on the exists=true variant of the FileInfo type
        const fileInfoWithSize = fileInfo as FileSystem.FileInfo & { size: number };
        
        if (fileInfoWithSize.size > 10 * 1024 * 1024) {
          Alert.alert(
            "File Too Large",
            "The selected PDF exceeds 10MB, which is the maximum size supported by Claude. Please select a smaller file."
          );
          setIsLoading(false);
          return;
        }
      }

      // Extract text from the PDF using Claude
      const pdfText = await extractPdfTextWithClaude(uri);
      
      // Pass the extracted text to the parent component
      onPdfSelected(pdfText, name);
      
    } catch (error: any) {
      console.error("Error processing document:", error);
      Alert.alert(
        "Error",
        `There was a problem processing your document: ${error.message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async () => {
    if (disabled || isLoading) return;
    
    try {
      setIsLoading(true);
      
      // Check if API key exists
      const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
      if (!ANTHROPIC_API_KEY) {
        Alert.alert(
          "Configuration Error",
          "Anthropic API key is not set. Please check your environment configuration."
        );
        setIsLoading(false);
        return;
      }

      // Get permission for image library if needed
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert("Permission Required", "Please grant access to your photo library to upload images.");
        setIsLoading(false);
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setIsLoading(false);
        return;
      }

      const asset = result.assets[0];
      const { uri } = asset;
      const filename = uri.split('/').pop() || 'image.jpg';

      if (!uri) {
        console.error("No URI found for selected image");
        setIsLoading(false);
        return;
      }

      // Check file size - Claude has a limit for images
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (fileInfo.exists) {
        const fileInfoWithSize = fileInfo as FileSystem.FileInfo & { size: number };
        
        if (fileInfoWithSize.size > 5 * 1024 * 1024) {
          Alert.alert(
            "File Too Large",
            "The selected image exceeds 5MB. Please select a smaller image."
          );
          setIsLoading(false);
          return;
        }
      }

      // Process the image
      await processImage(uri, filename);
      
    } catch (error: any) {
      console.error("Error processing image:", error);
      Alert.alert(
        "Error",
        `There was a problem processing your image: ${error.message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <TouchableOpacity 
        onPress={() => setShowOptions(true)}
        disabled={disabled || isLoading}
        className={`p-2 ${disabled ? 'opacity-50' : ''}`}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#14b8a6" />
        ) : (
          <Ionicons name="add-circle-outline" size={20} color="#14b8a6" />
        )}
      </TouchableOpacity>

      <Modal
        visible={showOptions}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOptions(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowOptions(false)}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.optionButton}
              onPress={() => {
                setShowOptions(false);
                setTimeout(() => pickDocument(), 300);
              }}
            >
              <Ionicons name="document-outline" size={24} color="#14b8a6" />
              <Text style={styles.optionText}>Upload document</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.optionButton}
              onPress={() => {
                setShowOptions(false);
                setTimeout(() => pickImage(), 300);
              }}
            >
              <Ionicons name="image-outline" size={24} color="#14b8a6" />
              <Text style={styles.optionText}>Upload image</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.optionButton, styles.cancelButton]}
              onPress={() => setShowOptions(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 20,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 10,
  },
  optionText: {
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 12,
  },
  cancelButton: {
    backgroundColor: '#2c2c2e',
    justifyContent: 'center',
    marginTop: 10,
  },
  cancelText: {
    color: '#ff375f',
    fontSize: 16,
    textAlign: 'center',
  }
});

export default PdfUploader;