"use client";

import React, { useState, useRef } from 'react';
import { UploadCloud } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import styles from './UploadZone.module.css';

export const UploadZone = () => {
  const { handleFileUpload } = useDashboard();
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  return (
    <div className={styles.container}>
      <div 
        className={`${styles.dropzone} ${dragActive ? styles.dragActive : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <UploadCloud size={64} className={styles.icon} />
        <h2 className={styles.title}>Drop your Excel file here</h2>
        <p className={styles.subtitle}>or click to select a file</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx, .xls, .csv"
          className={styles.fileInput}
          onChange={handleChange}
        />
      </div>
    </div>
  );
};
