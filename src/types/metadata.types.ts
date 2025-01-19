export interface SourceMetadata {
    validation:{
        basic:BasicValidationResult,
        stream:StreamValidationResult,
    },
    metadata:{
        technical:TechnicalMetadata,
        quality:QualityMetrics,
        content:ContentMetadata,
    }
}

export interface TechnicalMetadata {
    containerFormat: string;
    videoCodec: string;
    audioCodec: string;
    duration: any;
    bitrate: any;
    frameRate: string | 'N/A';
    resolution: {
        width: number | 'N/A';
        height: number | 'N/A';
    };
    aspectRatio: string | 'N/A';
    colorSpace: string | 'N/A';
}

export interface ContentMetadata {
    creationDate: string | 'N/A';
    lastModified: string | 'N/A';
}

export interface QualityMetrics {
    videoQualityScore: number | 'N/A';
    audioQualityScore: number | 'N/A';
    corruptionStatus: {
        isCorrupted: boolean;
        details: string;
    };
    missingFrames: number | 'N/A';
    audioSync: {
        inSync: boolean;
        offsetMs: number | 'N/A';
    };
}

export interface BasicValidationResult {
    exists: boolean;
    sizeInBytes: number;
    containerFormat: string;
    detectedFormats: string;
    videoCodec: string;
    audioCodec: string;
    isValid: boolean;
}

export interface StreamValidationResult {
    hasVideoStream: boolean;
    hasAudioStream: boolean;
    isPlayable: boolean;
    hasCorruptFrames: boolean;
    error?: string;
}

export interface ContentValidationResult{
    success: boolean;
    error?: string;
    basic: BasicValidationResult,
    stream: StreamValidationResult,
}

export interface ContentMetadataResult {
    technical:TechnicalMetadata,
    quality: QualityMetrics,
    content: ContentMetadata,
}