/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PolaroidCard from './components/PolaroidCard';
import { createAlbumPage, resizeImage, dataURLtoBlob } from './lib/albumUtils';
import Footer from './components/Footer';
import { DraggableCardBody, DraggableCardContainer } from './components/ui/draggable-card';
import MusicPlayer from './components/MusicPlayer';
import { generateTimelineImage } from './services/geminiService';
import pako from 'pako';

type PhotoStatus = 'idle' | 'pending' | 'done' | 'error' | 'uploading';
type CloudSaveStatus = 'idle' | 'saving' | 'success' | 'error';


export interface Photo {
    id: string;
    imageUrl: string; // This will be the Vercel Blob URL
    date: string;
    message: string;
    status: PhotoStatus;
    generatedUrl?: string; // This will also be a Vercel Blob URL
    error?: string;
    localDataUrl?: string; // Temporary URL for immediate display while uploading
}

const primaryButtonClasses = "font-permanent-marker text-xl text-center text-black bg-yellow-400 py-3 px-8 rounded-sm transform transition-transform duration-200 hover:scale-105 hover:-rotate-2 hover:bg-yellow-300 shadow-[2px_2px_0px_2px_rgba(0,0,0,0.2)]";
const secondaryButtonClasses = "font-permanent-marker text-xl text-center text-white bg-white/10 backdrop-blur-sm border-2 border-white/80 py-3 px-8 rounded-sm transform transition-transform duration-200 hover:scale-105 hover:rotate-2 hover:bg-white hover:text-black";
const UPLOAD_PHOTO_ID = 'upload-photo';

