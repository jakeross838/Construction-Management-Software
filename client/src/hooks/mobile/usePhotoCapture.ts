/**
 * Photo Capture Hook for Mobile PWA
 * Phase 1.1c: Photo capture with location and AI tagging
 */

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from './useGeolocation';
import { apiFetch } from '@/lib/api';

export type PhotoCategory = 'progress' | 'issue' | 'safety' | 'material' | 'before_after' | 'other';

interface CapturedPhoto {
  file: File;
  preview: string;
  latitude: number | null;
  longitude: number | null;
  timestamp: Date;
}

interface UploadedPhoto {
  id: string;
  job_id: string;
  file_url: string;
  file_name: string;
  caption: string | null;
  location: string | null;
  category: string;
  taken_at: string | null;
  latitude: number | null;
  longitude: number | null;
  job?: { id: string; name: string };
}

interface UsePhotoCaptureReturn {
  capturedPhotos: CapturedPhoto[];
  uploading: boolean;
  uploadProgress: number;
  error: string | null;
  capturePhoto: (file: File) => Promise<CapturedPhoto | null>;
  removePhoto: (index: number) => void;
  clearPhotos: () => void;
  uploadPhoto: (
    photo: CapturedPhoto,
    jobId: string,
    options?: {
      caption?: string;
      location?: string;
      category?: PhotoCategory;
    }
  ) => Promise<UploadedPhoto | null>;
  uploadAllPhotos: (
    jobId: string,
    options?: {
      caption?: string;
      location?: string;
      category?: PhotoCategory;
    }
  ) => Promise<UploadedPhoto[]>;
  openCamera: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
}

const API_BASE = '/api/photos';

export function usePhotoCapture(): UsePhotoCaptureReturn {
  const { user } = useAuth();
  const { latitude, longitude, getCurrentPosition } = useGeolocation();
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Capture a photo from file input
  const capturePhoto = useCallback(async (file: File): Promise<CapturedPhoto | null> => {
    try {
      setError(null);

      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
      if (!validTypes.includes(file.type)) {
        setError('Invalid file type. Please use JPEG, PNG, or WebP images.');
        return null;
      }

      // Validate file size (25MB max)
      if (file.size > 25 * 1024 * 1024) {
        setError('File too large. Maximum size is 25MB.');
        return null;
      }

      // Get current location
      await getCurrentPosition();

      // Create preview
      const preview = URL.createObjectURL(file);

      const capturedPhoto: CapturedPhoto = {
        file,
        preview,
        latitude,
        longitude,
        timestamp: new Date(),
      };

      setCapturedPhotos(prev => [...prev, capturedPhoto]);
      return capturedPhoto;
    } catch (err) {
      console.error('Error capturing photo:', err);
      setError(err instanceof Error ? err.message : 'Failed to capture photo');
      return null;
    }
  }, [latitude, longitude, getCurrentPosition]);

  // Remove a photo from the list
  const removePhoto = useCallback((index: number) => {
    setCapturedPhotos(prev => {
      const newPhotos = [...prev];
      // Revoke the preview URL to free memory
      if (newPhotos[index]?.preview) {
        URL.revokeObjectURL(newPhotos[index].preview);
      }
      newPhotos.splice(index, 1);
      return newPhotos;
    });
  }, []);

  // Clear all photos
  const clearPhotos = useCallback(() => {
    // Revoke all preview URLs
    capturedPhotos.forEach(photo => {
      if (photo.preview) {
        URL.revokeObjectURL(photo.preview);
      }
    });
    setCapturedPhotos([]);
    setUploadProgress(0);
  }, [capturedPhotos]);

  // Upload a single photo
  const uploadPhoto = useCallback(async (
    photo: CapturedPhoto,
    jobId: string,
    options?: {
      caption?: string;
      location?: string;
      category?: PhotoCategory;
    }
  ): Promise<UploadedPhoto | null> => {
    try {
      setError(null);

      const formData = new FormData();
      formData.append('file', photo.file);
      formData.append('job_id', jobId);

      if (options?.caption) formData.append('caption', options.caption);
      if (options?.location) formData.append('location', options.location);
      if (options?.category) formData.append('category', options.category);
      if (photo.latitude) formData.append('latitude', photo.latitude.toString());
      if (photo.longitude) formData.append('longitude', photo.longitude.toString());
      formData.append('taken_at', photo.timestamp.toISOString());
      formData.append('uploaded_by', user?.email || 'mobile_user');

      // Use apiFetch for FormData - don't set Content-Type, browser will set it with boundary
      const response = await apiFetch(API_BASE, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.message || 'Failed to upload photo');
      }

      const uploadedPhoto = await response.json();
      return uploadedPhoto;
    } catch (err) {
      console.error('Error uploading photo:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload photo');
      return null;
    }
  }, [user?.email]);

  // Upload all captured photos
  const uploadAllPhotos = useCallback(async (
    jobId: string,
    options?: {
      caption?: string;
      location?: string;
      category?: PhotoCategory;
    }
  ): Promise<UploadedPhoto[]> => {
    if (capturedPhotos.length === 0) return [];

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    const uploadedPhotos: UploadedPhoto[] = [];
    const totalPhotos = capturedPhotos.length;

    for (let i = 0; i < totalPhotos; i++) {
      const photo = capturedPhotos[i];
      const uploaded = await uploadPhoto(photo, jobId, options);

      if (uploaded) {
        uploadedPhotos.push(uploaded);
      }

      setUploadProgress(Math.round(((i + 1) / totalPhotos) * 100));
    }

    setUploading(false);

    // Clear successfully uploaded photos
    if (uploadedPhotos.length === totalPhotos) {
      clearPhotos();
    }

    return uploadedPhotos;
  }, [capturedPhotos, uploadPhoto, clearPhotos]);

  // Open camera input
  const openCamera = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return {
    capturedPhotos,
    uploading,
    uploadProgress,
    error,
    capturePhoto,
    removePhoto,
    clearPhotos,
    uploadPhoto,
    uploadAllPhotos,
    openCamera,
    inputRef,
  };
}

export default usePhotoCapture;
