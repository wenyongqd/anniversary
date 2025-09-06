/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import type { Photo } from '../App';

interface PolaroidCardProps extends Photo {
    dataUrl: string; // Can be localDataUrl or imageUrl
    onUpdate: (updates: Partial<Pick<Photo, 'date' | 'message'>>) => void;
    onDelete: () => void;
    onGenerate: () => void;
    isSharedView?: boolean;
}

const LoadingSpinner = ({ text }: { text?: string }) => (
    <div className="flex flex-col items-center justify-center h-full">
        <svg className="animate-spin h-8 w-8 text-neutral-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {text && <p className="text-sm text-neutral-500 mt-2">{text}</p>}
    </div>
);

const ErrorDisplay = ({ error, onRetry }: { error?: string, onRetry: () => void }) => (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
         <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-neutral-500">Sorry, something went wrong.</p>
        <button onClick={onRetry} className="mt-2 text-sm font-semibold text-yellow-500 hover:text-yellow-400">Try Again</button>
        {error && <p className="text-xs text-neutral-600 mt-1 max-w-full truncate" title={error}>{error}</p>}
    </div>
);

const PolaroidCard: React.FC<PolaroidCardProps> = (props) => {
    const { id, dataUrl, imageUrl, generatedUrl, date, message, status, error, onUpdate, onDelete, onGenerate, isSharedView } = props;
    const [isDeveloped, setIsDeveloped] = useState(false);
    const [isImageLoaded, setIsImageLoaded] = useState(false);
    const [view, setView] = useState<'generated' | 'original'>('generated');
    const [currentImageSrc, setCurrentImageSrc] = useState<string>('');
    const [imageError, setImageError] = useState<boolean>(false);
    
    const displayUrl = view === 'original' ? imageUrl : generatedUrl;
    const isShowingGenerated = view === 'generated' && status === 'done' && generatedUrl;

    // Fallback image sources in order of preference
    const getImageSources = () => {
        const sources = [];
        if (isSharedView) {
            if (generatedUrl) sources.push(generatedUrl);
            if (imageUrl) sources.push(imageUrl);
            if (dataUrl) sources.push(dataUrl);
        } else {
            if (view === 'generated' && generatedUrl) sources.push(generatedUrl);
            if (view === 'original' && imageUrl) sources.push(imageUrl);
            if (dataUrl) sources.push(dataUrl);
        }
        return sources.filter(Boolean);
    };

    // Try to load images with fallbacks
    useEffect(() => {
        const sources = getImageSources();
        let currentIndex = 0;
        
        const tryLoadImage = () => {
            if (currentIndex >= sources.length) {
                setImageError(true);
                setIsImageLoaded(false);
                return;
            }
            
            const img = new Image();
            const src = sources[currentIndex];
            
            img.onload = () => {
                setCurrentImageSrc(src);
                setIsImageLoaded(true);
                setImageError(false);
            };
            
            img.onerror = () => {
                console.log(`Failed to load image from: ${src}`);
                currentIndex++;
                tryLoadImage();
            };
            
            img.src = src;
        };
        
        if (sources.length > 0) {
            setIsImageLoaded(false);
            setImageError(false);
            tryLoadImage();
        }
    }, [displayUrl, dataUrl, imageUrl, generatedUrl, view, isSharedView]);

    useEffect(() => {
        if (status === 'pending' || status === 'idle' || status === 'error' || status === 'uploading') {
            setIsDeveloped(false);
            setIsImageLoaded(false);
            setView('generated');
        }
        if (status === 'done' && generatedUrl) {
            setIsDeveloped(false);
            setIsImageLoaded(false);
        }
    }, [generatedUrl, status]);

    useEffect(() => {
        if (isImageLoaded && view === 'generated') {
            const timer = setTimeout(() => setIsDeveloped(true), 200);
            return () => clearTimeout(timer);
        } else if (view === 'original') {
             setIsDeveloped(true);
        }
    }, [isImageLoaded, view]);

    const isEditable = status === 'idle';

    return (
        <div className="bg-neutral-100 dark:bg-neutral-100 !p-4 !pb-24 flex flex-col items-center justify-start aspect-[3/4] w-80 max-w-full rounded-md shadow-lg relative group">
            <div className="w-full bg-neutral-900 shadow-inner flex-grow relative overflow-hidden">
                 <AnimatePresence>
                    {status === 'pending' && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10"><LoadingSpinner /></motion.div>}
                    {status === 'uploading' && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10"><LoadingSpinner text="Uploading..." /></motion.div>}
                    {status === 'error' && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10"><ErrorDisplay error={error} onRetry={onGenerate} /></motion.div>}
                </AnimatePresence>

                {!isSharedView && (
                <div className="absolute top-2 right-2 z-20 flex flex-col gap-2">
                    {status !== 'pending' && status !== 'uploading' && (
                        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 bg-black/50 rounded-full text-white hover:bg-red-500/75 focus:outline-none focus:ring-2 focus:ring-white opacity-0 group-hover:opacity-100 transition-opacity" aria-label={`Delete photo for ${date}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    )}
                    {status === 'done' && generatedUrl && (
                        <button onClick={(e) => { e.stopPropagation(); setView(v => v === 'generated' ? 'original' : 'generated'); }} className="p-2 bg-black/50 rounded-full text-white hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-white" aria-label="Switch image">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                        </button>
                    )}
                </div>
                )}

                {isShowingGenerated && (
                    <div className={`absolute inset-0 z-10 bg-[#3a322c] transition-opacity duration-[3500ms] ease-out ${isDeveloped ? 'opacity-0' : 'opacity-100'}`} aria-hidden="true" />
                )}
                
                <AnimatePresence mode="wait">
                    {!imageError && currentImageSrc ? (
                        <motion.img
                            key={currentImageSrc}
                            src={currentImageSrc}
                            alt={date}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className={`w-full h-full object-cover transition-all duration-[4000ms] ease-in-out ${
                                isDeveloped && isShowingGenerated ? 'filter-none' : isShowingGenerated ? 'filter sepia(1) contrast(0.8) brightness(0.8)' : ''
                            }`}
                            style={{ opacity: isImageLoaded ? 1 : 0 }}
                        />
                    ) : imageError ? (
                        <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                            <div className="text-center p-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-neutral-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <p className="text-xs text-neutral-500">Image not available</p>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-neutral-900">
                            <LoadingSpinner text="Loading image..." />
                        </div>
                    )}
                </AnimatePresence>
            </div>
            <div className="absolute bottom-4 left-4 right-4 text-center px-2 flex flex-col gap-1">
                 <input
                    type="text"
                    value={date}
                    onChange={(e) => onUpdate({ date: e.target.value })}
                    placeholder="Date or Caption"
                    readOnly={!isEditable}
                    className={cn(
                        "font-permanent-marker text-lg truncate w-full bg-transparent text-center focus:outline-none focus:ring-1 focus:ring-yellow-500 rounded-sm",
                        status === 'done' ? 'text-black' : 'text-neutral-800',
                        isEditable ? 'cursor-text' : 'cursor-default'
                    )}
                />
                <textarea
                    value={message}
                    onChange={(e) => onUpdate({ message: e.target.value })}
                    placeholder="Describe the memory..."
                    rows={2}
                    readOnly={!isEditable}
                    className={cn(
                        "font-permanent-marker text-sm w-full bg-transparent text-center resize-none focus:outline-none focus:ring-1 focus:ring-yellow-500 rounded-sm text-neutral-600",
                        isEditable ? 'cursor-text' : 'cursor-default'
                    )}
                />
                {status === 'idle' && (
                    <button
                        onClick={onGenerate}
                        disabled={!date || !message}
                        className="mt-1 font-permanent-marker text-base text-center text-black bg-yellow-400 py-1.5 px-4 rounded-sm transform transition-transform duration-200 hover:scale-105 hover:-rotate-2 hover:bg-yellow-300 shadow-[1px_1px_0px_1px_rgba(0,0,0,0.2)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:rotate-0"
                    >
                        Generate Image
                    </button>
                )}
            </div>
        </div>
    );
};

export default PolaroidCard;