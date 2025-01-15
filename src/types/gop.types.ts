export enum GopStatus {
    PROCESSED = 'PROCESSED',
    UPLOADED = 'UPLOADED',
}

export interface GopConfig {
    keyframeInterval: number;
    forceClosedGop: boolean;
    sceneChangeDetection: boolean;
    outputDir: string;
    frameRate?: number;
    preset?: string;
    crf?: number;           
}

export interface GopSegment {
    sequence: number;
    path: string;
    status: GopStatus;
}

export interface GopResult {
    success: boolean;
    error?: string;
    timeTaken: number;
    segments: GopSegment[];
}

export interface FinalGopResult {
    success: boolean;
    timeTaken:{
        production:number;
        upload:number;
    }
    segments:GopSegment[];
}