async function uploadImageToCloud(dataUrl: string): Promise<string> {
    const blob = dataURLtoBlob(dataUrl);
    const response = await fetch('/api/upload-image', {
        method: 'POST',
        headers: {
            'Content-Type': blob.type,
        },
        body: blob,
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Image upload failed: ${errorText}`);
    }
    const { url } = await response.json();
    return url;
}


function App() {
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle');
    const [cloudSaveState, setCloudSaveState] = useState<{ status: CloudSaveStatus; url?: string; error?: string }>({ status: 'idle' });
    const dragAreaRef = useRef<HTMLElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load from URL on initial mount
    useEffect(() => {
        const loadTimeline = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const loadFromUrl = urlParams.get('load_from_url');
            const data = urlParams.get('data');

            if (loadFromUrl) {
                try {
                    const response = await fetch(loadFromUrl);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch timeline: ${response.status} ${response.statusText}`);
                    }
                    const parsedPhotos: Photo[] = await response.json();
                     if (Array.isArray(parsedPhotos) && (parsedPhotos.length === 0 || parsedPhotos.every(p => p.id && p.imageUrl))) {
                        setPhotos(parsedPhotos);
                    } else {
                        throw new Error("Invalid timeline data format from cloud URL.");
                    }
                } catch (error) {
                    console.error("Failed to load timeline from cloud URL:", error);
                    alert("Could not load the timeline from the provided link. The URL might be incorrect or the data corrupted.");
                }
            } else if (data) {
                try {
                    const decodedBinaryString = atob(data);
                    const uint8array = Uint8Array.from(decodedBinaryString, c => c.charCodeAt(0));
                    const decompressed = pako.inflate(uint8array, { to: 'string' });
                    const parsedPhotos: Photo[] = JSON.parse(decompressed);
                    setPhotos(parsedPhotos);
                } catch (error) {
                    console.error("Failed to parse data from URL:", error);
                    alert("Could not load the timeline from the shared link. The data might be corrupted.");
                }
            }
        };

        loadTimeline();
    }, []);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        let loadedTimeline = false;

        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        const jsonFiles = Array.from(files).filter(file => file.type === 'application/json');

        // Prioritize loading a timeline if a JSON file is present
        if (jsonFiles.length > 0) {
            const file = jsonFiles[0];
            try {
                const text = await file.text();
                const parsedJson = JSON.parse(text);
                // Fix: Loosely type photos loaded from JSON to handle legacy `dataUrl` property.
                let photosToLoad: any[] = [];

                if (Array.isArray(parsedJson.photos)) {
                    photosToLoad = parsedJson.photos;
                } else if (Array.isArray(parsedJson)) {
                    photosToLoad = parsedJson;
                } else {
                    throw new Error("JSON file is not in a recognized timeline format.");
                }

                if (photosToLoad.every(p => p.id && (p.imageUrl || p.dataUrl))) { // Check for either URL
                     // Migrate old dataUrl format to new imageUrl
                    const migratedPhotos = photosToLoad.map(p => ({ ...p, imageUrl: p.imageUrl || p.dataUrl || '' }));
                    setPhotos(migratedPhotos);
                    loadedTimeline = true;
                    alert(`Successfully loaded timeline from ${file.name}`);
                } else {
                    throw new Error("Invalid photo data within timeline file.");
                }
            } catch (error) {
                console.error("Error reading or parsing JSON file:", error);
                alert(`Could not load the timeline from ${file.name}. The file might be corrupted or in the wrong format.`);
            }
        }
        
        // If a timeline wasn't loaded, process any image files
        if (!loadedTimeline && imageFiles.length > 0) {
            for (const file of imageFiles) {
                const tempId = `${Date.now()}-${Math.random()}`;
                try {
                    const dataUrl = await resizeImage(file, 1024);
                    // Add to state immediately for responsiveness
                    const newPhoto: Photo = {
                        id: tempId,
                        imageUrl: '', // Will be filled after upload
                        localDataUrl: dataUrl,
                        date: '',
                        message: '',
                        status: 'uploading',
                    };
                    setPhotos(prev => [...prev, newPhoto]);

                    // Start the upload
                    uploadImageToCloud(dataUrl).then(cloudUrl => {
                        setPhotos(prev => prev.map(p => p.id === tempId ? { ...p, imageUrl: cloudUrl, status: 'idle', localDataUrl: undefined } : p));
                    }).catch(uploadError => {
                         console.error("Image upload failed:", uploadError);
                         setPhotos(prev => prev.map(p => p.id === tempId ? { ...p, status: 'error', error: 'Upload failed.' } : p));
                    });
                } catch (error) {
                    console.error("Error processing file:", error);
                    alert(`Could not process ${file.name}.`);
                }
            }
        }
    };

    const handleUpdatePhoto = (id: string, updates: Partial<Pick<Photo, 'date' | 'message'>>) => {
        setPhotos(prevPhotos =>
            prevPhotos.map(p => (p.id === id ? { ...p, ...updates } : p))
        );
    };

    const handleDeletePhoto = (id: string) => {
        setPhotos(photos.filter(p => p.id !== id));
    };
    
    const handleGenerateImage = async (id: string) => {
        const photo = photos.find(p => p.id === id);
        if (!photo || !photo.imageUrl) return;
        
        setPhotos(prev => prev.map(p => p.id === id ? { ...p, status: 'pending' } : p));
        try {
            // Step 1: Generate the image with AI, which returns a data URL
            const generatedDataUrl = await generateTimelineImage(photo.imageUrl, photo.message);
            
            // Step 2: Upload the new image to cloud storage
            const generatedCloudUrl = await uploadImageToCloud(generatedDataUrl);

            // Step 3: Update the state with the final cloud URL
            setPhotos(prev => prev.map(p => p.id === id ? { ...p, status: 'done', generatedUrl: generatedCloudUrl } : p));
        } catch (error) {
            console.error("Image generation or upload failed:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            setPhotos(prev => prev.map(p => p.id === id ? { ...p, status: 'error', error: errorMessage } : p));
        }
    };
    
    const handleExportJson = () => {
        if (photos.length === 0) {
            alert("There's nothing to export. Add some photos first!");
            return;
        }
        try {
             // Create a clean version of photos for export, removing temporary local data
            const photosForExport = photos.map(({ localDataUrl, ...rest }) => rest);

            const exportData: { photos: Omit<Photo, 'localDataUrl'>[]; shareableUrl?: string } = {
                photos: photosForExport,
            };

            if (cloudSaveState.status === 'success' && cloudSaveState.url) {
                exportData.shareableUrl = cloudSaveState.url;
            }

            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'past-forward-timeline.json';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to export JSON file:", error);
            alert("Sorry, there was an error exporting your timeline.");
        }
    };

    const handleSaveToCloud = async () => {
        if (photos.length === 0) {
            alert("There's nothing to save. Add some photos first!");
            return;
        }
        
        setCloudSaveState({ status: 'saving' });

        try {
            // Create a clean version of photos for saving, removing temporary local data
            const photosForSaving = photos.map(({ localDataUrl, ...rest }) => rest);
            const jsonString = JSON.stringify(photosForSaving);
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: jsonString,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to save: ${response.status} ${errorText}`);
            }

            const result = await response.json();
            
            const appUrl = new URL(window.location.href);
            appUrl.search = ''; 
            appUrl.searchParams.set('load_from_url', result.url);
            const finalShareableUrl = appUrl.toString();

            setCloudSaveState({ status: 'success', url: finalShareableUrl });

        } catch (error) {
            console.error("Failed to save timeline to cloud:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            setCloudSaveState({ status: 'error', error: errorMessage });
        }
    };

    const handleShare = async () => {
        if (photos.length === 0) {
            alert("There's nothing to share. Add some photos first!");
            return;
        }
        try {
            const photosForSharing = photos.map(({ localDataUrl, ...rest }) => rest);
            const jsonString = JSON.stringify(photosForSharing);
            const compressed = pako.deflate(jsonString);
            const encoded = btoa(Array.from(compressed, byte => String.fromCharCode(byte)).join(''));
            const url = new URL(window.location.href);
            url.search = '';
            url.searchParams.set('data', encoded);
            
            await navigator.clipboard.writeText(url.toString());
            setShareStatus('copied');
            setTimeout(() => setShareStatus('idle'), 2500);
        } catch (error) {
            console.error("Failed to create or copy share link:", error);
            alert("Sorry, there was an error creating the share link.");
        }
    };

    const handleDownloadAlbum = async () => {
        const generatedPhotos = photos.filter(p => p.status === 'done' && p.generatedUrl);
        if (generatedPhotos.length === 0) {
            alert("You need at least one successfully generated image to create an album.");
            return;
        }

        setIsDownloading(true);
        try {
            const imageData = generatedPhotos.reduce((acc, photo) => {
                acc[photo.date || photo.id] = photo.generatedUrl!;
                return acc;
            }, {} as Record<string, string>);

            const albumDataUrl = await createAlbumPage(imageData);
            const link = document.createElement('a');
            link.href = albumDataUrl;
            link.download = 'past-forward-album.jpg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Failed to create or download album:", error);
            alert("Sorry, there was an error creating your album.");
        } finally {
            setIsDownloading(false);
        }
    };

    const photosToRender = useMemo(() => {
        // Create a shallow copy to sort, preventing mutation of the original state array.
        return [...photos].sort((a, b) => a.date.localeCompare(b.date));
    }, [photos]);
    
    const randomPositions = useMemo(() => {
        return Array(photos.length + 1).fill(0).map((_, index) => ({
            x: (index - photos.length / 2) * 120 + (Math.random() - 0.5) * 150,
            y: (Math.random() - 0.5) * 150,
            rotate: (Math.random() - 0.5) * 60,
        }));
    }, [photos.length]);

    const hasGeneratedPhotos = photos.some(p => p.status === 'done');
    const hasPhotos = photos.length > 0;
    const isUploading = photos.some(p => p.status === 'uploading');


    return (
        <main ref={dragAreaRef} className="bg-black text-neutral-200 min-h-screen w-full flex flex-col items-center justify-center p-4 pb-40 overflow-hidden relative">
            <MusicPlayer />
            <div className="absolute top-0 left-0 w-full h-full bg-grid-white/[0.05]"></div>
            
            <div className="z-10 flex flex-col items-center justify-center w-full h-full flex-1 min-h-0">
                <header className="text-center my-10">
                    <h1 className="text-6xl md:text-8xl font-caveat font-bold text-neutral-100">Past Forward</h1>
                    <p className="font-permanent-marker text-neutral-300 mt-2 text-xl tracking-wide">
                        Generate a new timeline.
                    </p>
                </header>
                
                <div className="w-full h-full flex-1 flex items-center justify-center">
                     <AnimatePresence>
                        {photosToRender.map((photo, index) => (
                            <motion.div
                                key={photo.id}
                                className="absolute"
                                initial={{ opacity: 0, scale: 0.5, y: 100, rotate: (Math.random() - 0.5) * 50 }}
                                animate={{ opacity: 1, scale: 1, x: randomPositions[index].x, y: randomPositions[index].y, rotate: randomPositions[index].rotate }}
                                exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                                transition={{ type: 'spring', stiffness: 120, damping: 20, delay: index * 0.1 }}
                            >
                                <DraggableCardContainer>
                                    <DraggableCardBody dragConstraintsRef={dragAreaRef} className="!p-0 !bg-transparent !shadow-none">
                                        <PolaroidCard
                                            {...photo}
                                            dataUrl={photo.localDataUrl || photo.imageUrl}
                                            onUpdate={(updates) => handleUpdatePhoto(photo.id, updates)}
                                            onDelete={() => handleDeletePhoto(photo.id)}
                                            onGenerate={() => handleGenerateImage(photo.id)}
                                        />
                                    </DraggableCardBody>
                                </DraggableCardContainer>
                            </motion.div>
                        ))}
                         <motion.div
                            key={UPLOAD_PHOTO_ID}
                            className="absolute"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1, x: randomPositions[photos.length]?.x, y: randomPositions[photos.length]?.y, rotate: randomPositions[photos.length]?.rotate }}
                            transition={{ type: 'spring', stiffness: 120, damping: 20, delay: photos.length * 0.1 }}
                        >
                            <DraggableCardContainer>
                                <DraggableCardBody dragConstraintsRef={dragAreaRef} className="!p-0 !bg-transparent !shadow-none">
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="bg-neutral-100 dark:bg-neutral-100 !p-4 !pb-24 flex flex-col items-center justify-center aspect-[3/4] w-80 max-w-full rounded-md shadow-lg relative cursor-pointer group hover:bg-neutral-200 transition-colors"
                                    >
                                        <div className="w-full bg-neutral-900 shadow-inner flex-grow relative overflow-hidden flex flex-col items-center justify-center text-neutral-500 group-hover:text-neutral-300 transition-colors duration-300 text-center p-4">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            <span className="font-permanent-marker text-xl">Add Photo</span>
                                            <span className="text-sm mt-1">or load a saved timeline (.json)</span>
                                             {isUploading && (
                                                <div className="absolute bottom-2 left-2 right-2 text-xs text-yellow-400 font-semibold">Uploading...</div>
                                             )}
                                        </div>
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        className="hidden"
                                        accept="image/png, image/jpeg, image/webp, application/json"
                                        multiple
                                    />
                                </DraggableCardBody>
                            </DraggableCardContainer>
                        </motion.div>
                    </AnimatePresence>
                </div>

                 <div className="fixed bottom-28 z-30 flex items-center justify-center">
                    {hasPhotos && (
                        <div className="flex flex-col items-center gap-4 bg-neutral-900/50 backdrop-blur-sm p-4 rounded-lg border border-neutral-800 w-[90vw] max-w-4xl">
                             <div className="flex flex-wrap items-center justify-center gap-4 w-full">
                                <button onClick={handleSaveToCloud} disabled={cloudSaveState.status === 'saving' || isUploading} className={`${primaryButtonClasses} w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed`}>
                                    {cloudSaveState.status === 'saving' ? 'Saving...' : 'Save to Cloud'}
                                </button>
                                <button onClick={handleExportJson} disabled={isUploading} className={`${secondaryButtonClasses} w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed`}>
                                    Export File
                                </button>
                                <button onClick={handleDownloadAlbum} disabled={isDownloading || !hasGeneratedPhotos || isUploading} className={`${secondaryButtonClasses} w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed`}>
                                    {isDownloading ? 'Creating...' : 'Download Album'}
                                </button>
                                <button onClick={handleShare} disabled={!hasPhotos || isUploading} className={`${secondaryButtonClasses} w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed`} title={'Share your timeline'}>
                                    {shareStatus === 'copied' ? 'Link Copied!' : 'Share Link'}
                                </button>
                            </div>
                            {isUploading && <p className="text-xs text-yellow-400 animate-pulse">Please wait for images to finish uploading...</p>}
                             <AnimatePresence>
                                {cloudSaveState.status === 'success' && cloudSaveState.url && (
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mt-2 text-center text-sm w-full">
                                        <p className="text-green-400">✅ Saved! Use this link to reload your timeline anytime:</p>
                                        <div className="flex items-center gap-2 mt-1 bg-neutral-800 p-1 rounded-md">
                                            <input type="text" readOnly value={cloudSaveState.url} className="bg-transparent text-neutral-300 w-full p-1 text-xs focus:outline-none"/>
                                            <button 
                                                onClick={() => navigator.clipboard.writeText(cloudSaveState.url!)}
                                                className="bg-yellow-400 text-black font-semibold text-xs px-3 py-1 rounded-sm hover:bg-yellow-300 transition-colors flex-shrink-0"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                                {cloudSaveState.status === 'error' && (
                                     <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mt-2 text-center text-sm text-red-400">
                                        <p>❌ Save failed. Please try again.</p>
                                        {cloudSaveState.error && <p className="text-xs text-neutral-500 mt-1">{cloudSaveState.error}</p>}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
            <Footer />
        </main>
    );
}

export default App;