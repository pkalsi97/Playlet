export enum TaskType {
    TRANSCODE = 'TRANSCODE'
}

export enum WorkerType {
    PROCESSOR = 'PROCESSOR',
    HELPER = 'HELPER'
}

export interface Location {
    Bucket?: string;
    Key?: string;
}

export interface Task {
    taskId: string;
    userId: string;
    assetId: string;
    input: Location;
    output: Location;
    type: TaskType;
    worker: WorkerType;
    createdAt: string;
    metadata?: any;
}