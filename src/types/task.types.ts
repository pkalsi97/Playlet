export enum TaskType {
    GOP_CREATION = 'GOP_CREATION',
    TRANSCODING = 'TRANSCODING'
}

export enum WorkerType {
    TRANSCODER_WORKER = 'TRANSCODER_WORKER',
    GOP_WORKER = 'GOP_WORKER'
}

export interface Location {
    Bucket: string;
    Key: string;
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